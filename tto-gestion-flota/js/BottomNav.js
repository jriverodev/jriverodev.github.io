/**
 * TTOCC System - Mobile Bottom Navigation Bar Component
 * js/BottomNav.js
 */
"use strict";

(function () {
    const RUTAS_TAB = [
        { hash: '#/dashboard', label: 'Inicio', icon: 'fa-gauge-high', defaultUrl: 'panel.html' },
        { hash: '#/activos', label: 'Activos', icon: 'fa-truck-front', defaultUrl: 'form-flota.html' },
        { hash: '#/mantenimiento', label: 'Mantenimiento', icon: 'fa-wrench', defaultUrl: 'form-talleres.html' },
        { hash: '#/roles', label: 'Roles', icon: 'fa-user-shield', defaultUrl: 'roles.html' }
    ];

    function inicializarBottomNav() {
        const path = window.location.pathname.toLowerCase();
        // Ocultar en vistas de Login puro o Registro comercial
        if (path.includes('registro-organizacion.html')) {
            return;
        }

        // Agregar pb-20 a los contenedores <main> de la página
        const mainElements = document.querySelectorAll('main');
        mainElements.forEach(m => m.classList.add('pb-20'));

        let navContainer = document.getElementById('ttocc-bottom-nav');
        if (!navContainer) {
            navContainer = document.createElement('nav');
            navContainer.id = 'ttocc-bottom-nav';
            navContainer.className = 'fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 h-16 flex items-center justify-around px-2 shadow-2xl transition-all';
            document.body.appendChild(navContainer);
        }

        renderizarTabs(navContainer);

        window.addEventListener('hashchange', () => {
            renderizarTabs(navContainer);
        });
    }

    function renderizarTabs(container) {
        if (!container) return;
        const currentHash = window.location.hash || '#/dashboard';

        container.innerHTML = RUTAS_TAB.map(tab => {
            const esActivo = currentHash === tab.hash;
            const claseColor = esActivo ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200';

            return `
                <a href="${tab.hash}" onclick="window.TTOCC_BOTTOM_NAV.navegarRuta('${tab.hash}', '${tab.defaultUrl}')"
                   class="flex flex-col items-center justify-center w-full h-full text-center transition-colors cursor-pointer ${claseColor}">
                    <i class="fa-solid ${tab.icon} text-lg mb-0.5"></i>
                    <span class="text-[10px] tracking-wider uppercase font-medium">${tab.label}</span>
                </a>
            `;
        }).join('');
    }

    function navegarRuta(hash, defaultUrl) {
        window.location.hash = hash;
        // Mapeo simple de rutas internas SPA/Multi-página
        if (hash === '#/roles') {
            const userRol = sessionStorage.getItem('TTOCC_ROL') || '';
            // Si la página actual no tiene el renderizador de roles y existe roles.html o spa view
            if (!document.getElementById('seccion-roles-module')) {
                window.location.href = 'admin.html#/roles';
            }
        }
    }

    window.TTOCC_BOTTOM_NAV = {
        inicializarBottomNav,
        navegarRuta
    };

    document.addEventListener('DOMContentLoaded', inicializarBottomNav);
})();
