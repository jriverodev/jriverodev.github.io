/**
 * TTOCC - Gestión de Flota
 * app.js - Lógica Global, Utilidades, Sanitización XSS, Gestión de Sesión, Debounce y Sincronización Cifrada
 */
"use strict";

// ==========================================
// 1. CONFIGURACIÓN GLOBAL Y SERVIDOR
// ==========================================

const APP_CONFIG = {
    URL_API: "https://script.google.com/macros/s/AKfycbzBfFYRZVu2Q3BKQDJ-EfnL1jtpEx2zFK3hgfgdugumIke6Lh4SUfCxsqynuHd2s6R3jw/exec",
    SUPABASE_URL: window.TTOCC_SUPABASE_URL || "https://mfklcwrpgavaxznkxlra.supabase.co",
    SUPABASE_ANON_KEY: window.TTOCC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ma2xjd3JwZ2F2YXh6bmt4bHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODUzNjgsImV4cCI6MjA4MDg2MTM2OH0.2xHgsM4F3X0vw05PgVhpMF11w1lU6zT21cp6MlE5gNY",
    TABLES: {
        registros: "historial_mantenimiento",
        mantenimientos: "historial_mantenimiento",
        activos: "maestro_activos",
        colaOffline: "colaOffline"
    }
};

function isSupabaseConfigured() {
    return Boolean(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY && window.supabase);
}

function ensureSupabaseClient() {
    if (window.TTOCC_SUPABASE_CLIENT) {
        return window.TTOCC_SUPABASE_CLIENT;
    }

    if (!APP_CONFIG.SUPABASE_URL || !APP_CONFIG.SUPABASE_ANON_KEY) {
        return null;
    }

    if (window.supabase && typeof window.supabase.createClient === 'function') {
        window.TTOCC_SUPABASE_CLIENT = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
        return window.TTOCC_SUPABASE_CLIENT;
    }

    const scriptTag = document.createElement('script');
    scriptTag.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    scriptTag.async = true;
    scriptTag.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            window.TTOCC_SUPABASE_CLIENT = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
        }
    };
    document.head.appendChild(scriptTag);
    return null;
}

function toJsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

async function readLocalTable(tableName) {
    if (typeof leerRegistrosLocales === 'function') {
        const rows = await leerRegistrosLocales(tableName);
        if (rows && rows.length > 0) return rows;
    }

    if (typeof dbTTOCC !== 'undefined' && dbTTOCC && dbTTOCC.table) {
        try {
            if (dbTTOCC.tables.some(t => t.name === tableName)) {
                return await dbTTOCC.table(tableName).toArray();
            }
            // Fallback aliases if version migration hasn't run yet
            const alias = tableName === 'historial_mantenimiento' ? 'mantenimientos' : (tableName === 'maestro_activos' ? 'activos' : null);
            if (alias && dbTTOCC.tables.some(t => t.name === alias)) {
                return await dbTTOCC.table(alias).toArray();
            }
        } catch (error) {
            console.warn('[Dexie] Error leyendo tabla local:', tableName, error);
        }
    }

    return [];
}

async function handleLocalApiGateway(payload) {
    const accion = payload && (payload.accion || payload.action);
    const token = payload && payload.token;

    if (accion === 'login') {
        if (payload && payload.usuario) {
            sessionStorage.setItem(OPERADOR_KEY, payload.usuario);
            sessionStorage.setItem(SESSION_TOKEN_KEY, token || 'local-demo-token');
            return toJsonResponse({
                status: 'SUCCESS',
                token: token || 'local-demo-token',
                usuario: payload.usuario,
                message: 'Sesión local creada.'
            });
        }
        return toJsonResponse({ status: 'ERROR', message: 'Faltan credenciales.' }, 401);
    }

    if (accion === 'validar_token') {
        const storedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
        const storedUser = sessionStorage.getItem(OPERADOR_KEY) || '';
        return toJsonResponse({
            status: 'SUCCESS',
            valido: Boolean(storedToken && storedToken === (token || storedToken)),
            usuario: storedUser
        });
    }

    if (accion === 'leer') {
        const client = ensureSupabaseClient();
        if (navigator.onLine && client) {
            try {
                const { data, error } = await client.from('historial_mantenimiento').select('*');
                if (!error && Array.isArray(data)) {
                    if (typeof guardarMantenimientosLocalSeguro === 'function') {
                        await guardarMantenimientosLocalSeguro(data);
                    }
                    return toJsonResponse({ status: 'SUCCESS', datos: data });
                }
            } catch (e) {
                console.warn('[Supabase] Error leyendo historial_mantenimiento en vivo:', e);
            }
        }
        const registros = await readLocalTable(APP_CONFIG.TABLES.registros);
        return toJsonResponse({ status: 'SUCCESS', datos: registros });
    }

    if (accion === 'leer_activos') {
        const client = ensureSupabaseClient();
        if (navigator.onLine && client) {
            try {
                const { data, error } = await client.from('maestro_activos').select('*');
                if (!error && Array.isArray(data)) {
                    if (typeof guardarActivosLocalSeguro === 'function') {
                        await guardarActivosLocalSeguro(data);
                    }
                    return toJsonResponse({ status: 'SUCCESS', datos: data });
                }
            } catch (e) {
                console.warn('[Supabase] Error leyendo maestro_activos en vivo:', e);
            }
        }
        const registros = await readLocalTable(APP_CONFIG.TABLES.activos);
        return toJsonResponse({ status: 'SUCCESS', datos: registros });
    }

    if (accion === 'crear' || accion === 'editar') {
        const tableName = APP_CONFIG.TABLES.registros;
        const id = payload.id_registro || payload.id || payload.ID_Registro || generarIdCliente();
        let registro = {
            ...payload,
            id: String(id),
            id_unidad: payload.id_unidad || payload.unidad || payload.ID_Unidad || '',
            sync_status: 'pending',
            updated_at: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        const client = ensureSupabaseClient();
        if (navigator.onLine && client) {
            try {
                // If editing, try fetching existing record from Supabase to preserve fields not sent
                let recordExistente = {};
                if (accion === 'editar') {
                    try {
                        const { data: fetchOld } = await client.from('historial_mantenimiento').select('*').eq('id', String(id)).single();
                        if (fetchOld) recordExistente = fetchOld;
                    } catch (eOld) {}
                }

                let payloadRemoto = { ...recordExistente, ...registro };
                if (window.TTOCC_SUPABASE_SYNC && typeof window.TTOCC_SUPABASE_SYNC.prepareRecordAssets === 'function') {
                    payloadRemoto = await window.TTOCC_SUPABASE_SYNC.prepareRecordAssets(client, 'ttocc-archivos', payloadRemoto, String(id));
                }

                // Field aliases mapping for Postgres schema
                if (payloadRemoto.flota && !payloadRemoto.tipo_flota) payloadRemoto.tipo_flota = payloadRemoto.flota;
                if (payloadRemoto.nombre_taller_ext && !payloadRemoto.taller_ext) payloadRemoto.taller_ext = payloadRemoto.nombre_taller_ext;
                if (payloadRemoto.unidad && !payloadRemoto.id_unidad) payloadRemoto.id_unidad = payloadRemoto.unidad;

                // Type conversions
                if (payloadRemoto.avance !== undefined && payloadRemoto.avance !== null) {
                    payloadRemoto.avance = parseInt(payloadRemoto.avance, 10) || 0;
                }
                if (payloadRemoto.anio !== undefined && payloadRemoto.anio !== null) {
                    payloadRemoto.anio = parseInt(payloadRemoto.anio, 10) || null;
                }

                // Tareas JSON parsing if string
                if (typeof payloadRemoto.tareas === 'string') {
                    try { payloadRemoto.tareas = JSON.parse(payloadRemoto.tareas); } catch (eJson) {}
                }

                // Date formatting to ISO string
                if (payloadRemoto.fecha_ingreso) {
                    payloadRemoto.fecha_ingreso = parseCustomDateToISO(payloadRemoto.fecha_ingreso) || payloadRemoto.fecha_ingreso;
                }
                if (payloadRemoto.fecha_salida) {
                    payloadRemoto.fecha_salida = parseCustomDateToISO(payloadRemoto.fecha_salida) || payloadRemoto.fecha_salida;
                }

                // Whitelist valid columns in historial_mantenimiento table
                const columnasPermitidas = [
                    'id', 'id_unidad', 'tipo_flota', 'nombre_taller', 'taller_ext', 'estatus',
                    'observaciones', 'marca', 'modelo', 'color', 'anio', 'vin', 'tipo_vehiculo',
                    'avance', 'foto_antes', 'foto_despues', 'fecha_ingreso', 'fecha_salida',
                    'gerencia', 'usuario', 'cargo_usuario', 'tareas', 'modificado_por', 'metadata', 'updated_at'
                ];

                const recordSanitizado = {};
                for (const col of columnasPermitidas) {
                    if (payloadRemoto[col] !== undefined && payloadRemoto[col] !== null) {
                        recordSanitizado[col] = payloadRemoto[col];
                    }
                }
                recordSanitizado.id = String(id);
                recordSanitizado.updated_at = new Date().toISOString();

                const { error, data } = await client.from('historial_mantenimiento').upsert(recordSanitizado, { onConflict: 'id' }).select();
                if (!error) {
                    registro.sync_status = 'synced';
                    if (typeof persistirRegistroLocal === 'function') {
                        await persistirRegistroLocal(tableName, registro);
                    }

                    // Update maestro_activos's ubicacion_taller and ubicacion_taller_fecha for this id_unidad
                    const idUnidadRef = String(recordSanitizado.id_unidad || '').trim();
                    if (idUnidadRef) {
                        try {
                            const tallerNombre = recordSanitizado.nombre_taller === "TALLER EXTERNO (Terceros)" && recordSanitizado.taller_ext
                                ? `EXT: ${recordSanitizado.taller_ext}`
                                : recordSanitizado.nombre_taller;
                            await client.from('maestro_activos').update({
                                ubicacion_taller: tallerNombre || 'Taller',
                                ubicacion_taller_fecha: recordSanitizado.fecha_ingreso || new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }).eq('id_unidad', idUnidadRef);
                        } catch (eActivo) {
                            console.warn('[Supabase] No se pudo actualizar maestro_activos desde taller:', eActivo);
                        }
                    }

                    return toJsonResponse({ status: 'SUCCESS', message: 'Registro guardado y sincronizado en Supabase.', datos: data || [registro] });
                } else {
                    console.warn('[Supabase] Error en upsert live crear/editar:', error);
                }
            } catch (e) {
                console.warn('[Supabase] Excepción en guardar live:', e);
            }
        }

        if (typeof persistirRegistroLocal === 'function') {
            await persistirRegistroLocal(tableName, registro);
        }
        return toJsonResponse({ status: 'SUCCESS', message: 'Registro guardado localmente (pendiente de sync).', datos: [registro] });
    }

    if (accion === 'eliminar') {
        const id = payload.id_registro || payload.id;
        const client = ensureSupabaseClient();
        if (navigator.onLine && client && id) {
            try {
                await client.from('historial_mantenimiento').delete().eq('id', String(id));
            } catch (e) {
                console.warn('[Supabase] Error eliminando en Supabase:', e);
            }
        }
        if (typeof eliminarRegistroLocal === 'function') {
            await eliminarRegistroLocal(APP_CONFIG.TABLES.registros, id);
        }
        return toJsonResponse({ status: 'SUCCESS', message: 'Registro eliminado.' });
    }

    if (accion === 'crear_activo' || accion === 'editar_activo') {
        const tableName = APP_CONFIG.TABLES.activos;
        const idUnidad = payload.id_unidad || payload.id || payload.ID_Unidad || generarIdCliente();
        let registro = {
            ...payload,
            id: String(idUnidad),
            id_unidad: String(idUnidad),
            sync_status: 'pending',
            updated_at: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        const client = ensureSupabaseClient();
        if (navigator.onLine && client) {
            try {
                // If editing, try fetching existing record from Supabase to preserve fields not sent
                let recordExistente = {};
                if (accion === 'editar_activo') {
                    try {
                        const { data: fetchOld } = await client.from('maestro_activos').select('*').eq('id_unidad', String(idUnidad)).single();
                        if (fetchOld) recordExistente = fetchOld;
                    } catch (eOld) {}
                }

                let payloadRemoto = { ...recordExistente, ...registro };
                if (window.TTOCC_SUPABASE_SYNC && typeof window.TTOCC_SUPABASE_SYNC.prepareRecordAssets === 'function') {
                    payloadRemoto = await window.TTOCC_SUPABASE_SYNC.prepareRecordAssets(client, 'ttocc-archivos', payloadRemoto, String(idUnidad));
                }

                // Map field names for maestro_activos PostgreSQL schema
                if (payloadRemoto.flota && !payloadRemoto.tipo_flota) payloadRemoto.tipo_flota = payloadRemoto.flota;

                // Type conversions
                if (payloadRemoto.anio !== undefined && payloadRemoto.anio !== null) {
                    payloadRemoto.anio = parseInt(payloadRemoto.anio, 10) || null;
                }

                // Date formatting to ISO
                if (payloadRemoto.ubicacion_taller_fecha) {
                    payloadRemoto.ubicacion_taller_fecha = parseCustomDateToISO(payloadRemoto.ubicacion_taller_fecha) || payloadRemoto.ubicacion_taller_fecha;
                }

                // Whitelist valid columns in maestro_activos table
                const columnasPermitidasActivos = [
                    'id_unidad', 'placa', 'vin', 'marca', 'modelo', 'anio', 'color',
                    'tipo_vehiculo', 'tipo_flota', 'estatus_final', 'situacion_actual',
                    'gerencia', 'responsable_usuario', 'cargo_usuario', 'ubicacion_taller',
                    'ubicacion_taller_fecha', 'documento_url', 'documento_nombre', 'metadata', 'updated_at'
                ];

                const recordSanitizado = {};
                for (const col of columnasPermitidasActivos) {
                    if (payloadRemoto[col] !== undefined && payloadRemoto[col] !== null) {
                        recordSanitizado[col] = payloadRemoto[col];
                    }
                }
                recordSanitizado.id_unidad = String(idUnidad);
                recordSanitizado.updated_at = new Date().toISOString();

                const { error, data } = await client.from('maestro_activos').upsert(recordSanitizado, { onConflict: 'id_unidad' }).select();
                if (!error) {
                    registro.sync_status = 'synced';
                    if (typeof persistirRegistroLocal === 'function') {
                        await persistirRegistroLocal(tableName, registro);
                    }
                    return toJsonResponse({ status: 'SUCCESS', message: 'Activo guardado y sincronizado en Supabase.', datos: data || [registro] });
                } else {
                    console.warn('[Supabase] Error en upsert live activo:', error);
                }
            } catch (e) {
                console.warn('[Supabase] Excepción en guardar activo live:', e);
            }
        }

        if (typeof persistirRegistroLocal === 'function') {
            await persistirRegistroLocal(tableName, registro);
        }
        return toJsonResponse({ status: 'SUCCESS', message: 'Activo guardado localmente (pendiente de sync).', datos: [registro] });
    }

    if (accion === 'eliminar_activo') {
        const idUnidad = payload.id_unidad || payload.id;
        const client = ensureSupabaseClient();
        if (navigator.onLine && client && idUnidad) {
            try {
                await client.from('maestro_activos').delete().eq('id_unidad', String(idUnidad));
            } catch (e) {
                console.warn('[Supabase] Error eliminando activo en Supabase:', e);
            }
        }
        if (typeof eliminarRegistroLocal === 'function') {
            await eliminarRegistroLocal(APP_CONFIG.TABLES.activos, idUnidad);
        }
        return toJsonResponse({ status: 'SUCCESS', message: 'Activo eliminado.' });
    }

    return toJsonResponse({ status: 'ERROR', message: 'Acción no soportada en modo offline-first.' }, 400);
}

const originalFetch = window.fetch ? window.fetch.bind(window) : null;
if (originalFetch) {
    window.fetch = async function(input, init = {}) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const bodyText = typeof init.body === 'string' ? init.body : (typeof input === 'object' && input && typeof input.body === 'string' ? input.body : '');
        let parsedBody = null;

        if (bodyText) {
            try {
                parsedBody = JSON.parse(bodyText);
            } catch (error) {
                parsedBody = null;
            }
        }

        const isApiRequest = Boolean(
            url && (
                url === APP_CONFIG.URL_API ||
                url.includes('script.google.com') ||
                (parsedBody && (parsedBody.accion || parsedBody.action))
            )
        );

        if (isApiRequest && parsedBody && (parsedBody.accion || parsedBody.action)) {
            return handleLocalApiGateway(parsedBody);
        }

        return originalFetch(input, init);
    };
}

async function syncData() {
    if (!dbTTOCC || !navigator.onLine) {
        return false;
    }

    const supabaseClient = ensureSupabaseClient();
    if (!supabaseClient) {
        return false;
    }

    const tables = Object.keys(APP_CONFIG.TABLES).filter((key) => key !== 'colaOffline');
    for (const key of tables) {
        const tableName = APP_CONFIG.TABLES[key];
        const rows = await dbTTOCC.table(tableName).where('sync_status').equals('pending').toArray();
        if (!rows.length) continue;

        const payload = rows.map((row) => ({
            ...row,
            id: String(row.id || row.ID_Registro || row.id_registro || generarIdCliente()),
            updated_at: new Date().toISOString(),
            sync_status: 'synced'
        }));

            // Prefer using the optional helper that uploads images to Storage then upserts
            if (window.TTOCC_SUPABASE_SYNC && typeof window.TTOCC_SUPABASE_SYNC.syncAndUpsert === 'function') {
                const res = await window.TTOCC_SUPABASE_SYNC.syncAndUpsert(tableName, payload, { bucket: 'ttocc-archivos' });
                if (res.error) {
                    console.warn('[Supabase] Error sincronizando tabla via TTOCC_SUPABASE_SYNC:', tableName, res.error);
                    return false;
                }
                const rows = res.data || payload;
                for (const item of rows) {
                    await marcarRegistroSincronizado(tableName, item.id || item.ID_Registro || item.id_registro);
                }
            } else {
                const { error, data } = await supabaseClient.from(tableName).upsert(payload, { onConflict: 'id' }).select();
                if (error) {
                    console.warn('[Supabase] Error sincronizando tabla:', tableName, error);
                    return false;
                }

                for (const item of data || payload) {
                    await marcarRegistroSincronizado(tableName, item.id || item.ID_Registro || item.id_registro);
                }
            }
        }

        return true;
}

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

function parseCustomDateToISO(str) {
    if (!str || typeof str !== 'string' || !str.trim()) return null;
    const cleanStr = str.trim();
    // DD-MM-YYYY HH:mm:ss or DD-MM-YYYY HH:mm or DD-MM-YYYY
    const ddmmyyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10) - 1;
        const year = parseInt(ddmmyyyy[3], 10);
        const hour = parseInt(ddmmyyyy[4] || '0', 10);
        const min = parseInt(ddmmyyyy[5] || '0', 10);
        const sec = parseInt(ddmmyyyy[6] || '0', 10);
        const d = new Date(Date.UTC(year, month, day, hour, min, sec));
        return d.toISOString();
    }
    const isoDate = new Date(cleanStr);
    if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString();
    }
    return null;
}

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
    if (!hayConexion) return;

    const sincronizado = await syncData();
    if (sincronizado) {
        console.log('[Sync Complete] Todos los registros locales están sincronizados en Supabase.');
        mostrarNotificacion('Sincronización con la nube completada.', 'exito');
    }

    if (!APP_CONFIG || !APP_CONFIG.URL_API) return;

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
