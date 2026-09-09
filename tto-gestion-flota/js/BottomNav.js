/**
 * SIAGOP System - Mobile Bottom Navigation Bar Component
 * js/BottomNav.js
 */
"use strict";

(function () {
    const RUTAS_TAB = [
        { hash: '#/dashboard', label: 'Inicio', icon: 'fa-gauge-high', targetUrl: 'visor.html' },
        { hash: '#/activos', label: 'Activos', icon: 'fa-truck-front', targetUrl: 'form-flota.html' },
        { hash: '#/mantenimiento', label: 'Mantenimiento', icon: 'fa-wrench', targetUrl: 'form-talleres.html' },
        { hash: '#/roles', label: 'Roles', icon: 'fa-user-shield', targetUrl: 'admin.html#/roles' }
    ];

    function inicializarBottomNav() {
        const path = window.location.pathname.toLowerCase();
        // Ocultar en vistas de Login puro o Registro comercial
        if (path.includes('registro-organizacion.html') || path.endsWith('index.html') || path.endsWith('/')) {
            return;
        }

        // Agregar pb-24 a los contenedores <main> de la página
        const mainElements = document.querySelectorAll('main');
        mainElements.forEach(m => m.classList.add('pb-24'));

        let navContainer = document.getElementById('siagop-bottom-nav');
        if (!navContainer) {
            navContainer = document.createElement('nav');
            navContainer.id = 'siagop-bottom-nav';
            navContainer.className = 'touch-none overscroll-contain fixed bottom-0 left-0 right-0 z-[40] bg-slate-900/95 border-t border-slate-800 h-16 flex items-center justify-around px-2 shadow-2xl backdrop-blur-md transition-all';
            document.body.appendChild(navContainer);
        }

        renderizarTabs(navContainer);

        window.addEventListener('hashchange', () => {
            renderizarTabs(navContainer);
        });
    }

    function renderizarTabs(container) {
        if (!container) return;
        const currentPath = window.location.pathname.split('/').pop() || 'panel.html';
        const currentHash = window.location.hash || '';

        const perm = typeof obtenerRolYModuloUsuario === 'function' ? obtenerRolYModuloUsuario() : { esAdmin: true, esTalleres: true, esFlota: true };

        const tabsFiltrados = RUTAS_TAB.filter(tab => {
            if (tab.hash === '#/activos' && !perm.esFlota) return false;
            if (tab.hash === '#/mantenimiento' && !perm.esTalleres) return false;
            if (tab.hash === '#/roles' && !perm.esAdmin) return false;
            return true;
        });

        container.innerHTML = tabsFiltrados.map(tab => {
            let targetUrl = tab.targetUrl;

            let esActivo = false;
            if (tab.hash === '#/dashboard' && (currentPath === 'panel.html' || currentPath === 'visor.html' || currentPath === 'patio.html')) esActivo = true;
            else if (tab.hash === '#/activos' && (currentPath === 'form-flota.html' || currentPath === 'visor-flota.html')) esActivo = true;
            else if (tab.hash === '#/mantenimiento' && (currentPath === 'form-talleres.html' || currentPath === 'visor-talleres.html')) esActivo = true;
            else if (tab.hash === '#/roles' && currentPath === 'admin.html' && currentHash.includes('roles')) esActivo = true;

            const claseColor = esActivo ? 'text-sky-400 font-bold border-t-2 border-sky-400 -mt-0.5' : 'text-slate-400 hover:text-slate-200';

            return `
                <button type="button" onclick="window.SIAGOP_BOTTOM_NAV.navegarRuta('${targetUrl}')"
                   class="flex flex-col items-center justify-center w-full h-full text-center transition-all cursor-pointer ${claseColor}">
                    <i class="fa-solid ${tab.icon} text-lg mb-0.5"></i>
                    <span class="text-[10px] tracking-wider uppercase font-bold">${tab.label}</span>
                </button>
            `;
        }).join('');
    }

    function navegarRuta(targetUrl) {
        if (!targetUrl) return;
        const currentPath = window.location.pathname.split('/').pop() || 'panel.html';

        // Si ya estamos en la página destino (sin hash diferencial), no recargamos
        if (targetUrl.includes('#/roles')) {
            if (currentPath === 'admin.html') {
                if (typeof cambiarTabAdmin === 'function') {
                    cambiarTabAdmin('roles');
                }
                window.location.hash = '#/roles';
                return;
            }
            window.location.href = targetUrl;
            return;
        }

        if (currentPath !== targetUrl) {
            window.location.href = targetUrl;
        }
    }

    window.SIAGOP_BOTTOM_NAV = {
        inicializarBottomNav,
        navegarRuta
    };

    document.addEventListener('DOMContentLoaded', inicializarBottomNav);
})();
