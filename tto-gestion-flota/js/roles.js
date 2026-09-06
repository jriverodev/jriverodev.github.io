/**
 * TTOCC System - Custom Tenant Roles Management Module
 * js/roles.js - Acceso restringido a rol 'admin', filtrado por organizacion_id y creación de roles personalizados.
 */
"use strict";

(function () {

    async function cargarRolesTenant() {
        const contenedorTabla = document.getElementById('tablaRolesTenantCuerpo');
        if (!contenedorTabla) return;

        const userRol = String(sessionStorage.getItem('TTOCC_ROL') || '').toLowerCase();
        if (userRol !== 'admin') {
            contenedorTabla.innerHTML = `
                <tr>
                    <td colspan="4" class="p-8 text-center text-rose-500 font-bold uppercase text-xs">
                        <i class="fa-solid fa-lock mr-2"></i> Acceso denegado: El módulo de gestión de roles está reservado exclusivamente para administradores.
                    </td>
                </tr>`;
            return;
        }

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (!client || !navigator.onLine) {
            contenedorTabla.innerHTML = `
                <tr>
                    <td colspan="4" class="p-8 text-center text-slate-400 font-bold uppercase text-xs">
                        <i class="fa-solid fa-wifi mr-2"></i> Se requiere conexión en línea con Supabase para administrar roles del tenant.
                    </td>
                </tr>`;
            return;
        }

        try {
            // Extraer organizacion_id del usuario activo
            const userId = sessionStorage.getItem('TTOCC_USER_ID') || '';
            let userOrgId = null;

            if (userId) {
                const { data: usrData } = await client.from('usuarios').select('organizacion_id').eq('id', userId).maybeSingle();
                if (usrData) userOrgId = usrData.organizacion_id;
            }

            let query = client.from('roles').select('*').order('nombre', { ascending: true });
            if (userOrgId) {
                query = query.eq('organizacion_id', userOrgId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[Roles] Error consultando roles:', error);
                contenedorTabla.innerHTML = `
                    <tr>
                        <td colspan="4" class="p-8 text-center text-rose-400 text-xs font-bold uppercase">
                            Error al cargar roles desde Supabase: ${escapeHTML(error.message)}
                        </td>
                    </tr>`;
                return;
            }

            if (!data || data.length === 0) {
                contenedorTabla.innerHTML = `
                    <tr>
                        <td colspan="4" class="p-8 text-center text-slate-500 text-xs font-bold uppercase">
                            No existen roles personalizados registrados para esta organización.
                        </td>
                    </tr>`;
                return;
            }

            contenedorTabla.innerHTML = data.map(rol => `
                <tr class="hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-200 dark:border-slate-800">
                    <td class="p-4 font-mono font-bold text-xs text-blue-600 dark:text-blue-400">${escapeHTML(rol.codigo_rol || 'S/C')}</td>
                    <td class="p-4 font-bold text-xs text-slate-900 dark:text-slate-100">${escapeHTML(rol.nombre || '')}</td>
                    <td class="p-4 text-xs text-slate-500 dark:text-slate-400">${escapeHTML(rol.descripcion || 'Sin descripción')}</td>
                    <td class="p-4 text-xs text-slate-400 font-mono">${formatearFecha(rol.created_at)}</td>
                </tr>
            `).join('');

        } catch (e) {
            console.error('[Roles] Excepción cargando roles:', e);
        }
    }

    async function crearNuevoRolTenant(event) {
        event.preventDefault();

        const nombre = document.getElementById('rol-nombre').value.trim();
        const codigoRol = document.getElementById('rol-codigo').value.trim().toLowerCase();
        const descripcion = document.getElementById('rol-descripcion').value.trim();

        if (!nombre || !codigoRol) {
            mostrarNotificacion('Ingrese el nombre y código del rol.', 'advertencia');
            return;
        }

        const client = typeof ensureSupabaseClient === 'function' ? ensureSupabaseClient() : null;
        if (!client || !navigator.onLine) {
            mostrarNotificacion('Se requiere conexión a Internet para guardar roles.', 'error');
            return;
        }

        try {
            // Obtener el organizacion_id del usuario activo
            const userId = sessionStorage.getItem('TTOCC_USER_ID') || '';
            let userOrgId = '11111111-1111-1111-1111-111111111111'; // Default Matriz ID

            if (userId) {
                const { data: usrData } = await client.from('usuarios').select('organizacion_id').eq('id', userId).maybeSingle();
                if (usrData && usrData.organizacion_id) userOrgId = usrData.organizacion_id;
            }

            const payloadRol = {
                nombre,
                codigo_rol: codigoRol,
                descripcion,
                organizacion_id: userOrgId
            };

            const { error } = await client.from('roles').insert([payloadRol]);

            if (error) {
                console.error('[Roles] Error insertando rol:', error);
                mostrarNotificacion(`Error al crear rol: ${error.message}`, 'error');
                return;
            }

            mostrarNotificacion('Rol personalizado creado exitosamente.', 'exito');
            cerrarModalRol();
            cargarRolesTenant();

        } catch (e) {
            console.error('[Roles] Excepción al crear rol:', e);
            mostrarNotificacion('Excepción al registrar rol.', 'error');
        }
    }

    function abrirModalRol() {
        const modal = document.getElementById('modalCrearRol');
        if (modal) {
            document.getElementById('formCrearRol')?.reset();
            modal.classList.remove('hidden');
        }
    }

    function cerrarModalRol() {
        const modal = document.getElementById('modalCrearRol');
        if (modal) modal.classList.add('hidden');
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

    function formatearFecha(fechaStr) {
        if (!fechaStr) return '-';
        try {
            return new Date(fechaStr).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (e) { return fechaStr; }
    }

    window.TTOCC_ROLES = {
        cargarRolesTenant,
        crearNuevoRolTenant,
        abrirModalRol,
        cerrarModalRol
    };

    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.hash === '#/roles' || document.getElementById('tablaRolesTenantCuerpo')) {
            cargarRolesTenant();
        }
    });

})();
