// js/admin.js - Controlador del Panel Backend de Importación Masiva y Gestión de Usuarios
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    validarAccesoAdmin();
});

function validarAccesoAdmin() {
    const isAuth = sessionStorage.getItem("TTOCC_ADMIN_AUTH");
    const modal = document.getElementById("modalAdminAcceso");
    if (isAuth === "authorized") {
        if (modal) modal.classList.add("hidden");
        cargarUsuariosSupabase();
    } else {
        if (modal) modal.classList.remove("hidden");
    }
}

function verificarAccesoAdmin(event) {
    event.preventDefault();
    const passInput = document.getElementById("input-admin-pass");
    const errDiv = document.getElementById("error-admin-pass");

    if (!passInput) return;
    const val = passInput.value.trim();

    if (val === "Raida17") {
        sessionStorage.setItem("TTOCC_ADMIN_AUTH", "authorized");
        document.getElementById("modalAdminAcceso").classList.add("hidden");
        if (errDiv) errDiv.classList.add("hidden");
        cargarUsuariosSupabase();
        TTOCC_UI.success("Acceso Concedido", "Bienvenido al Panel de Administración Backend.");
    } else {
        if (errDiv) errDiv.classList.remove("hidden");
        passInput.value = "";
        passInput.focus();
    }
}

function cambiarTabAdmin(tab) {
    const secImport = document.getElementById("seccion-import");
    const secUsuarios = document.getElementById("seccion-usuarios");
    const btnImport = document.getElementById("tab-btn-import");
    const btnUsuarios = document.getElementById("tab-btn-usuarios");

    if (tab === "import") {
        secImport.classList.remove("hidden");
        secUsuarios.classList.add("hidden");
        btnImport.className = "pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 cursor-pointer flex items-center gap-2";
        btnUsuarios.className = "pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-purple-500 cursor-pointer flex items-center gap-2";
    } else {
        secImport.classList.add("hidden");
        secUsuarios.classList.remove("hidden");
        btnUsuarios.className = "pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 border-purple-500 text-purple-600 dark:text-purple-400 cursor-pointer flex items-center gap-2";
        btnImport.className = "pb-3 px-2 text-xs font-black uppercase tracking-wider border-b-2 border-transparent text-slate-500 dark:text-slate-400 hover:text-purple-500 cursor-pointer flex items-center gap-2";
        cargarUsuariosSupabase();
    }
}

function logAdminMessage(mensaje, tipo = "info") {
    const consoleEl = document.getElementById("import-log-console");
    if (!consoleEl) return;

    const timestamp = new Date().toLocaleTimeString();
    let colorClass = "text-slate-300";
    if (tipo === "success") colorClass = "text-emerald-400 font-bold";
    if (tipo === "error") colorClass = "text-rose-400 font-bold";
    if (tipo === "warn") colorClass = "text-amber-400";

    const p = document.createElement("p");
    p.className = colorClass;
    p.textContent = `[${timestamp}] > ${mensaje}`;
    consoleEl.appendChild(p);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

function actualizarProgresoImportacion(porcentaje) {
    const bar = document.getElementById("import-barra-progreso");
    const txt = document.getElementById("import-porcentaje");
    const val = Math.min(100, Math.max(0, Math.round(porcentaje)));
    if (bar) bar.style.width = `${val}%`;
    if (txt) txt.textContent = `${val}%`;
}

function parsearCSVLineas(text) {
    const lines = [];
    let row = [];
    let entry = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const nextC = text[i + 1];

        if (c === '"') {
            if (inQuotes && nextC === '"') {
                entry += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push(entry.trim());
            entry = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && nextC === '\n') {
                i++;
            }
            row.push(entry.trim());
            if (row.some(field => field.length > 0)) {
                lines.push(row);
            }
            row = [];
            entry = '';
        } else {
            entry += c;
        }
    }
    if (entry.length > 0 || row.length > 0) {
        row.push(entry.trim());
        if (row.some(field => field.length > 0)) {
            lines.push(row);
        }
    }
    return lines;
}

function parseFechaISO(str) {
    if (!str || typeof str !== 'string' || !str.trim() || str.trim().toUpperCase() === 'N/A' || str.trim().toUpperCase() === 'PENDIENTE') return null;
    const cleanStr = str.trim();
    const ddmmyyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10) - 1;
        const year = parseInt(ddmmyyyy[3], 10);
        const hour = parseInt(ddmmyyyy[4] || '0', 10);
        const min = parseInt(ddmmyyyy[5] || '0', 10);
        const sec = parseInt(ddmmyyyy[6] || '0', 10);
        const d = new Date(Date.UTC(year, month, day, hour, min, sec));
        return d.toISOString();
    }
    const iso = new Date(cleanStr);
    if (!isNaN(iso.getTime())) return iso.toISOString();
    return null;
}

async function procesarImportacionMasiva() {
    const tablaTarget = document.getElementById("import-tabla-destino").value;
    const inputFileInput = document.getElementById("import-archivo-input");
    const btnSubmit = document.getElementById("btn-iniciar-import");

    if (!inputFileInput || !inputFileInput.files || inputFileInput.files.length === 0) {
        TTOCC_UI.error("Sin Archivo", "Por favor seleccione un archivo CSV o Excel.");
        return;
    }

    const file = inputFileInput.files[0];
    const client = typeof ensureSupabaseClient === "function" ? ensureSupabaseClient() : null;

    if (!client) {
        TTOCC_UI.error("Supabase Error", "No se pudo conectar con el cliente de Supabase.");
        return;
    }

    btnSubmit.disabled = true;
    actualizarProgresoImportacion(0);
    logAdminMessage(`Iniciando lectura de archivo: ${file.name} (${file.size} bytes)...`, "info");

    const extension = file.name.split('.').pop().toLowerCase();

    try {
        let registrosParaInsertar = [];

        if (extension === "xlsx" || extension === "xls") {
            if (typeof XLSX === "undefined") {
                throw new Error("Librería XLSX no cargada en la página.");
            }
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            logAdminMessage(`Leídas ${rawJson.length} filas desde la hoja '${firstSheetName}'.`, "info");

            registrosParaInsertar = MapearFilasAModelo(rawJson, tablaTarget);
        } else {
            const text = await file.text();
            const rows = parsearCSVLineas(text);
            if (rows.length <= 1) throw new Error("El archivo CSV no contiene registros suficientes.");

            const headers = rows[0].map(h => h.trim());
            logAdminMessage(`CSV parseado correctamente. Encabezados detectados: ${headers.join(", ")}`, "info");

            const rawJson = [];
            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length < headers.length) continue;
                const item = {};
                headers.forEach((h, idx) => {
                    item[h] = row[idx] || "";
                });
                rawJson.push(item);
            }
            registrosParaInsertar = MapearFilasAModelo(rawJson, tablaTarget);
        }

        if (registrosParaInsertar.length === 0) {
            throw new Error("No se obtuvieron registros válidos para importar.");
        }

        logAdminMessage(`Mapeados ${registrosParaInsertar.length} registros estructurados para '${tablaTarget}'.`, "info");
        logAdminMessage(`Iniciando inserción por lotes en Supabase...`, "warn");

        const batchSize = 100;
        const total = registrosParaInsertar.length;
        let insertadosCount = 0;
        const conflictKey = tablaTarget === "maestro_activos" ? "id_unidad" : "id";

        for (let i = 0; i < total; i += batchSize) {
            const batch = registrosParaInsertar.slice(i, i + batchSize);
            const { error, data } = await client.from(tablaTarget).upsert(batch, { onConflict: conflictKey }).select();

            if (error) {
                logAdminMessage(`Error enviando lote ${Math.floor(i / batchSize) + 1}: ${error.message}`, "error");
            } else {
                insertadosCount += (data ? data.length : batch.length);
                const porcentaje = ((i + batch.length) / total) * 100;
                actualizarProgresoImportacion(porcentaje);
                logAdminMessage(`Lote ${Math.floor(i / batchSize) + 1} procesado (${insertadosCount}/${total} registros).`, "success");
            }
        }

        actualizarProgresoImportacion(100);
        logAdminMessage(`PROCESO FINALIZADO. Se importaron ${insertadosCount} de ${total} registros en '${tablaTarget}'.`, "success");
        TTOCC_UI.success("Importación Completada", `Se enviaron ${insertadosCount} registros a la tabla '${tablaTarget}' en Supabase.`);

    } catch (err) {
        console.error("Error en importación masiva:", err);
        logAdminMessage(`FALLO CRÍTICO: ${err.message}`, "error");
        TTOCC_UI.error("Error de Importación", err.message);
    } finally {
        btnSubmit.disabled = false;
    }
}

function MapearFilasAModelo(rawJson, tablaTarget) {
    if (tablaTarget === "maestro_activos") {
        return rawJson.map(row => {
            const idUnidad = String(row["ID_Unidad"] || row["id_unidad"] || row["ID"] || "").trim();
            if (!idUnidad) return null;
            return {
                id_unidad: idUnidad,
                placa: String(row["Placa"] || row["placa"] || "").trim(),
                vin: String(row["Serial"] || row["VIN"] || row["vin"] || "").trim(),
                marca: String(row["Marca"] || row["marca"] || "").trim(),
                modelo: String(row["Modelo"] || row["modelo"] || "").trim(),
                anio: parseInt(row["Anio"] || row["Año"] || row["anio"] || "0", 10) || null,
                color: String(row["Color"] || row["color"] || "").trim(),
                tipo_vehiculo: String(row["Tipo_Vehiculo"] || row["tipo_vehiculo"] || "").trim(),
                tipo_flota: String(row["Tipo_Flota"] || row["tipo_flota"] || row["flota"] || "Liviana").trim(),
                estatus_final: String(row["Estatus_Final"] || row["estatus_final"] || "").trim(),
                situacion_actual: String(row["Situacion_Actual"] || row["situacion_actual"] || "").trim(),
                gerencia: String(row["Gerencia"] || row["gerencia"] || "").trim(),
                responsable_usuario: String(row["Responsable_Usuario"] || row["responsable_usuario"] || "").trim(),
                cargo_usuario: String(row["Cargo_Usuario"] || row["cargo_usuario"] || "").trim(),
                ubicacion_taller: String(row["Ubicacion_Taller"] || row["ubicacion_taller"] || "").trim(),
                ubicacion_taller_fecha: parseFechaISO(row["Ubicacion_Taller_Fecha"] || row["ubicacion_taller_fecha"]),
                documento_url: String(row["Documento_Url"] || row["documento_url"] || "").trim(),
                documento_nombre: String(row["Documento_Nombre"] || row["documento_nombre"] || "").trim(),
                updated_at: new Date().toISOString()
            };
        }).filter(Boolean);
    } else {
        return rawJson.map(row => {
            const id = String(row["ID_REGISTRO"] || row["id_registro"] || row["id"] || row["ID"] || "").trim();
            if (!id) return null;

            let tareasParsed = [];
            let rawTareas = row["Tareas"] || row["tareas"] || [];
            if (Array.isArray(rawTareas)) {
                tareasParsed = rawTareas;
            } else if (typeof rawTareas === "string" && rawTareas.trim()) {
                try { tareasParsed = JSON.parse(rawTareas); } catch (e) { tareasParsed = []; }
            }

            return {
                id: id,
                id_unidad: String(row["ID_Unidad"] || row["id_unidad"] || "").trim(),
                tipo_flota: String(row["Tipo_Flota"] || row["tipo_flota"] || row["flota"] || "S/I").trim(),
                nombre_taller: String(row["Nombre_Taller"] || row["nombre_taller"] || "").trim(),
                taller_ext: String(row["Taller_Ext"] || row["taller_ext"] || row["nombre_taller_ext"] || "").trim(),
                estatus: String(row["Estatus"] || row["estatus"] || "Por Atender").trim(),
                observaciones: String(row["Observaciones"] || row["observaciones"] || "").trim(),
                marca: String(row["Marca"] || row["marca"] || "").trim(),
                modelo: String(row["Modelo"] || row["modelo"] || "").trim(),
                color: String(row["Color"] || row["color"] || "").trim(),
                anio: parseInt(row["Anio"] || row["Año"] || row["anio"] || "0", 10) || null,
                vin: String(row["Serial"] || row["VIN"] || row["vin"] || "").trim(),
                tipo_vehiculo: String(row["Tipo_Vehiculo"] || row["tipo_vehiculo"] || "").trim(),
                avance: parseInt(row["Avance"] || row["avance"] || "0", 10) || 0,
                foto_antes: String(row["Foto_Antes"] || row["foto_antes"] || "").trim(),
                foto_despues: String(row["Foto_Despues"] || row["foto_despues"] || "").trim(),
                fecha_ingreso: parseFechaISO(row["Fecha_Ingreso"] || row["fecha_ingreso"]),
                fecha_salida: parseFechaISO(row["Fecha_Salida"] || row["fecha_salida"]),
                gerencia: String(row["Gerencia"] || row["gerencia"] || "").trim(),
                usuario: String(row["Usuario"] || row["usuario"] || "").trim(),
                cargo_usuario: String(row["Cargo_Usuario"] || row["cargo_usuario"] || "").trim(),
                tareas: tareasParsed,
                modificado_por: String(row["Modificado_Por"] || row["modificado_por"] || "ADMIN").trim(),
                updated_at: new Date().toISOString()
            };
        }).filter(Boolean);
    }
}

/**
 * GESTIÓN DE USUARIOS
 */
var listaUsuariosGlobal = [];

async function cargarUsuariosSupabase() {
    const tbody = document.getElementById("tablaUsuariosCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="p-6 text-center text-purple-400 font-bold uppercase text-[10px]">
                <i class="fa-solid fa-spinner animate-spin mr-1"></i> Consultando usuarios en Supabase...
            </td>
        </tr>
    `;

    const client = typeof ensureSupabaseClient === "function" ? ensureSupabaseClient() : null;
    if (!client) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-xs">Error de cliente Supabase.</td></tr>`;
        return;
    }

    try {
        const { data, error } = await client.from("usuarios").select("*").order("usuario", { ascending: true });
        if (error) throw error;

        listaUsuariosGlobal = data || [];
        renderizarUsuarios(listaUsuariosGlobal);
    } catch (err) {
        console.error("Error cargando usuarios:", err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-xs">No se pudo cargar la lista de usuarios desde Supabase: ${escapeHTML(err.message)}</td></tr>`;
    }
}

function renderizarUsuarios(usuarios) {
    const tbody = document.getElementById("tablaUsuariosCuerpo");
    if (!tbody) return;

    if (usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 font-bold text-xs uppercase">No hay usuarios registrados en la base de datos.</td></tr>`;
        return;
    }

    const htmlArray = usuarios.map(u => {
        const idEscaped = escapeHTML(u.id);
        const usrEscaped = escapeHTML(u.usuario);
        const nombreEscaped = escapeHTML(u.nombre_completo || u.usuario);
        const rolEscaped = escapeHTML(u.rol_id || "operador_talleres");
        const moduloEscaped = escapeHTML(u.modulo || "TODOS");
        const passwordEscaped = escapeHTML(u.password_plain || "*****");
        const activoFlag = Boolean(u.activo);

        const badgeEstado = activoFlag
            ? `<span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[9px] font-black uppercase">Activo</span>`
            : `<span class="px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-[9px] font-black uppercase">Inactivo</span>`;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors">
                <td class="p-4 font-mono font-bold text-slate-900 dark:text-white uppercase">${usrEscaped}</td>
                <td class="p-4 font-medium text-slate-700 dark:text-slate-300">${nombreEscaped}</td>
                <td class="p-4 font-mono text-[10px] text-purple-600 dark:text-purple-400 font-black uppercase">${rolEscaped}</td>
                <td class="p-4 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase">${moduloEscaped}</td>
                <td class="p-4 font-mono text-xs text-slate-800 dark:text-slate-200">${passwordEscaped}</td>
                <td class="p-4">${badgeEstado}</td>
                <td class="p-4 text-center">
                    <button onclick="editarUsuario('${idEscaped}')" class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer mr-1">
                        <i class="fa-solid fa-user-pen"></i> Editar
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlArray.join('');
}

function abrirModalUsuario() {
    document.getElementById("formUsuario").reset();
    document.getElementById("usr-id").value = "";
    document.getElementById("modal-usuario-titulo").innerHTML = `<i class="fa-solid fa-user-plus"></i> Crear Nuevo Usuario`;
    document.getElementById("modalUsuario").classList.remove("hidden");
}

function cerrarModalUsuario() {
    document.getElementById("modalUsuario").classList.add("hidden");
}

function editarUsuario(id) {
    const u = listaUsuariosGlobal.find(item => String(item.id) === String(id));
    if (!u) return;

    document.getElementById("usr-id").value = u.id;
    document.getElementById("usr-usuario").value = u.usuario;
    document.getElementById("usr-nombre").value = u.nombre_completo || "";
    document.getElementById("usr-password").value = u.password_plain || "";
    document.getElementById("usr-rol").value = u.rol_id || "operador_talleres";
    document.getElementById("usr-modulo").value = u.modulo || "TODOS";
    document.getElementById("usr-activo").value = String(Boolean(u.activo));

    document.getElementById("modal-usuario-titulo").innerHTML = `<i class="fa-solid fa-user-pen"></i> Modificar Usuario`;
    document.getElementById("modalUsuario").classList.remove("hidden");
}

async function guardarUsuario(event) {
    event.preventDefault();
    const client = typeof ensureSupabaseClient === "function" ? ensureSupabaseClient() : null;
    if (!client) {
        TTOCC_UI.error("Error", "No se pudo conectar con Supabase.");
        return;
    }

    const idInput = document.getElementById("usr-id").value.trim();
    const usuarioVal = document.getElementById("usr-usuario").value.trim().toUpperCase();
    const nombreVal = document.getElementById("usr-nombre").value.trim();
    const passVal = document.getElementById("usr-password").value.trim();
    const rolVal = document.getElementById("usr-rol").value;
    const moduloVal = document.getElementById("usr-modulo").value;
    const activoVal = document.getElementById("usr-activo").value === "true";

    const payload = {
        id: idInput || (crypto && crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`),
        usuario: usuarioVal,
        nombre_completo: nombreVal,
        password_plain: passVal,
        rol_id: rolVal,
        modulo: moduloVal,
        activo: activoVal,
        updated_at: new Date().toISOString()
    };

    try {
        const { error } = await client.from("usuarios").upsert(payload, { onConflict: "usuario" });
        if (error) throw error;

        cerrarModalUsuario();
        await cargarUsuariosSupabase();
        TTOCC_UI.success("Usuario Guardado", `Credenciales de ${usuarioVal} actualizadas correctamente.`);
    } catch (err) {
        console.error("Error guardando usuario:", err);
        TTOCC_UI.error("Error al Guardar", err.message);
    }
}
