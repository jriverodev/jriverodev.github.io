# Diagnóstico Técnico - TTOCC System

## 1. Arquitectura del Sistema
El sistema es una **PWA (Progressive Web App)** que utiliza:
- **Frontend:** HTML5, Tailwind CSS 4, JavaScript vanilla, Chart.js, SheetJS, html2pdf.js.
- **Backend:** Google Apps Script (GAS) actuando como API para una Google Sheet.
- **Persistencia Local:** Service Worker (`sw.js`) para modo offline (solo lectura de interfaz).

## 2. Hallazgos Críticos

### ❌ Error de Referencia (JS)
Se detectó un error `ReferenceError: alternarTallerExterno is not defined` en `panel.html`. Esto ocurría porque los scripts se cargaban al final del `body`, pero los controladores de eventos en línea (`onchange`) intentaban acceder a las funciones antes de que el script fuera procesado o debido a problemas de orden de carga.
- **Solución:** Se movieron los tags `<script>` de `js/app.js` y `js/panel.js` al `<head>` con el atributo `defer`.

### ⚠️ Inconsistencia de la URL de la API
Se detectó que la URL de comunicación con el backend está definida de forma inconsistente:
- **`js/app.js`**: Usa un ID de despliegue finalizado en `...KTqK8A/exec`.
- **`panel.html`**: Redefine la variable `APP_CONFIG` con un ID finalizado en `...fAmw/exec`.
- **Impacto:** Las operaciones de lectura/escritura pueden fallar o dirigirse a entornos distintos dependiendo de desde qué archivo se originen.

### 📁 Archivos Obsoletos
- El archivo `css/estilos.css` contiene reglas para una interfaz antigua que ya no se utiliza (el sistema actual usa Tailwind). Sin embargo, sigue referenciado en la lista de recursos del Service Worker (`sw.js`).

### 🛠️ Estado de la PWA
- **Activos Faltantes:** El `manifest.json` referencia iconos en `assets/icon-192.png` y `assets/icon-512.png`, pero la carpeta `assets/` no contenía estos archivos (se creó la carpeta pero está vacía).
- **Offline:** No existe una lógica de sincronización diferida para escrituras en modo offline.

## 3. Recomendaciones de Mejora
1. **Unificar `APP_CONFIG`**: Eliminar la definición redundante en `panel.html` y centralizarla en `js/app.js`.
2. **Depuración de Estilos**: Eliminar `css/estilos.css` y actualizar `sw.js`.
3. **Completar PWA**: Generar los iconos reglamentarios para permitir la instalación correcta en dispositivos móviles.

## 4. Cambios Realizados (Actualización)

### ✅ Implementación de nuevos campos
Se agregaron los campos **Gerencia Usuaria** y **Usuario / Chofer** para mejorar la trazabilidad de las solicitudes de mantenimiento.
- **Frontend:** Se incluyeron inputs en los formularios de creación y edición. El campo "Gerencia Usuaria" cuenta con un `datalist` dinámico que se alimenta de los registros existentes.
- **Backend (GAS):** Se expandió la estructura de la hoja de cálculo a 16 columnas (añadiendo N y O para los nuevos campos y desplazando el checklist a la columna P).
- **Lógica de Sincronización:** Se actualizaron los payloads de `crear` y `editar` en `js/panel.js` para persistir estos datos.
