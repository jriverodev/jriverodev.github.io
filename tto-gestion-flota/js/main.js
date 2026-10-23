/**
 * SIAGOP System - Application Entry & Bootstrapping Controller
 * js/main.js
 */
"use strict";

(function () {
    document.addEventListener('DOMContentLoaded', () => {
        inicializarSIAGOPApp();
    });

    async function inicializarSIAGOPApp() {
        const auth = window.SIAGOP_AUTH_SERVICE;
        if (!auth) return;

        const { tieneLicencia, codigo, orgNombre } = auth.obtenerLicenciaActiva();
        const { tieneSesion, modulo, rol } = auth.obtenerSesionUsuario();

        const paginaActual = window.location.pathname.split('/').pop() || 'index.html';

        // 1. Si está en index.html
        if (paginaActual === 'index.html' || paginaActual === '') {
            // Si ya tiene licencia Y sesión, auto-redireccionar a la vista correspondiente
            if (tieneLicencia && tieneSesion) {
                redirigirSegunPermisos(modulo, rol);
                return;
            }

            // Renderizar la vista de index.html con los pasos correspondientes
            renderizarIndexSteps(tieneLicencia, codigo, orgNombre);
        } else if (paginaActual !== 'registro-organizacion.html') {
            // Si está en cualquier otra página interna y NO tiene licencia o NO tiene sesión
            if (!tieneLicencia || !tieneSesion) {
                window.location.href = 'index.html';
                return;
            }
        }
    }

    function renderizarIndexSteps(tieneLicencia, codigo, orgNombre) {
        const stepLicencia = document.getElementById('step-licencia');
        const stepLogin = document.getElementById('step-login');

        if (!stepLicencia || !stepLogin) return;

        if (!tieneLicencia) {
            stepLicencia.classList.remove('hidden');
            stepLogin.classList.add('hidden');
        } else {
            stepLicencia.classList.add('hidden');
            stepLogin.classList.remove('hidden');

            const badgeOrg = document.getElementById('login-org-badge');
            if (badgeOrg) {
                badgeOrg.textContent = `${orgNombre} (${codigo})`;
            }
        }
    }

    function redirigirSegunPermisos(userMod, userRol) {
        const mod = String(userMod || 'TODOS').toUpperCase();
        const r = String(userRol || '').toLowerCase();

        if (mod === 'VISOR_TALLERES' || mod === 'VISOR_FLOTA' || mod === 'TALLERES_Y_VISOR' || mod === 'FLOTA_Y_VISOR' || mod === 'TODOS' || r === 'admin' || r === 'administrador') {
            window.location.href = 'visor.html';
        } else if (mod === 'TALLERES' || r === 'operador_talleres') {
            window.location.href = 'panel.html';
        } else if (mod === 'FLOTA' || r === 'operador_flota') {
            window.location.href = 'form-flota.html';
        } else {
            window.location.href = 'visor.html';
        }
    }

    window.SIAGOP_MAIN = {
        inicializarSIAGOPApp,
        renderizarIndexSteps,
        redirigirSegunPermisos
    };
})();
