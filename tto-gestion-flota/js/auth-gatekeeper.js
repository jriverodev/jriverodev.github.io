/**
 * TTOCC System - Gatekeeper Access Control
 * auth-gatekeeper.js - Control de acceso multi-tenant y validación RPC de organización/usuario.
 */
"use strict";

(function () {
    const ORG_NOMBRE_KEY = 'TTOCC_ORG_NOMBRE';
    const USER_ID_KEY = 'TTOCC_USER_ID';

    /**
     * Revisa el acceso del usuario mediante la función RPC 'validar_acceso_usuario'.
     * @param {string} userId - ID del usuario en Supabase (UUID o texto id)
     * @returns {Promise<{permitido: boolean, mensaje: string, organizacion_nombre?: string}>}
     */
    async function validarAccesoGatekeeper(userId) {
        if (!userId) {
            const storedUserId = sessionStorage.getItem(USER_ID_KEY);
            if (!storedUserId) {
                return { permitido: true, mensaje: 'Sesión sin usuario ID explícito.' };
            }
            userId = storedUserId;
        }

        const client = (typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null) ||
                       (window.TTOCC_SG && window.TTOCC_SG.ensureSupabaseClient ? window.TTOCC_SG.ensureSupabaseClient() : null);

        if (!client || !navigator.onLine) {
            // Si no hay conexión o cliente no disponible, permitimos paso local si hay sesión activa
            const storedOrg = sessionStorage.getItem(ORG_NOMBRE_KEY);
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
                // Si la función RPC falla pero hay sesión local, no bloqueamos abruptamente a menos que sea error explícito
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
                sessionStorage.setItem(ORG_NOMBRE_KEY, resultado.organizacion_nombre);
            }
            sessionStorage.setItem(USER_ID_KEY, String(userId));

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

        // 1. Cerrar sesión en Supabase auth si aplica
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        // 2. Limpiar sessionStorage
        sessionStorage.clear();

        // 3. Purgar caché IndexedDB
        if (typeof dbTTOCC !== 'undefined' && dbTTOCC && typeof dbTTOCC.delete === 'function') {
            try {
                await dbTTOCC.delete();
                console.log('[Gatekeeper] Caché local IndexedDB purgado.');
            } catch (eDb) {
                console.warn('[Gatekeeper] Error al purgar IndexedDB:', eDb);
            }
        }

        // 4. Desplegar Modal No Descartable
        mostrarModalBloqueoGatekeeper(mensajeError);
    }

    /**
     * Genera e inyecta el modal undismissable en la pantalla.
     * @param {string} mensaje
     */
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
                    <a href="index.html" class="inline-block w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-600/20 active:scale-95">
                        <i class="fa-solid fa-right-from-bracket mr-2"></i> Volver al Inicio
                    </a>
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
            const orgText = nombreOrg || sessionStorage.getItem(ORG_NOMBRE_KEY) || 'Gerencia de Transporte Terrestre Occidente';
            elHeaderOrg.textContent = orgText;
        }
    }

    // Exportar al objeto global TTOCC_GATEKEEPER
    window.TTOCC_GATEKEEPER = {
        validarAccesoGatekeeper,
        bloquearUsuarioEInactivar,
        mostrarModalBloqueoGatekeeper,
        actualizarHeaderOrganizacion
    };

    // Auto-ejecución al cargar el DOM si hay sesión
    document.addEventListener('DOMContentLoaded', () => {
        const userId = sessionStorage.getItem(USER_ID_KEY);
        const orgNombre = sessionStorage.getItem(ORG_NOMBRE_KEY);
        if (orgNombre) {
            actualizarHeaderOrganizacion(orgNombre);
        }
        if (userId) {
            validarAccesoGatekeeper(userId);
        }
    });

})();
