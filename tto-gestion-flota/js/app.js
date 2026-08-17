/**
 * TTOCC - Gestión de Flota
 * app.js - Lógica Global, Utilidades, Sanitización XSS, Gestión de Sesión, Debounce y Sincronización Cifrada
 */
"use strict";

// ==========================================
// 1. CONFIGURACIÓN GLOBAL Y SERVIDOR
// ==========================================

const APP_CONFIG = {
    URL_API: "https://script.google.com/macros/s/AKfycbxsTpKVIxmzu4xARAiSkwpBcHnPGwrpdteYqGqmUr33NSNyWdIj07yBBvISNCHexF8cPQ/exec"
};

const CACHE_KEY = 'ttocc_mantenimientos';
const SYNC_QUEUE_KEY = 'ttocc_sync_queue';
const SESSION_TOKEN_KEY = 'TTOCC_SESSION_TOKEN';
const OPERADOR_KEY = 'TTOCC_OPERADOR';


// ==========================================
// 2. SEGURIDAD, UTILIDADES & HELPER DEBOUNCE
// ==========================================

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(func, wait = 250) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function validarArchivoAdjunto(file, tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxTamanoBytes = 5 * 1024 * 1024) {
    if (!file) return { valido: true };
    if (!tiposPermitidos.includes(file.type)) {
        return {
            valido: false,
            mensaje: 'Formato no permitido. Utilice solo imágenes JPG/PNG/WebP o archivos PDF.'
        };
    }
    if (file.size > maxTamanoBytes) {
        const maxMB = (maxTamanoBytes / (1024 * 1024)).toFixed(0);
        return {
            valido: false,
            mensaje: `El archivo excede el tamaño máximo permitido de ${maxMB} MB.`
        };
    }
    return { valido: true };
}


// ==========================================
// 3. MANEJO DE SESIÓN Y AUTENTICACIÓN
// ==========================================

function obtenerTokenSesion() {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || "";
}

function guardarSesion(token, usuario) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    sessionStorage.setItem(OPERADOR_KEY, usuario);
}

function cerrarSesion() {
    sessionStorage.removeItem(SESSION_TOKEN_KEY);
    sessionStorage.removeItem(OPERADOR_KEY);
}


// ==========================================
// 4. UTILIDADES DE FORMATO Y FECHAS
// ==========================================

function formatearFecha(fechaStr) {
    if (!fechaStr) return '-';
    try {
        const fecha = new Date(fechaStr);
        if (isNaN(fecha.getTime())) return escapeHTML(fechaStr);
        return fecha.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (e) {
        return escapeHTML(fechaStr);
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
// 5. COMPONENTES DE INTERFAZ (NOTIFICACIONES Y MODALES)
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
            <span>${escapeHTML(mensaje)}</span>
        </div>
        <button onclick="this.parentElement.remove()" class="ml-4 text-slate-400 hover:text-white transition-colors">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    contenedor.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

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
                ${escapeHTML(titulo)}
            </h3>
            <p class="text-sm text-slate-400 mb-6">${escapeHTML(mensaje)}</p>
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
// 6. LECTURA OFFLINE-FIRST (STALE-WHILE-REVALIDATE Y DEXIE SEGURIDAD)
// ==========================================

async function obtenerRegistrosFlota(callbackRender) {
    let registros = [];
    if (typeof obtenerMantenimientosLocalSeguro === 'function') {
        registros = await obtenerMantenimientosLocalSeguro();
    }
    if ((!registros || registros.length === 0)) {
        const datosLocales = localStorage.getItem(CACHE_KEY);
        registros = datosLocales ? JSON.parse(datosLocales) : [];
    }

    if (registros.length > 0 && typeof callbackRender === 'function') {
        callbackRender(registros);
    }

    const hayConexion = await validarConexionRed();
    if (hayConexion && APP_CONFIG && APP_CONFIG.URL_API) {
        try {
            const response = await fetch(`${APP_CONFIG.URL_API}?action=OBTENER_TODOS`);
            if (response.ok) {
                const datosServidor = await response.json();
                localStorage.setItem(CACHE_KEY, JSON.stringify(datosServidor));
                if (typeof guardarMantenimientosLocalSeguro === 'function') {
                    await guardarMantenimientosLocalSeguro(datosServidor);
                }
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
// 7. GESTIÓN DE COLA OFFLINE Y SINCRONIZACIÓN UNIFICADA
// ==========================================

function encolarOperacionOffline(accion, payload, key = SYNC_QUEUE_KEY) {
    let queue = JSON.parse(localStorage.getItem(key) || '[]');
    queue.push({
        idSync: Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        accion: accion,
        payload: payload,
        timestamp: new Date().toISOString()
    });
    localStorage.setItem(key, JSON.stringify(queue));
    if (typeof encolarOfflineSeguro === 'function') {
        encolarOfflineSeguro(accion, payload).catch(() => {});
    }
    console.warn(`[Offline Queue] Operación '${accion}' guardada en cola local.`);
}

/**
 * Validador universal de estado de red (Capacitor Nativo / Web API)
 */
async function validarConexionRed() {
    if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Network')) {
        try {
            const status = await Capacitor.Plugins.Network.getStatus();
            return status.connected;
        } catch (e) {
            return navigator.onLine;
        }
    }
    return navigator.onLine;
}

async function procesarSincronizacionPendiente(key = SYNC_QUEUE_KEY) {
    const hayConexion = await validarConexionRed();
    if (!hayConexion || !APP_CONFIG || !APP_CONFIG.URL_API) return;

    let queue = JSON.parse(localStorage.getItem(key) || '[]');
    if (queue.length === 0) return;

    console.log(`[Sync] Procesando ${queue.length} operaciones pendientes para ${key}...`);
    
    let pendienteSincronizar = [...queue];

    for (const item of queue) {
        try {
            const payloadConToken = Object.assign({}, item.payload, { token: obtenerTokenSesion() });

            const response = await fetch(APP_CONFIG.URL_API, {
                method: 'POST',
                body: JSON.stringify(payloadConToken)
            });

            if (response.ok) {
                const res = await response.json();
                if (res.status === 'SUCCESS') {
                    pendienteSincronizar = pendienteSincronizar.filter(q => q.idSync !== item.idSync);
                    localStorage.setItem(key, JSON.stringify(pendienteSincronizar));
                    console.log(`[Sync Exitoso] Registro ${item.idSync} sincronizado.`);
                } else {
                    console.warn('[Sync] Servidor devolvió error:', res.message);
                    break;
                }
            } else {
                console.warn('[Sync] Servidor devolvió respuesta no OK.');
                break;
            }
        } catch (error) {
            console.error('[Sync] Error de red durante la sincronización:', error);
            break;
        }
    }

    if (pendienteSincronizar.length === 0) {
        console.log('[Sync Complete] Todos los registros locales están en la nube.');
        mostrarNotificacion('Sincronización con la nube completada.', 'exito');
    }
}


// ==========================================
// 8. INICIALIZACIÓN DE EVENTOS Y DETECCIÓN DE RED
// ==========================================

function inicializarMonitoreoRed() {
    if (window.Capacitor && window.Capacitor.isPluginAvailable && window.Capacitor.isPluginAvailable('Network')) {
        const { Network } = Capacitor.Plugins;

        Network.addListener('networkStatusChange', status => {
            if (status.connected) {
                console.log('[Red Nativa] Conexión restablecida.');
                mostrarNotificacion('Conexión restablecida. Sincronizando datos...', 'exito');
                procesarSincronizacionPendiente();
            } else {
                console.warn('[Red Nativa] Conexión perdida. Operando en modo Offline.');
                mostrarNotificacion('Modo sin conexión activo. Los cambios se guardarán localmente.', 'advertencia');
            }
        });
    } else {
        window.addEventListener('online', () => {
            console.log('[Red Web] Conexión restablecida.');
            mostrarNotificacion('Conexión restablecida. Sincronizando datos...', 'exito');
            procesarSincronizacionPendiente();
        });

        window.addEventListener('offline', () => {
            console.warn('[Red Web] Conexión perdida. Operando en modo Offline.');
            mostrarNotificacion('Modo sin conexión activo. Los cambios se guardarán localmente.', 'advertencia');
        });
    }
}

// Inicialización de la aplicación al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    inicializarMonitoreoRed();
    procesarSincronizacionPendiente();
});

// Service Worker condicional exclusivo para navegadores Web (se omite en APK nativa)
if ('serviceWorker' in navigator && (!window.Capacitor || !window.Capacitor.isNativePlatform())) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registrado correctamente con alcance:', reg.scope))
            .catch(err => console.error('Error al registrar Service Worker:', err));
    });
}
