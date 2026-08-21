README — TTOCC (instrucciones rápidas)

Resumen rápido
- Se consolidaron funciones de preview/limpieza de imágenes en un módulo compartido: js/ui-utils.js
- Las páginas que usan panel/form ahora incluyen js/ui-utils.js (index.html, panel.html, form-talleres.html, form-flota.html).
- Añadido un debug UI (botones) para facilitar pruebas de preview/limpieza. Por defecto aparece sólo en entornos "dev" o si se activa explícitamente.

Qué contiene js/ui-utils.js
- window.TTOCC_UI_UTILS.previsualizarImagen(inputElement, idContenedor)
- window.TTOCC_UI_UTILS.limpiarPrevia(idInput, idContenedor)
- Además define globales compat: window.previsualizarImagen y window.limpiarPrevia
- Botones de debug (Debug: Seleccionar Imagen (Preview) y Debug: Limpiar Preview) que se muestran sólo en dev o si se habilita manualmente.

Dónde se hicieron cambios relevantes
- Nuevo: js/ui-utils.js
- Modificados: js/form-talleres.js, js/panel.js (ahora delegan a TTOCC_UI_UTILS con fallback)
- HTML: index.html, panel.html, form-talleres.html, form-flota.html — se añadió <script src="js/ui-utils.js" defer></script>
- index.html: se añadió activación explícita de debug en la cabecera para facilitar pruebas: <script>window.TTOCC_DEBUG_UI = true;</script>

Cómo probar localmente
1. Servir los archivos estáticos (ejemplo con Python 3):
   - Abrir PowerShell en la carpeta del proyecto (C:\Users\HP\Documents\tto-gestion-flota)
   - Ejecutar:
     python -m http.server 8000
   - Abrir http://localhost:8000 en el navegador

2. Abrir la página y verificar preview:
   - Ir a "index.html" o a cualquiera de las páginas: panel.html, form-talleres.html, form-flota.html
   - Abrir modal "Registrar" o "Editar".
   - Seleccionar una imagen en el input correspondiente. Debería mostrarse la vista previa.
   - Usar el botón "Debug: Limpiar Preview" (aparece en el footer o como panel flotante) para limpiar el preview.

Cómo activar el Debug UI
- Opciones:
  1) (rápido) Añadir ?dev al final de la URL: http://localhost:8000/panel.html?dev
  2) Definir la variable global antes de cargar js/ui-utils.js en la página: <script>window.TTOCC_DEBUG_UI = true;</script>
     - Esto ya se colocó en index.html por defecto.
  3) Ejecutar en consola del navegador: window.TTOCC_DEBUG_UI = true; y recargar la página.

Comprobación estática de JS (sintaxis)
- Para revisar sintaxis JS en Windows PowerShell (se usó node --check):
  node --check .\js\ui-utils.js .\js\form-talleres.js .\js\panel.js
- Para comprobar todo el proyecto (excluyendo node_modules):
  Ejecutado desde la raíz del proyecto (PowerShell):
    Get-ChildItem -Path . -Recurse -File -Filter *.js | Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' } | ForEach-Object { Write-Output "Checking: $($_.FullName)"; node --check $($_.FullName) }

Notas y recomendaciones
- El debug UI está diseñado para no mostrarse en producción salvo que se habilite explícitamente (window.TTOCC_DEBUG_UI = true). Esto evita exponer herramientas de depuración inadvertidamente.
- js/ui-utils.js mantiene un fallback global (window.previsualizarImagen/limpiarPrevia) para compatibilidad con código existente.
- Se recomienda probar las páginas en localhost y hacer pruebas de flujo offline/online si usas las funcionalidades de cola y sincronización (Supabase).

Siguiente pasos sugeridos (opcional)
- Conectar las variables de Supabase en APP_CONFIG o window.TTOCC_SUPABASE_URL/ANON_KEY para pruebas E2E.
- Añadir un README de despliegue con CSP (se actualizó vercel.json previamente para supabase).

Comportamiento de sincronización Talleres → Maestro_Activos (importante)
- Cuando se crea o edita un registro en el módulo de Talleres, el backend (Apps Script) sólo actualiza las siguientes columnas en Maestro_Activos:
  - Ubicacion_Taller: nombre del taller o nombre (con " (EXT)" si aplica)
  - Ubicacion_Taller_Fecha: timestamp (fecha y hora) de la acción (se usa payload.fecha_ingreso si está, o la fecha/hora del servidor)
- No se crean filas nuevas en Maestro_Activos desde acciones de Talleres. Maestro_Activos es la fuente de verdad y las filas deben gestionarse desde el módulo Maestro (crear_activo/editar_activo).
- Si prefieres una política diferente (p. ej. crear filas automáticamente cuando la unidad no existe), indícalo y se puede revertir.

Cómo probar rápidamente la sincronización
1) En la UI, selecciona una unidad ya registrada en Maestro_Activos y crea un registro de Taller con nombre de taller.
2) Comprueba en Maestro_Activos (leer_activos) que:
   - La columna "Ubicacion_Taller" para esa unidad se actualizó con el nombre del taller.
   - La columna "Ubicacion_Taller_Fecha" contiene la fecha/hora del registro.
3) Si quieres validar desde Apps Script, en el editor de Apps Script revisa los logs (Logger.log) para ver mensajes de error relacionados con la sincronización.

Si quieres, agrego un script de prueba que llame al endpoint con payloads de ejemplo para automatizar la verificación.

Configurar Supabase y buckets de Storage (instrucciones)
1. Crear proyecto Supabase
   - Ir a https://app.supabase.com y crear un nuevo proyecto.
   - Anotar la URL del proyecto (ej. https://abcd1234.supabase.co) y la ANON KEY (o crear una clave con permisos adecuados para pruebas).

2. Crear un bucket de Storage
   - En la consola Supabase > Storage > Buckets: Crear un bucket (nombre recomendado: fotos).
   - Política del bucket:
     - Para pruebas rápidas: marcarlo como "public" para que getPublicUrl devuelva URLs accesibles.
     - Para producción: mantener el bucket privado y servir archivos mediante Signed URLs. En ese caso el código de cliente debe solicitar signed URLs vía funciones seguras (no con ANON KEY en cliente).

3. Configurar RLS y tablas (Postgres)
   - Crear la(s) tabla(s) que la app sincroniza. Ejemplo mínimo SQL para una tabla de mantenimientos:

     -- Ejemplo: tabla mantenimientos
     CREATE TABLE IF NOT EXISTS mantenimientos (
       id TEXT PRIMARY KEY,
       id_unidad TEXT,
       marca TEXT,
       flota TEXT,
       nombre_taller TEXT,
       observaciones TEXT,
       foto_antes_url TEXT,
       foto_despues_url TEXT,
       datos JSONB,
       updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
     );

   - Habilitar Row Level Security (RLS) y añadir políticas de inserción/actualización según tu auth model. Para desarrollo rápido puedes desactivar RLS, pero en producción es imprescindible.

4. Ajustes de seguridad y CORS
   - Si usas el ANON KEY en cliente, asegúrate de que las RLS policies permitan solo lo necesario.
   - Configurar CORS en la consola si hay restricciones entre dominios (normalmente Supabase ya permite peticiones desde orígenes variados para ANON KEY).
   - Actualizar CSP (ej. vercel.json) para permitir conexiones a *.supabase.co y wss://*.supabase.co (ya se hizo en este proyecto).

5. Configurar la app para usar Supabase
   - Opción A (rápida, no recomendada para producción): insertar en index.html (o un archivo de configuración cargado antes de app.js):

       <script>
         window.TTOCC_SUPABASE_URL = 'https://abcd1234.supabase.co';
         window.TTOCC_SUPABASE_ANON_KEY = 'eyJhbGciOi...';
       </script>

   - Opción B (recomendada): colocar las variables en APP_CONFIG en el servidor o en un archivo de entorno y exponerlas de forma segura al cliente (ej. mediante un servidor que inyecte variables en tiempo de despliegue).

6. Comprobar uploads y sync
   - Crear un registro desde la UI mientras está online: la app intentará subir files vía TTOCC_SUPABASE_SYNC.uploadFileToStorage si está disponible y luego enviará payload con foto_* URL en lugar de base64.
   - Si el bucket es público, la app usa getPublicUrl para incluir la URL en el registro.
   - Si el bucket es privado, implementa un endpoint seguro que devuelva Signed URLs para que la app pueda subir/leer archivos sin exponer credenciales sensibles.

7. Recomendaciones para producción
   - No uses el service_role key o claves de servidor en el cliente.
   - Implementa autenticación (Supabase Auth) y políticas RLS estrictas que verifiquen el JWT del usuario.
   - Para cargas desde cliente a buckets privados, usa funciones serverless que generen Signed URLs y validen permisos.
   - Revisa los límites de almacenamiento y tamaño de payload de IndexedDB si planeas guardar muchas imágenes en base64 en Dexie.

8. Ejemplo rápido de prueba en consola
   - En la consola del navegador puedes inyectar temporalmente las variables y probar:
       window.TTOCC_SUPABASE_URL = 'https://abcd1234.supabase.co';
       window.TTOCC_SUPABASE_ANON_KEY = 'eyJhbGciOi...';
     Recargar la página y luego probar subir una imagen desde el modal. Verifica que la URL devuelta apunte al bucket "fotos".

Si quieres, puedo generar los SQL de ejemplo como archivos .sql y añadir una guía paso a paso para crear las políticas RLS básicas (ej. permitir insert/upsert a usuarios autenticados). También puedo mostrar snippets para implementar un endpoint serverless que proporcione Signed URLs de forma segura.

Si prefieres que lo incorpore directamente al README en otra posición/formato, indícalo.

