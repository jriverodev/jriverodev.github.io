/**
 * SIAGOP System - User Profile Dropdown Pill & Logout
 * js/profile-header.js
 */
"use strict";

(function () {

    function renderizarProfilePillHeader() {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('registro-organizacion.html')) return;

        const userName = sessionStorage.getItem('SIAGOP_OPERADOR') || 'Usuario';
        const userRol = sessionStorage.getItem('SIAGOP_ROL') || 'operador';
        const orgNombre = sessionStorage.getItem('SIAGOP_ORG_NOMBRE') || 'Gerencia de Transporte Terrestre Occidente';

        let profileContainer = document.getElementById('siagop-header-profile-root');
        if (!profileContainer) {
            // Reemplazar o insertar en headers de las vistas
            const header = document.querySelector('header');
            if (header) {
                const navGroup = header.querySelector('.flex.items-center.gap-2, .flex.items-center.gap-3') || header;
                profileContainer = document.createElement('div');
                profileContainer.id = 'siagop-header-profile-root';
                profileContainer.className = 'relative inline-block text-left ml-auto';
                navGroup.appendChild(profileContainer);
            }
        }

        if (!profileContainer) return;

        profileContainer.innerHTML = `
            <div class="relative">
                <button type="button" onclick="window.SIAGOP_PROFILE.toggleDropdown()" class="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer">
                    <span id="led-network-status" class="inline-block w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                    <div class="text-left hidden sm:block">
                        <p class="text-[10px] font-black uppercase text-slate-900 dark:text-slate-100 leading-tight">${escapeHTML(userName)}</p>
                        <p class="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">${escapeHTML(userRol)}</p>
                    </div>
                    <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-1"></i>
                </button>

                <div id="siagop-profile-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 p-4 transition-all">
                    <div class="border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
                        <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Organización</p>
                        <p id="header-organizacion-nombre" class="text-xs font-black uppercase text-slate-900 dark:text-slate-50 mt-0.5">${escapeHTML(orgNombre)}</p>
                    </div>

                    <div class="space-y-1">
                        <a href="index.html" class="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <i class="fa-solid fa-house text-blue-500"></i> Inicio / Cambiar Módulo
                        </a>
                        <button type="button" onclick="window.SIAGOP_PROFILE.cerrarSesionCompleta()" class="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer text-left">
                            <i class="fa-solid fa-right-from-bracket"></i> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    function toggleDropdown() {
        const dropdown = document.getElementById('siagop-profile-dropdown');
        if (dropdown) dropdown.classList.toggle('hidden');
    }

    async function cerrarSesionCompleta() {
        // 1. Supabase SignOut si aplica
        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (client && client.auth && typeof client.auth.signOut === 'function') {
            try { await client.auth.signOut(); } catch (e) {}
        }

        // 2. Limpiar Session Storage
        sessionStorage.clear();

        // 3. Purga opcional de IndexedDB
        if (typeof dbSIAGOP !== 'undefined' && dbSIAGOP && typeof dbSIAGOP.delete === 'function') {
            try { await dbSIAGOP.delete(); } catch (e) {}
        }

        window.location.href = 'index.html';
    }

    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    window.SIAGOP_PROFILE = {
        renderizarProfilePillHeader,
        toggleDropdown,
        cerrarSesionCompleta
    };

    document.addEventListener('DOMContentLoaded', renderizarProfilePillHeader);
})();
