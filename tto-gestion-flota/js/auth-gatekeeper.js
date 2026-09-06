/**
 * SIAGOP System - Gatekeeper Access Control & Session Manager
 * js/auth-gatekeeper.js - Control de acceso de 2 niveles y persistencia de sesión.
 */
"use strict";

(function () {
    const ORG_NOMBRE_KEY = 'SIAGOP_ORG_NOMBRE';
    const USER_ID_KEY = 'SIAGOP_USER_ID';

    /**
     * Nivel 1: Verificación de acceso global.
     * Revisa la sesión persistente en Supabase/localStorage al cargar la página.
     */
    async function verificarAccesoGlobal() {
        const paginaActual = window.location.pathname.split('/').pop() || 'index.html';
        if (paginaActual === 'registro-organizacion.html') return;

        const client = (typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null) ||
                       (window.SIAGOP_SG && window.SIAGOP_SG.ensureSupabaseClient ? window.SIAGOP_SG.ensureSupabaseClient() : null);

        let session = null;

        if (client && client.auth && typeof client.auth.getSession === 'function') {
            try {
                const { data } = await client.auth.getSession();
                session = data?.session || null;
            } catch (e) {
                console.warn('[Gatekeeper] Error obteniendo sesión de Supabase:', e);
            }
        }

        // Fallback local en localStorage si la app está offline
        const localUserId = localStorage.getItem('siagop_user_id') || sessionStorage.getItem(USER_ID_KEY);

        // SI NO HAY SESIÓN Y NO ESTÁ EN EL LOGIN/DESTINO PÚBLICO
        if (!session && !localUserId && paginaActual !== 'index.html' && paginaActual !== '') {
            document.body.style.display = 'none';
            window.location.href = 'index.html';
            return;
        }

        // SI HAY SESIÓN ACTIVA Y ESTÁ EN INDEX.HTML (Login Principal)
        if ((session || localUserId) && (paginaActual === 'index.html' || paginaActual === '')) {
            window.location.href = 'panel.html';
            return;
        }

        // Guardar/actualizar datos clave en localStorage para disponibilidad offline
        if (session && session.user) {
            localStorage.setItem('siagop_user_id', session.user.id);
            sessionStorage.setItem(USER_ID_KEY, session.user.id);
            if (session.user.user_metadata?.organizacion_nombre) {
                localStorage.setItem('organizacion_nombre', session.user.user_metadata.organizacion_nombre);
                sessionStorage.setItem(ORG_NOMBRE_KEY, session.user.user_metadata.organizacion_nombre);
            }
        }

        // Inyectar el nombre de la organización en el header
        const orgNombre = localStorage.getItem('organizacion_nombre') || sessionStorage.getItem(ORG_NOMBRE_KEY) || 'Gerencia de Transporte Terrestre Occidente';
        actualizarHeaderOrganizacion(orgNombre);

        if (session?.user?.id || localUserId) {
            await validarAccesoGatekeeper(session?.user?.id || localUserId);
        }
    }

    /**
     * Nivel 2: Revisa el acceso del usuario mediante la función RPC 'validar_acceso_usuario'.
     * @param {string} userId - ID del usuario en Supabase (UUID o texto id)
     * @returns {Promise<{permitido: boolean, mensaje: string, organizacion_nombre?: string}>}
     */
    async function validarAccesoGatekeeper(userId) {
        if (!userId) {
            userId = localStorage.getItem('siagop_user_id') || sessionStorage.getItem(USER_ID_KEY);
            if (!userId) return { permitido: true, mensaje: 'Sin ID explícito.' };
        }

        const client = (typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null) ||
                       (window.SIAGOP_SG && window.SIAGOP_SG.ensureSupabaseClient ? window.SIAGOP_SG.ensureSupabaseClient() : null);

        if (!client || !navigator.onLine) {
            const storedOrg = localStorage.getItem('organizacion_nombre') || sessionStorage.getItem(ORG_NOMBRE_KEY);
            return {
                permitido: true,
                mensaje: 'Modo offline-first activo.',
                organizacion_nombre: storedOrg || 'Organización Local'
            };
        }

        try {
            const { data, error } = await client.rpc('validar_acceso_usuario', { p_usuario_id: String(userId) });

            if (error) {
                console.warn('[Gatekeeper] Error llamando RPC validar_acceso_usuario:', error);
                return { permitido: true, mensaje: 'No se pudo verificar gatekeeper en vivo.' };
            }

            const resultado = Array.isArray(data) ? data[0] : data;
            if (!resultado) {
                return { permitido: false, mensaje: 'Su cuenta de usuario no está activa o requiere autorización.' };
            }

            if (resultado.permitido === false) {
                await bloquearUsuarioEInactivar(resultado.mensaje || 'Acceso denegado por el sistema.');
                return { permitido: false, mensaje: resultado.mensaje };
            }

            if (resultado.organizacion_nombre) {
                localStorage.setItem('organizacion_nombre', resultado.organizacion_nombre);
                sessionStorage.setItem(ORG_NOMBRE_KEY, resultado.organizacion_nombre);
            }

            actualizarHeaderOrganizacion(resultado.organizacion_nombre);

            return {
                permitido: true,
                mensaje: resultado.mensaje || 'Acceso concedido.',
                organizacion_nombre: resultado.organizacion_nombre
            };
        } catch (e) {
            console.error('[Gatekeeper] Excepción en validación de acceso:', e);
            return { permitido: true, mensaje: 'Error interno en Gatekeeper.' };
        }
    }

    /**
     * Purga la sesión local, IndexedDB y muestra modal de bloqueo no descartable.
     * @param {string} mensajeError
     */
    async function bloquearUsuarioEInactivar(mensajeError) {
        console.warn('[Gatekeeper] Bloqueando acceso:', mensajeError);

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        localStorage.removeItem('siagop_user_id');
        localStorage.removeItem('organizacion_nombre');
        sessionStorage.clear();

        if (typeof dbSIAGOP !== 'undefined' && dbSIAGOP && typeof dbSIAGOP.delete === 'function') {
            try {
                await dbSIAGOP.delete();
                console.log('[Gatekeeper] Caché local IndexedDB purgado.');
            } catch (eDb) {
                console.warn('[Gatekeeper] Error al purgar IndexedDB:', eDb);
            }
        }

        mostrarModalBloqueoGatekeeper(mensajeError);
    }

    /**
     * Cierre de Sesión Definitivo.
     * Destruye tokens de Supabase, localStorage y sessionStorage.
     */
    async function cerrarSesionDefinitiva() {
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        localStorage.removeItem('siagop_user_id');
        localStorage.removeItem('organizacion_nombre');
        sessionStorage.clear();

        window.location.href = 'index.html';
    }

    function mostrarModalBloqueoGatekeeper(mensaje) {
        let modal = document.getElementById('modal-gatekeeper-bloqueo');
        if (modal) modal.remove();

        const modalHtml = `
        <div id="modal-gatekeeper-bloqueo" class="fixed inset-0 z-[9999] bg-slate-950/95 flex items-center justify-center p-4 backdrop-blur-md select-none">
            <div class="bg-slate-900 border border-red-500/30 max-w-md w-full rounded-2xl shadow-2xl p-8 text-center space-y-6">
                <div class="mx-auto w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 text-3xl animate-pulse">
                    <i class="fa-solid fa-shield-virus"></i>
                </div>

                <div class="space-y-2">
                    <h3 class="text-xl font-black uppercase tracking-tight text-white">Acceso Restringido</h3>
                    <p class="text-xs uppercase font-bold tracking-widest text-red-400">Control de Seguridad Multi-Tenant</p>
                </div>

                <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-xs font-medium leading-relaxed">
                    ${escapeGatekeeperHTML(mensaje || 'Su cuenta de usuario o la organización asociada no se encuentra activa.')}
                </div>

                <div class="pt-2">
                    <button type="button" onclick="window.SIAGOP_GATEKEEPER.cerrarSesionDefinitiva()" class="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Volver al Inicio
                    </button>
                </div>
            </div>
        </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    function escapeGatekeeperHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function actualizarHeaderOrganizacion(nombreOrg) {
        const elHeaderOrg = document.getElementById('header-organizacion-nombre') || document.getElementById('header-org-name');
        if (elHeaderOrg) {
            const orgText = nombreOrg || localStorage.getItem('organizacion_nombre') || sessionStorage.getItem(ORG_NOMBRE_KEY) || 'Gerencia de Transporte Terrestre Occidente';
            elHeaderOrg.textContent = orgText;
        }
    }

    // Exportar al objeto global SIAGOP_GATEKEEPER
    window.SIAGOP_GATEKEEPER = {
        verificarAccesoGlobal,
        validarAccesoGatekeeper,
        bloquearUsuarioEInactivar,
        cerrarSesionDefinitiva,
        mostrarModalBloqueoGatekeeper,
        actualizarHeaderOrganizacion
    };

    // Auto-ejecución al cargar el DOM
    document.addEventListener('DOMContentLoaded', verificarAccesoGlobal);

})();
