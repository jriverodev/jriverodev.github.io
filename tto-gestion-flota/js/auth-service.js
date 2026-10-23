/**
 * SIAGOP System - Service de Autenticación Nativa Supabase Auth, Licencia y Persistencia Multi-Tenant
 * js/auth-service.js
 */
"use strict";

(function () {
    const TTO_ORG_LICENSE_KEY = 'tto_org_license';
    const LEGACY_LICENCIA_CODIGO_KEY = 'siagop_licencia_codigo';
    const LEGACY_ORG_ID_KEY = 'siagop_user_org_id';
    const LEGACY_ORG_NOMBRE_KEY = 'organizacion_nombre';

    const USER_ID_KEY = 'siagop_user_id';
    const USER_ROL_KEY = 'siagop_user_rol';
    const USER_MODULO_KEY = 'siagop_user_modulo';
    const USER_NAME_KEY = 'siagop_user_nombre';

    function obtenerLicenciaActiva() {
        let licenseData = null;
        try {
            const raw = localStorage.getItem(TTO_ORG_LICENSE_KEY);
            if (raw) licenseData = JSON.parse(raw);
        } catch (e) {}

        const codigo = (licenseData && licenseData.codigo) || localStorage.getItem(LEGACY_LICENCIA_CODIGO_KEY) || '';
        const orgId = (licenseData && licenseData.orgId) || localStorage.getItem(LEGACY_ORG_ID_KEY) || '';
        const orgNombre = (licenseData && licenseData.orgNombre) || localStorage.getItem(LEGACY_ORG_NOMBRE_KEY) || '';

        return { codigo, orgId, orgNombre, tieneLicencia: Boolean(codigo && orgId) };
    }

    async function validarYGuardarLicencia(codigo) {
        if (!codigo || !codigo.trim()) {
            return { exito: false, mensaje: 'Ingrese el código de organización.' };
        }

        const cleanCodigo = codigo.trim().toUpperCase();
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;

        if (!navigator.onLine || !client) {
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

            const licensePayload = { codigo: cleanCodigo, orgId, orgNombre };
            localStorage.setItem(TTO_ORG_LICENSE_KEY, JSON.stringify(licensePayload));

            // Legacy keys for backward compatibility
            localStorage.setItem(LEGACY_LICENCIA_CODIGO_KEY, cleanCodigo);
            localStorage.setItem(LEGACY_ORG_ID_KEY, orgId);
            localStorage.setItem(LEGACY_ORG_NOMBRE_KEY, orgNombre);

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
            return { exito: false, mensaje: 'No hay una licencia de organización activa en el dispositivo.' };
        }

        const usernameClean = String(usuario || '').trim().toUpperCase();
        const passClean = String(password || '').trim();

        if (!usernameClean || !passClean) {
            return { exito: false, mensaje: 'Ingrese usuario y contraseña.' };
        }

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;

        if (navigator.onLine && client) {
            try {
                // Mapear nombre de usuario a correo para Supabase Auth nativo
                const authEmail = `${usernameClean.toLowerCase()}@tto-fleet.local`;

                // 1. Intentar inicio de sesión con Supabase Auth Nativo
                let authUser = null;
                let authError = null;

                if (client.auth && typeof client.auth.signInWithPassword === 'function') {
                    const authRes = await client.auth.signInWithPassword({
                        email: authEmail,
                        password: passClean
                    });
                    authError = authRes.error;
                    authUser = authRes.data?.user || null;
                }

                // 2. Consultar perfil en public.usuarios
                let query = client.from('usuarios')
                    .select('id, usuario, nombre_completo, rol_id, modulo, activo, organizacion_id, password_plain');

                if (authUser && authUser.id) {
                    query = query.eq('id', authUser.id);
                } else {
                    query = query.eq('usuario', usernameClean);
                }

                const { data: perfil, error: profileErr } = await query.eq('organizacion_id', orgId).maybeSingle();

                if (profileErr) {
                    console.error('[AuthService] Error consultando perfil de usuario:', profileErr);
                }

                if (perfil) {
                    if (!perfil.activo) {
                        return { exito: false, mensaje: 'El usuario se encuentra inactivo o bloqueado.' };
                    }

                    // Si Supabase Auth tuvo éxito o si la contraseña coincide con password_plain (compatibilidad)
                    const passMatches = !authError || (perfil.password_plain && String(perfil.password_plain).trim() === passClean);

                    if (passMatches) {
                        guardarSesionLocal(perfil);
                        return { exito: true, usuario: perfil };
                    } else {
                        return { exito: false, mensaje: 'Contraseña incorrecta.' };
                    }
                } else if (authError) {
                    return { exito: false, mensaje: 'Credenciales incorrectas o usuario no registrado para esta organización.' };
                }
            } catch (e) {
                console.warn('[AuthService] Excepción autenticando con Supabase Auth:', e);
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

    async function cerrarSesionUsuario() {
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        // Borra únicamente las claves de sesión del usuario
        localStorage.removeItem(USER_ID_KEY);
        localStorage.removeItem(USER_ROL_KEY);
        localStorage.removeItem(USER_MODULO_KEY);
        localStorage.removeItem(USER_NAME_KEY);

        sessionStorage.clear();
    }

    async function desvincularLicencia() {
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        // Borra tanto la sesión de usuario como la licencia de organización
        localStorage.removeItem(TTO_ORG_LICENSE_KEY);
        localStorage.removeItem(LEGACY_LICENCIA_CODIGO_KEY);
        localStorage.removeItem(LEGACY_ORG_ID_KEY);
        localStorage.removeItem(LEGACY_ORG_NOMBRE_KEY);

        localStorage.removeItem(USER_ID_KEY);
        localStorage.removeItem(USER_ROL_KEY);
        localStorage.removeItem(USER_MODULO_KEY);
        localStorage.removeItem(USER_NAME_KEY);

        localStorage.clear();
        sessionStorage.clear();
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
