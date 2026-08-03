/**
 * TTOCC - Gestión de Flota
 * app.js - Lógica Global, Utilidades, Gestión Offline y Sincronización
 */

// ==========================================
// 1. CONFIGURACIÓN GLOBAL Y SERVIDOR
// ==========================================

// URL de despliegue Web App de Google Apps Script
/*const APP_CONFIG = {*/
  const SCRIPT_URL = {
    
    // URL DE DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycbwM17iGCVD7YZpQj4fsD-pVBaip7ny5t5iIhuLluRLOVuLJNbTPjctopePliFIcjTFwLg/exec"
};
// Claves de almacenamiento en localStorage
const CACHE_KEY = 'ttocc_mantenimientos';
const SYNC_QUEUE_KEY = 'ttocc_sync_queue';


// ==========================================
// 2. UTILIDADES DE FORMATO Y FECHAS
// ==========================================

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    try {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return fechaStr;
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return fechaStr;
    }
}

function calcularDiasTranscurridos(fechaIngresoStr) {
    if (!fechaIngresoStr) return 0;
    const ingreso = new Date(fechaIngresoStr);
    const hoy = new Date();
    const diferenciaMs = hoy - ingreso;
    return Math.floor(diferenciaMs / (1000 * 60 * 60 * 24));
}


// ==========================================
// 3. COMPONENTES DE INTERFAZ (NOTIFICACIONES Y MODALES)
// ==========================================

function mostrarNotificacion(mensaje, tipo = 'info') {
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        contenedor.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 pointer-events-none';
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-lg border transition-all duration-300 transform translate-y-2 opacity-0 text-sm font-medium backdrop-blur-md`;

    let estilotipo = '';
    let icono = '';

    switch (tipo) {
        case 'exito':
            estilotipo = 'bg-emerald-950/80 text-emerald-200 border-emerald-800/50';
            icono = '<i class="fa-solid fa-circle-check text-emerald-400 text-lg mr-3"></i>';
            break;
        case 'error':
            estilotipo = 'bg-rose-950/80 text-rose-200 border-rose-800/50';
            icono = '<i class="fa-solid fa-circle-exclamation text-rose-400 text-lg mr-3"></i>';
            break;
        case 'advertencia':
            estilotipo = 'bg-amber-950/80 text-amber-200 border-amber-800/50';
            icono = '<i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg mr-3"></i>';
            break;
        default:
            estilotipo = 'bg-slate-900/90 text-slate-200 border-slate-700/50';
            icono = '<i class="fa-solid fa-circle-info text-blue-400 text-lg mr-3"></i>';
    }

    toast.className += ` ${estilotipo}`;
    toast.innerHTML = `
        <div class="flex items-center">
            ${icono}
            <span>${mensaje}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="ml-4 text-slate-400 hover:text-white transition-colors">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    contenedor.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    // Auto eliminar a los 4 segundos
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function mostrarConfirmacion(titulo, mensaje, callbackAceptar) {
    const modalExistente = document.getElementById('modal-confirmacion-global');
    if (modalExistente) modalExistente.remove();

    const modalHtml = `
    <div id="modal-confirmacion-global" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl transform transition-all">
            <h3 class="text-lg font-semibold text-slate-100 mb-2 flex items-center gap-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
                ${titulo}
            </h3>
            <p class="text-sm text-slate-400 mb-6">${mensaje}</p>
            <div class="flex justify-end gap-3">
                <button id="btn-confirm-cancelar" class="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
                    Cancelar
                </button>
                <button id="btn-confirm-aceptar" class="px-4 py-2 rounded-xl text-sm font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors">
                    Aceptar
                </button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('modal-confirmacion-global');
    const btnCancelar = document.getElementById('btn-confirm-cancelar');
    const btnAceptar = document.getElementById('btn-confirm-aceptar');

    const cerrarModal = () => modal.remove();

    btnCancelar.addEventListener('click', cerrarModal);
    btnAceptar.addEventListener('click', () => {
        cerrarModal();
        if (typeof callbackAceptar === 'function') callbackAceptar();
    });
}


// ==========================================
// 4. LECTURA OFFLINE-FIRST (STALE-WHILE-REVALIDATE)
// ==========================================

/**
 * Obtiene los registros de la flota aplicando la estrategia Offline-First.
 * Renderiza inmediatamente el caché local y actualiza desde el servidor si hay red.
 */
async function obtenerRegistrosFlota(callbackRender) {
    // 1. CARGA INMEDIATA DESDE CACHÉ LOCAL (0ms de espera)
    const datosLocales = localStorage.getItem(CACHE_KEY);
    let registros = datosLocales ? JSON.parse(datosLocales) : [];

    if (registros.length > 0 && typeof callbackRender === 'function') {
        callbackRender(registros);
    }

    // 2. CONSULTA EN SEGUNDO PLANO (Si hay conexión)
    if (navigator.onLine && SCRIPT_URL) {
        try {
            const response = await fetch(`${SCRIPT_URL}?action=OBTENER_TODOS`);
            if (response.ok) {
                const datosServidor = await response.json();
                
                // Actualizar caché local
                localStorage.setItem(CACHE_KEY, JSON.stringify(datosServidor));
                
                // Actualizar interfaz con datos frescos del servidor
                if (typeof callbackRender === 'function') {
                    callbackRender(datosServidor);
                }
            }
        } catch (error) {
            console.warn('[Lectura] Sin conexión con el servidor. Se mantienen datos locales.', error);
        }
    }
}


// ==========================================
// 5. GESTIÓN DE COLA OFFLINE Y SINCRONIZACIÓN
// ==========================================

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
    if (!navigator.onLine || !SCRIPT_URL) return;

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

            const response = await fetch(SCRIPT_URL, {
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
        mostrarNotificacion('Sincronización con la nube completada.', 'exito');
        if (typeof cargarDatos === 'function') cargarDatos();
    }
}


// ==========================================
// 6. INICIALIZACIÓN DE EVENTOS Y SERVICE WORKER
// ==========================================

// Escuchar reconexión a Internet
window.addEventListener('online', () => {
    console.log('[Red] Conexión restablecida.');
    mostrarNotificacion('Conexión restablecida. Sincronizando datos...', 'info');
    procesarSincronizacionPendiente();
});

window.addEventListener('offline', () => {
    console.warn('[Red] Conexión perdida. Operando en modo Offline.');
    mostrarNotificacion('Modo sin conexión activo. Los cambios se guardarán localmente.', 'advertencia');
});

// Registrar Service Worker para PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('Service Worker registrado correctamente con alcance:', reg.scope);
                procesarSincronizacionPendiente();
            })
            .catch(err => console.error('Error al registrar Service Worker:', err));
    });
}
