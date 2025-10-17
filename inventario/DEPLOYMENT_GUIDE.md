# Guía de Despliegue del Backend (Google Apps Script)

Esta guía te mostrará cómo desplegar correctamente el script de Google (`Code.gs`) para que tu sistema de inventario funcione sin errores de CORS (`Access-Control-Allow-Origin`).

Sigue estos pasos cuidadosamente.

---

### Paso 1: Crea un Nuevo Proyecto en Google Apps Script

1.  Ve a [script.google.com](https://script.google.com).
2.  Haz clic en **"Nuevo proyecto"** en la esquina superior izquierda.
3.  Ponle un nombre a tu proyecto en la parte superior (ej. "Backend Inventario").

### Paso 2: Copia y Pega el Código del Backend

1.  Abre el archivo `Code.gs` que se encuentra en este repositorio.
2.  Copia **todo** el contenido del archivo.
3.  Vuelve a tu proyecto de Google Apps Script y pega el código, reemplazando cualquier contenido que hubiera por defecto.

### Paso 3: Configura el ID de tu Hoja de Cálculo

El script necesita saber a qué Google Sheet conectarse.

1.  Abre tu hoja de cálculo de Google que contiene el inventario.
2.  Mira la URL en tu navegador. Será algo como:
    `https://docs.google.com/spreadsheets/d/1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c/edit`
3.  El **ID de la hoja** es la larga cadena de texto que está entre `/d/` y `/edit`. En el ejemplo anterior, es `1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c`.
4.  Copia tu ID.
5.  En el archivo `Code.gs` de tu proyecto de Google Apps Script, reemplaza el valor de la constante `SPREADSHEET_ID` con tu ID.

    ```javascript
    const SPREADSHEET_ID = 'AQUÍ_VA_EL_ID_DE_TU_HOJA_DE_CÁLCULO';
    ```

### Paso 4: Despliega el Script como Aplicación Web (¡Paso Crítico!)

Esta es la parte más importante para evitar los errores de CORS.

1.  En la esquina superior derecha del editor de Google Apps Script, haz clic en el botón azul **"Implementar"** y selecciona **"Nueva implementación"**.
2.  Se abrirá una ventana de configuración. Rellénala de la siguiente manera:
    *   **Seleccionar tipo**: Haz clic en el icono del engranaje ⚙️ y elige **"Aplicación web"**.
    *   **Descripción**: Escribe algo descriptivo, como "API para el sistema de inventario".
    *   **Ejecutar como**: Déjalo en **"Yo (tu-email@gmail.com)"**.
    *   **Quién tiene acceso**: **¡MUY IMPORTANTE!** Cambia esta opción a **"Cualquier persona"**. Esto es lo que permite que tu página de GitHub Pages pueda hacerle peticiones.

3.  Haz clic en **"Implementar"**.

### Paso 5: Autoriza los Permisos

Google te pedirá permiso para que el script pueda acceder a tus hojas de cálculo.

1.  Haz clic en **"Autorizar acceso"**.
2.  Elige tu cuenta de Google.
3.  Verás una advertencia de "Google no ha verificado esta aplicación". Esto es normal. Haz clic en **"Configuración avanzada"** y luego en **"Ir a (nombre de tu proyecto) (no seguro)"**.
4.  Finalmente, haz clic en **"Permitir"**.

### Paso 6: Copia la URL de la Aplicación Web

Una vez que la implementación sea exitosa, verás una ventana con la **URL de la aplicación web**.

1.  **Copia esta URL.** La necesitarás en el siguiente paso. ¡No la pierdas!

### Paso 7: Actualiza la URL en el Código Frontend

Ahora tienes que decirle a tu página web cuál es la nueva URL de tu backend.

1.  Vuelve a tu código (en tu editor local o en GitHub).
2.  Abre el archivo `inventario/js/google-sheets.js`.
3.  Busca la variable `scriptURL` y reemplaza el valor actual con la URL que acabas de copiar.

    ```javascript
    class GoogleSheetsAPI {
      constructor() {
        // REEMPLAZA LA SIGUIENTE LÍNEA CON LA URL DE TU IMPLEMENTACIÓN
        this.scriptURL = 'AQUÍ_VA_LA_URL_QUE_COPIASTE_EN_EL_PASO_6';
      }
      // ... el resto del código
    }
    ```

4.  Guarda los cambios y súbelos a tu repositorio de GitHub.

### ¡Listo!

Una vez que hayas subido los cambios, tu aplicación debería funcionar correctamente y cargar los datos desde tu Google Sheet sin errores de CORS.

---

**Nota sobre futuras actualizaciones:** Si alguna vez modificas el código en `Code.gs`, tienes que volver a desplegarlo. Para ello, ve a **"Implementar"** -> **"Gestionar implementaciones"**, selecciona tu implementación, haz clic en el lápiz (editar) y en "Versión", elige **"Nueva versión"**. Luego, haz clic en **"Implementar"**. No necesitarás cambiar la URL de nuevo.