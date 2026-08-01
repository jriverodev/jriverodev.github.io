// js/app.js - Núcleo de Configuración, PWA y Cola Offline

// =========================================================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// =========================================================================
const APP_CONFIG = {
    // URL DE DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycbwM17iGCVD7YZpQj4fsD-pVBaip7ny5t5iIhuLluRLOVuLJNbTPjctopePliFIcjTFwLg/exec"
};

// Claves de almacenamiento local
const SYNC_QUEUE_KEY = 'ttocc_sync_queue';

// Registro del Service Worker para soporte de PWA (Instalación y caché local)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => {
                console.log('✔ Service Worker operativo en patio:', reg.scope);
                // Intentar procesar tareas pendientes al iniciar la app
                procesarSincronizacionPendiente();
            })
            .catch(err => console.error('❌ Error registrando el Service Worker:', err));
    });
}


// =========================================================================
// GESTIÓN DE COLA OFFLINE Y SINCRONIZACIÓN AUTOMÁTICA
// =========================================================================

/**
 * Registra una acción de escritura en la cola local cuando no hay conexión
 */
function encolarOperacionOffline(accion, payload) {
    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    queue.push({
        idSync: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        accion: accion,
        payload: payload,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    console.warn(`[Offline Queue] Operación '${accion}' guardada en cola local.`);
}

/**
 * Procesa y envía los cambios acumulados al backend de Google Apps Script
 */
async function procesarSincronizacionPendiente() {
    if (!navigator.onLine || !APP_CONFIG.URL_API) return;

    let queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
    if (queue.length === 0) return;

    console.log(`[Sync] Procesando ${queue.length} operaciones pendientes...`);
    
    let pendienteSincronizar = [...queue];

    for (const item of queue) {
        try {
            const formData = new FormData();
            formData.append('action', item.accion);
            formData.append('data', JSON.stringify(item.payload));

            // Si la tarea incluye imágenes adjuntas
            if (item.payload.fotoAntes) formData.append('fotoAntes', item.payload.fotoAntes);
            if (item.payload.fotoDespues) formData.append('fotoDespues', item.payload.fotoDespues);

            const response = await fetch(APP_CONFIG.URL_API, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                // Eliminar elemento enviado con éxito
                pendienteSincronizar = pendienteSincronizar.filter(q => q.idSync !== item.idSync);
                localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(pendienteSincronizar));
                console.log(`[Sync Exitoso] Registro ${item.idSync} sincronizado.`);
            } else {
                console.warn('[Sync] Servidor devolvió respuesta no OK. Se reintentará luego.');
                break;
            }
        } catch (error) {
            console.error('[Sync] Error de red durante la sincronización:', error);
            break; // Detener para preservar el orden estricto de ejecuciones
        }
    }

    if (pendienteSincronizar.length === 0) {
        console.log('[Sync Complete] Todos los registros locales están en la nube.');
        if (typeof cargarDatos === 'function') cargarDatos();
    }
}

// Escuchar evento de reconexión a Internet
window.addEventListener('online', () => {
    console.log('[Red] Conexión restablecida.');
    if (typeof mostrarNotificacion === 'function') {
        mostrarNotificacion('Conexión restablecida. Sincronizando datos...', 'info');
    }
    procesarSincronizacionPendiente();
});
