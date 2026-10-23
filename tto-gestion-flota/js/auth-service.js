/**
 * SIAGOP System - Service de Autenticación, Licencia y Persistencia Multi-Tenant
 * js/auth-service.js
 */
"use strict";

(function () {
    const LICENCIA_CODIGO_KEY = 'siagop_licencia_codigo';
    const ORG_ID_KEY = 'siagop_user_org_id';
    const ORG_NOMBRE_KEY = 'organizacion_nombre';

    const USER_ID_KEY = 'siagop_user_id';
    const USER_ROL_KEY = 'siagop_user_rol';
    const USER_MODULO_KEY = 'siagop_user_modulo';
    const USER_NAME_KEY = 'siagop_user_nombre';

    function obtenerLicenciaActiva() {
        const codigo = localStorage.getItem(LICENCIA_CODIGO_KEY) || '';
        const orgId = localStorage.getItem(ORG_ID_KEY) || '';
        const orgNombre = localStorage.getItem(ORG_NOMBRE_KEY) || '';
        return { codigo, orgId, orgNombre, tieneLicencia: Boolean(codigo && orgId) };
    }

    async function validarYGuardarLicencia(codigo) {
        if (!codigo || !codigo.trim()) {
            return { exito: false, mensaje: 'Ingrese el código de organización.' };
        }

        const cleanCodigo = codigo.trim().toUpperCase();
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;

        if (!navigator.onLine || !client) {
            // Fallback offline si ya existía la licencia
            const actual = obtenerLicenciaActiva();
            if (actual.codigo === cleanCodigo) {
                return { exito: true, orgId: actual.orgId, orgNombre: actual.orgNombre };
            }
            return { exito: false, mensaje: 'Se requiere conexión a Internet para validar una nueva licencia.' };
        }

        try {
            const { data, error } = await client.from('organizaciones')
                .select('id, codigo_interno, activo, estado_pago, fecha_vencimiento, nombre')
                .eq('codigo_interno', cleanCodigo)
                .maybeSingle();

            if (error) {
                console.error('[AuthService] Error consultando organizacion:', error);
                return { exito: false, mensaje: 'Error al consultar la organización en Supabase.' };
            }

            if (!data) {
                return { exito: false, mensaje: 'Código de organización no encontrado o inválido.' };
            }

            if (data.activo === false) {
                return { exito: false, mensaje: 'La organización se encuentra inactiva o suspendida.' };
            }

            const orgId = data.id;
            const orgNombre = data.nombre || cleanCodigo;

            localStorage.setItem(LICENCIA_CODIGO_KEY, cleanCodigo);
            localStorage.setItem(ORG_ID_KEY, orgId);
            localStorage.setItem(ORG_NOMBRE_KEY, orgNombre);

            sessionStorage.setItem('SIAGOP_USER_ORG_ID', orgId);
            sessionStorage.setItem('SIAGOP_ORG_NOMBRE', orgNombre);

            return { exito: true, orgId, orgNombre, data };
        } catch (e) {
            console.error('[AuthService] Excepción validando licencia:', e);
            return { exito: false, mensaje: 'Excepción interna validando la licencia.' };
        }
    }

    function obtenerSesionUsuario() {
        const userId = localStorage.getItem(USER_ID_KEY) || sessionStorage.getItem('SIAGOP_USER_ID') || '';
        const token = sessionStorage.getItem('SIAGOP_SESSION_TOKEN') || (userId ? `tok-local-${userId}` : '');
        const rol = localStorage.getItem(USER_ROL_KEY) || sessionStorage.getItem('SIAGOP_ROL') || '';
        const modulo = localStorage.getItem(USER_MODULO_KEY) || sessionStorage.getItem('SIAGOP_MODULO') || '';
        const nombre = localStorage.getItem(USER_NAME_KEY) || sessionStorage.getItem('SIAGOP_OPERADOR') || '';

        const tieneSesion = Boolean(userId && token);
        return { userId, token, rol, modulo, nombre, tieneSesion };
    }

    async function iniciarSesionUsuario(usuario, password) {
        const { orgId } = obtenerLicenciaActiva();
        if (!orgId) {
            return { exito: false, mensaje: 'No hay una licencia de organización activa.' };
        }

        const usernameClean = String(usuario || '').trim().toUpperCase();
        const passClean = String(password || '').trim();

        if (!usernameClean || !passClean) {
            return { exito: false, mensaje: 'Ingrese usuario y contraseña.' };
        }

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;

        if (navigator.onLine && client) {
            try {
                const { data, error } = await client.from('usuarios')
                    .select('id, usuario, nombre_completo, password_plain, rol_id, modulo, activo, organizacion_id')
                    .eq('usuario', usernameClean)
                    .eq('organizacion_id', orgId)
                    .maybeSingle();

                if (error) {
                    console.error('[AuthService] Error consultando usuario:', error);
                } else if (data) {
                    if (!data.activo) {
                        return { exito: false, mensaje: 'El usuario se encuentra inactivo o bloqueado.' };
                    }

                    if (String(data.password_plain || '').trim() === passClean) {
                        guardarSesionLocal(data);
                        return { exito: true, usuario: data };
                    } else {
                        return { exito: false, mensaje: 'Contraseña incorrecta.' };
                    }
                }
            } catch (e) {
                console.warn('[AuthService] Excepción autenticando usuario en línea:', e);
            }
        }

        // Fallback local/offline
        try {
            const cachedRaw = localStorage.getItem('SIAGOP_USUARIOS_CACHE');
            if (cachedRaw) {
                const cachedUsers = JSON.parse(cachedRaw);
                const matchUser = cachedUsers.find(u =>
                    String(u.usuario || '').toUpperCase().trim() === usernameClean &&
                    (!u.organizacion_id || String(u.organizacion_id) === String(orgId))
                );

                if (matchUser) {
                    if (!matchUser.activo) {
                        return { exito: false, mensaje: 'El usuario se encuentra inactivo o bloqueado.' };
                    }
                    if (String(matchUser.password_plain || '').trim() === passClean) {
                        guardarSesionLocal(matchUser);
                        return { exito: true, usuario: matchUser };
                    } else {
                        return { exito: false, mensaje: 'Contraseña incorrecta.' };
                    }
                }
            }
        } catch (eOff) {}

        return { exito: false, mensaje: 'Usuario no registrado o credenciales incorrectas para la organización.' };
    }

    function guardarSesionLocal(usr) {
        const userId = usr.id || `usr-${Date.now()}`;
        const userRol = usr.rol_id || 'operador_talleres';
        const userMod = usr.modulo || 'TODOS';
        const userName = usr.nombre_completo || usr.usuario;

        localStorage.setItem(USER_ID_KEY, userId);
        localStorage.setItem(USER_ROL_KEY, userRol);
        localStorage.setItem(USER_MODULO_KEY, userMod);
        localStorage.setItem(USER_NAME_KEY, userName);

        const sessionTok = 'tok-' + Date.now();
        sessionStorage.setItem('SIAGOP_SESSION_TOKEN', sessionTok);
        sessionStorage.setItem('SIAGOP_OPERADOR', userName);
        sessionStorage.setItem('SIAGOP_ROL', userRol);
        sessionStorage.setItem('SIAGOP_MODULO', userMod);
        sessionStorage.setItem('SIAGOP_USER_ID', userId);
    }

    function cerrarSesionUsuario() {
        // Borra la sesión del usuario pero CONSERVA la licencia (codigo_interno / organizacion_id)
        localStorage.removeItem(USER_ID_KEY);
        localStorage.removeItem(USER_ROL_KEY);
        localStorage.removeItem(USER_MODULO_KEY);
        localStorage.removeItem(USER_NAME_KEY);

        sessionStorage.clear();

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { client.auth.signOut(); } catch (e) {}
        }
    }

    function desvincularLicencia() {
        // Borra la sesión del usuario Y la licencia de la organización
        localStorage.clear();
        sessionStorage.clear();

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { client.auth.signOut(); } catch (e) {}
        }
    }

    window.SIAGOP_AUTH_SERVICE = {
        obtenerLicenciaActiva,
        validarYGuardarLicencia,
        obtenerSesionUsuario,
        iniciarSesionUsuario,
        cerrarSesionUsuario,
        desvincularLicencia
    };
})();
