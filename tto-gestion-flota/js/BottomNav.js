/**
 * SIAGOP System - Mobile Bottom Navigation Bar Component (Material Design 3)
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

        // Agregar espacio inferior amplio a los elementos principales para evitar colisión con el scroll
        const mainElements = document.querySelectorAll('main');
        mainElements.forEach(m => {
            m.classList.add('pb-28', 'sm:pb-24');
        });
        document.body.classList.add('pb-20');

        let navContainer = document.getElementById('siagop-bottom-nav');
        if (!navContainer) {
            navContainer = document.createElement('nav');
            navContainer.id = 'siagop-bottom-nav';
            navContainer.className = 'fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 h-16 flex items-center justify-around px-2 shadow-lg backdrop-blur-md transition-colors select-none';
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

            const pillBg = esActivo
                ? 'bg-blue-600/15 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200';

            return `
                <button type="button" onclick="window.SIAGOP_BOTTOM_NAV.navegarRuta('${targetUrl}')"
                   class="flex flex-col items-center justify-center flex-1 h-full py-1 group transition-all cursor-pointer">
                    <div class="px-4 py-1 rounded-full flex items-center justify-center transition-all ${pillBg}">
                        <i class="fa-solid ${tab.icon} text-base"></i>
                    </div>
                    <span class="text-[10px] tracking-wider uppercase font-semibold mt-0.5 ${esActivo ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 dark:text-slate-400'}">${tab.label}</span>
                </button>
            `;
        }).join('');
    }

    function navegarRuta(targetUrl) {
        if (!targetUrl) return;
        const currentPath = window.location.pathname.split('/').pop() || 'panel.html';

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
