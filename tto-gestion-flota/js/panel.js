// js/panel.js - Controlador Unificado de Patio, Edición Inline, Checklist Automatizado y Manejo de Imágenes en Base64

document.addEventListener("DOMContentLoaded", () => {
    verificarSesion();
    initTheme();
    cargarTablaEditable();
    inicializarSelects();
});

function inicializarSelects() {
    const configGerencia = {
        placeholder: 'Seleccione o escriba...',
        tags: true,
        width: '100%'
    };

    const configEquipo = {
        placeholder: 'Seleccione tipo de equipo...',
        width: '100%'
    };

    const tiposEquiposLista = ["AMBULANCIAS", "AUTOBUS", "BATEA", "CAMION 750 BRAZO ARTICULADO", "CAMION CAVA", "CAMION CESTA", "CAMION VOLTEO", "CAMIONETA", "CHUTO CON BATEA", "CHUTO CON VAGON", "CISTERNA DE 36 MIL", "CONTENEDOR", "GRUA TELESCOPICA 100 TON", "GRUA TELESCOPICA 80 TON", "GRUA TELESCOPICA 75 TON", "MONTA CARGA 05 TON", "TOYOTA JEEP", "VACUUN DE 25 MIL AGUA POTABLE", "VACUUN DE ACHIQUE (SEPTICO)", "VACUUN DE ACHIQUE (PETROLEO)", "VAN"];

    $('#add-gerencia').select2(Object.assign({}, configGerencia, { dropdownParent: $('#modalNuevoRegistro') }));
    $('#edit-gerencia').select2(Object.assign({}, configGerencia, { dropdownParent: $('#modalEditarRegistro') }));

    $('#add-flota').select2(Object.assign({}, configEquipo, {
        dropdownParent: $('#modalNuevoRegistro'),
        data: tiposEquiposLista.map(t => ({ id: t, text: t }))
    }));
    $('#edit-flota').select2(Object.assign({}, configEquipo, {
        dropdownParent: $('#modalEditarRegistro'),
        data: tiposEquiposLista.map(t => ({ id: t, text: t }))
    }));
}

// Almacenes de control en memoria global
var listaRegistrosPanel = [];
var tareasModalActual = [];
var OPERADOR_ACTUAL = "";
var FILTROS_ACTIVOS = {
    busqueda: "",
    estatus: [],
    ubicacion: ""
};

/**
 * Lógica de Identificación y Auditoría
 */
function verificarSesion() {
    const sesion = sessionStorage.getItem("TTOCC_OPERADOR");
    if (sesion) {
        OPERADOR_ACTUAL = sesion;
        document.getElementById("modalIdentificacion").classList.add("hidden");
    }
}

function confirmarIdentidad(event) {
    event.preventDefault();
    const input = document.getElementById("input-operador");
    const nombre = input.value.trim().toUpperCase();

    if (nombre) {
        OPERADOR_ACTUAL = nombre;
        sessionStorage.setItem("TTOCC_OPERADOR", nombre);
        document.getElementById("modalIdentificacion").classList.add("hidden");
    }
}

/**
 * Gestión de Temas (Claro/Oscuro)
 */
function initTheme() {
    const savedTheme = localStorage.getItem("TTOCC_THEME") || "light";
    if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
        actualizarIconoTema(true);
    } else {
        document.documentElement.classList.remove("dark");
        actualizarIconoTema(false);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("TTOCC_THEME", isDark ? "dark" : "light");
    actualizarIconoTema(isDark);
}

function actualizarIconoTema(isDark) {
    const icon = document.getElementById("theme-icon");
    if (icon) {
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    }
}

/**
 * Lógica de Búsqueda y Filtros (Matriz Operativa)
 */
function abrirFiltros() {
    const sheet = document.getElementById("bottomSheetFiltros");
    const content = document.getElementById("sheetContent");
    sheet.classList.remove("hidden");
    setTimeout(() => {
        content.classList.remove("translate-y-full");
    }, 10);
}

function cerrarFiltros(event) {
    const content = document.getElementById("sheetContent");
    content.classList.add("translate-y-full");
    setTimeout(() => {
        document.getElementById("bottomSheetFiltros").classList.add("hidden");
    }, 300);
}

function toggleFiltroBadge(btn, tipo, valor) {
    const index = FILTROS_ACTIVOS[tipo].indexOf(valor);
    if (index > -1) {
        FILTROS_ACTIVOS[tipo].splice(index, 1);
        btn.classList.remove("bg-blue-600", "text-white", "border-blue-600");
    } else {
        FILTROS_ACTIVOS[tipo].push(valor);
        btn.classList.add("bg-blue-600", "text-white", "border-blue-600");
    }
    filtrarMatriz();
}

function limpiarFiltros() {
    FILTROS_ACTIVOS = { busqueda: "", estatus: [], ubicacion: "" };
    document.getElementById("input-busqueda").value = "";
    document.getElementById("filtro-ubicacion").value = "";
    document.querySelectorAll(".filter-badge").forEach(b => {
        b.classList.remove("bg-blue-600", "text-white", "border-blue-600");
    });
    renderizarMatriz(listaRegistrosPanel);
}

function filtrarMatriz() {
    const query = document.getElementById("input-busqueda").value.toLowerCase().trim();
    const ubicacion = document.getElementById("filtro-ubicacion").value;

    const filtrados = listaRegistrosPanel.filter(reg => {
        const matchesBusqueda = !query ||
            reg.ID_Unidad.toLowerCase().includes(query) ||
            reg.Marca.toLowerCase().includes(query) ||
            reg.Nombre_Taller.toLowerCase().includes(query) ||
            reg.Nombre_Taller_Ext.toLowerCase().includes(query) ||
            reg.ID_Registro.toString().includes(query);

        const matchesEstatus = FILTROS_ACTIVOS.estatus.length === 0 || FILTROS_ACTIVOS.estatus.includes(reg.Estatus);
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        return matchesBusqueda && matchesEstatus && matchesUbicacion;
    });

    renderizarMatriz(filtrados);
}

/**
 * Consulta y despliega la matriz operativa en tiempo real
 */
async function cargarTablaEditable() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr class="block md:table-row">
            <td colspan="7" class="block md:table-cell p-8 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                <i class="fa-solid fa-spinner animate-spin mr-2 text-xs"></i> Interconectando con Base de Datos Central...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        
        const res = await response.json();
        if (res.status !== "SUCCESS") {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || res.unidades || [];
        
        // Mapeo y normalización estricta de cabeceras
        listaRegistrosPanel = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }
            
            // Buscador flexible para campos específicos
            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            // Deserialización segura del string de tareas (JSON)
            let tareasRaw = getV(["TAREAS", "CHECKLIST", "TAREA"]) || u["Tareas"] || "";
            let tareasArray = [];
            try {
                if (tareasRaw) {
                    tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
                }
            } catch(e) { 
                console.error("Error parseando JSON de tareas en registro", e); 
            }

            return {
                ID_Registro: getV(["IDREGISTRO", "REGISTRO"]) || u["ID_Registro"] || "S/I",
                ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "S/I",
                Nombre_Taller: getV(["NOMBRETALLER", "TALLER"]) || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: getV(["TALLEREXT"]) || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: getV(["OBSERVACIONES", "DETALLE", "NOVEDAD", "OBS"]) || u["Observaciones"] || "",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Avance: parseInt(getV(["AVANCE", "PORCENTAJE"]) || 0, 10),
                Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
                Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
                Fecha_Ingreso: getV(["FECHAING", "FECHA"]) || u["Fecha_Ingr"] || u["Fecha_Ingreso"] || "N/A",
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
                Gerencia: getV(["GERENCIA", "USUARIA"]) || u["Gerencia"] || "",
                Usuario: getV(["USUARIO", "CHOFER", "CONDUCTOR"]) || u["Usuario"] || "",
                Tareas: tareasArray
            };
        });

        actualizarSelectGerencias();

        if (listaRegistrosPanel.length === 0) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen unidades activas en el historial.</td></tr>`;
            return;
        }

        renderizarMatriz(listaRegistrosPanel);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs">Error crítico de enlace de datos.</td></tr>`;
    }
}

/**
 * Renderiza la matriz operativa basándose en un set de datos (soporta filtrado)
 */
function renderizarMatriz(datos) {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">Sin registros que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    // Renderizado inverso (últimos ingresos arriba)
    [...datos].reverse().forEach(reg => {
        let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;

        let badgeFotoAntes = reg.Foto_Antes
            ? `<a href="${reg.Foto_Antes}" target="_blank" class="text-blue-400 hover:text-blue-300 transition-colors text-[9px] font-bold flex items-center gap-1"><i class="fa-solid fa-image"></i> Antes</a>`
            : '';

        let badgeFotoDespues = reg.Foto_Despues
            ? `<a href="${reg.Foto_Despues}" target="_blank" class="text-emerald-400 hover:text-emerald-300 transition-colors text-[9px] font-bold flex items-center gap-1"><i class="fa-solid fa-circle-check"></i> Después</a>`
            : '';

        // Definición de estilo de estatus y colores de fila
        let badgeEstatus = `<span class="bg-amber-950/60 border border-amber-500/30 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase">⚠️ Por Atender</span>`;
        let colorFila = "bg-slate-900/40 border-slate-800/80 hover:bg-slate-950/40";

        if (reg.Estatus === "En Proceso") {
            badgeEstatus = `<span class="bg-blue-950/60 border border-blue-500/30 text-blue-400 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase">⚙️ En Proceso</span>`;
            colorFila = "bg-blue-900/10 border-blue-500/20 hover:bg-blue-900/20";
        } else if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") {
            badgeEstatus = `<span class="bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide uppercase">✅ Listo</span>`;
            colorFila = "bg-emerald-900/10 border-emerald-500/20 hover:bg-emerald-900/20";
        } else if (reg.Estatus === "Por Atender") {
            colorFila = "bg-amber-900/5 border-amber-500/20 hover:bg-amber-900/10";
        }

        let filaHtml = `
            <tr id="fila-${reg.ID_Registro}" class="block md:table-row ${colorFila} md:bg-transparent border md:border-b md:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 transition-colors">
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 text-slate-500 font-mono text-[10px] font-bold border-b border-slate-800/30 md:border-none">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">ID Registro:</span>
                    <span>${reg.ID_Registro}</span>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-800/30 md:border-none">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Unidad / Marca:</span>
                    <div class="text-right md:text-left">
                        <span class="font-black text-white tracking-wider font-mono block text-xs">${reg.ID_Unidad}</span>
                        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wide">${reg.Marca}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-800/30 md:border-none text-right md:text-left text-slate-300 font-medium text-[11px]">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Ubicación:</span>
                    <div>
                        <div class="font-semibold text-slate-300">${fosaFinal}</div>
                        <div class="flex gap-2 justify-end md:justify-start flex-wrap mt-0.5">${badgeFotoAntes} ${badgeFotoDespues}</div>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-800/30 md:border-none">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Avance (%):</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="font-mono text-[10px] font-black text-blue-400 bg-blue-950/50 border border-blue-500/20 px-2 py-0.5 rounded-md">${reg.Avance}%</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-800/30 md:border-none md:w-40">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Estatus</span>
                    <div class="flex justify-end md:justify-start">
                        ${badgeEstatus}
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-800/30 md:border-none text-right md:text-left">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Novedad</span>
                    <p class="text-[11px] text-slate-300 font-medium max-w-xs truncate md:whitespace-normal" title="${reg.Observaciones}">
                        ${reg.Observaciones}
                    </p>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 md:w-28 text-center">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Acciones</span>
                    <div class="flex gap-1.5 justify-end md:justify-center">
                        <button onclick="abrirModalEditar('${reg.ID_Registro}')" class="bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white p-1.5 rounded-lg transition-all border border-slate-700/60 hover:border-blue-500 shadow-md cursor-pointer flex items-center gap-1 text-[10px] font-bold" title="Planificación y Control Avanzado">
                            <i class="fa-solid fa-list-check"></i> <span class="md:hidden">Gestionar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", filaHtml);
    });
}

/**
 * Convierte archivos binarios a cadenas DataURL Base64
 */
function transformarABase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) resolve("");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/**
 * Actualiza los Select2 de gerencias con las opciones base y los datos encontrados en la tabla
 */
function actualizarSelectGerencias() {
    // Opciones estáticas base extendidas según el script del usuario
    const opcionesBase = [
        "VP EYP TRANSPORTE TERRESTRE",
        "VP EYP SUBDIRECCION ADJUNTA DE PRODUCCION OCCIDENTE",
        "VP EYP SERVICIOS LOGISTICOS",
        "VP EYP SERVICIOS ELECTRICOS",
        "VP EYP SEGURIDAD INDUSTRIAL E HIGIENE OCUPACIONAL",
        "VP EYP RELACIONES GUBERNAMENTALES PROPIEDADES Y CATASTRO",
        "VP EYP RECURSOS HUMANOS",
        "VP EYP PROYECTOS MAYORES",
        "VP EYP PROYECTO UP INJ SOC CAMPO MENE DE ACOSTA",
        "VP EYP PROCURA Y CONTROL DE INVENTARIO",
        "VP EYP PLANIFICACION, PRESUPUESTO Y GESTION",
        "VP EYP PDVSA ECUADOR",
        "VP EYP OFICINA DE APOYO",
        "VP EYP INGENIERIA DE COSTOS",
        "VP EYP GERENCIA OPERACION INTEGRAL DE PLANTAS",
        "VP EYP GERENCIA CORP DE CONFIGURACION DE PLANES",
        "VP EYP FINANZAS",
        "VP EYP DIVISION SUR DEL LAGO TRUJILLO",
        "VP EYP DIVISION LAGO",
        "VP EYP DIVISION COSTA ORIENTAL DEL LAGO",
        "VP EYP DIVISION COSTA OCCIDENTAL DEL LAGO",
        "VP EYP DIRECCION EJECUTIVA DE PRODUCCION OCCIDENTE",
        "VP EYP DIRECCION ADJUNTA DE PRODUCCION OCCIDENTE",
        "VP EYP DESARROLLO SOCIAL",
        "VP EYP COSTA AFUERA",
        "VP EYP COORDINACION OPERACIONAL",
        "VP EYP CONTRATACION",
        "VP EYP CONFIABILIDAD OPERACIONAL",
        "VP EYP ASUNTOS PUBLICOS",
        "VP EYP ASUNTOS JURIDICOS",
        "VP EYP AMBIENTE",
        "VICEPRESIDENCIA EXPLORACION Y PRODUCCION",
        "PETROQUIMICA DE VENEZUELA, S.A",
        "PETROLEOS DE VENEZUELA S.A. YACIMIENTO",
        "PDVSA VASSA",
        "PDVSA SERVICIOS PETROLEROS S.A.",
        "PDVSA INGENIERIA Y CONSTRUCCION",
        "PDVSA INDUSTRIAL",
        "PDVSA GAS COMUNAL, S.A",
        "PDVSA GAS",
        "PDVSA ENT",
        "PDV SERVICIOS DE SALUD",
        "MINPET",
        "INTEVEP",
        "EM PETROZAMORA",
        "EM PETROWAYU",
        "EM PETROWARAO",
        "EM PETROURDANETA",
        "EM PETROREGIONAL DEL LAGO",
        "EM PETROQUIRIQUIRE",
        "EM PETROPERIJA",
        "EM PETROLERA SINOVENEZOLANA",
        "EM PETROLERA BIELOVENEZOLANA",
        "EM PETROINDEPENDIENTE",
        "EM PETROCUMAREBO",
        "EM PETROCABIMAS",
        "EM PETROBOSCAN",
        "EM LAGOPETROL",
        "EM BARIPETROL",
        "DIRECCION EJECUTIVA CYSN",
        "DIREC EJEC EXPLOR Y ESTUDIOS INTEG Y YAC",
        "DIR. EJECUTIVA DE SEGURIDAD INTEGRAL",
        "CVP EEMM OCCIDENTE",
        "CVP",
        "BARIVEN"
    ];

    // Extraer gerencias de los datos actuales, normalizarlas a Mayúsculas y filtrar vacíos
    const gerenciasDeDatos = listaRegistrosPanel
        .map(r => String(r.Gerencia || "").trim().toUpperCase())
        .filter(g => g !== "");

    // Unificar, eliminar duplicados y ordenar
    const todasGerencias = [...new Set([...opcionesBase, ...gerenciasDeDatos])].sort();

    // Actualizar los Select2
    const data = todasGerencias.map(g => ({ id: g, text: g }));

    $('#add-gerencia, #edit-gerencia').each(function() {
        const $el = $(this);
        const val = $el.val();
        $el.empty().select2({
            placeholder: 'Seleccione o escriba...',
            tags: true,
            data: data,
            dropdownParent: $el.closest('.fixed')
        }).val(val).trigger('change');
    });
}


// ==========================================
// CONTROLADORES DE MODAL 1: NUEVO INGRESO
// ==========================================
function abrirModalNuevo() {
    document.getElementById("formNuevoRegistro").reset(); 
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("add-fecha-ingreso").value = hoy;
    document.getElementById("wrapper-externo").classList.add("hidden"); 
    document.getElementById("modalNuevoRegistro").classList.remove("hidden");
}

function cerrarModalNuevo() {
    document.getElementById("modalNuevoRegistro").classList.add("hidden");
}

function alternarTallerExterno(valor) {
    document.getElementById("wrapper-externo").classList.toggle("hidden", valor !== "TALLER EXTERNO (Terceros)");
}

async function guardarNuevoRegistro(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-crear-submit");
    const fileInput = document.getElementById("add-foto-antes");
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Procesando Imagen...`;

    let fotoBase64 = "";
    if (fileInput.files.length > 0) {
        fotoBase64 = await transformarABase64(fileInput.files[0]);
    }

    let fechaRaw = document.getElementById("add-fecha-ingreso").value;
    let fechaFormateada = "";
    if(fechaRaw) {
        const parts = fechaRaw.split("-");
        fechaFormateada = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const payload = {
        accion: "crear",
        unidad: document.getElementById("add-unidad").value.trim(),
        marca: document.getElementById("add-marca").value.trim(),
        flota: $('#add-flota').val(),
        nombre_taller: document.getElementById("add-taller").value,
        nombre_taller_ext: document.getElementById("add-taller-ext").value.trim(),
        gerencia: $('#add-gerencia').val(),
        usuario: document.getElementById("add-chofer").value.trim(),
        observaciones: document.getElementById("add-observa").value.trim(),
        fecha_ingreso: fechaFormateada,
        foto_antes_base64: fotoBase64,
        modificado_por: OPERADOR_ACTUAL
    };

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            cerrarModalNuevo();
            await cargarTablaEditable();
        } else {
            alert("Error: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación al registrar.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
    }
}

// ==========================================
// CONTROLADORES DE MODAL 2: DIAGNÓSTICO & CHECKLIST
// ==========================================
function abrirModalEditar(id) {
    const registro = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    if (!registro) return;

    document.getElementById("edit-id-registro").value = registro.ID_Registro;
    document.getElementById("edit-unidad").value = registro.ID_Unidad;
    document.getElementById("edit-marca").value = registro.Marca;

    $('#edit-gerencia').val(registro.Gerencia).trigger('change');
    $('#edit-flota').val(registro.Tipo_Flota).trigger('change');

    document.getElementById("edit-chofer").value = registro.Usuario;
    document.getElementById("edit-observa").value = registro.Observaciones;
    document.getElementById("edit-estatus").value = registro.Estatus;

    // Duplicamos en memoria local las tareas del registro
    tareasModalActual = Array.isArray(registro.Tareas) ? [...registro.Tareas] : [];
    
    renderizarTareasModal();
    document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modalEditarRegistro").classList.add("hidden");
}

/**
 * Procesa el render de elementos del checklist y gestiona los estados del motor Plan vs Real
 */
function renderizarTareasModal() {
    const container = document.getElementById("edit-container-tareas");
    container.innerHTML = "";

    if (tareasModalActual.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-600 italic py-2 text-center">No hay tareas de diagnóstico asignadas.</p>`;
    } else {
        tareasModalActual.forEach((tarea, index) => {
            const itemHtml = `
                <div class="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800/60 gap-2">
                    <label class="flex items-center gap-2 flex-1 cursor-pointer select-none">
                        <input type="checkbox" ${tarea.hecho ? "checked" : ""} 
                               onchange="alternarTareaModal(${index})"
                               class="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer">
                        <span class="text-xs ${tarea.hecho ? "line-through text-slate-500 font-medium" : "text-slate-200 font-medium"} truncate max-w-[280px]">
                            ${tarea.texto}
                        </span>
                    </label>
                    <button type="button" onclick="eliminarTareaModal(${index})" class="text-slate-600 hover:text-red-400 p-1 transition-colors">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", itemHtml);
        });
    }

    // Evaluación matemática del avance real
    let avanceCalculado = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceCalculado = Math.round((completadas / total) * 100);
    }

    const selectorEstatus = document.getElementById("edit-estatus");
    
    // Regla automática: Si existen tareas y todas se marcaron completas, forzar 'Listo'
    if (tareasModalActual.length > 0 && avanceCalculado === 100) {
        selectorEstatus.value = "Listo";
    }

    // Regla manual: Si el operador fuerza estatus a 'Listo', el avance se asume al 100%
    if (selectorEstatus.value === "Listo") {
        avanceCalculado = 100;
    }
    
    actualizarInterfazAvanceModal(avanceCalculado);
}

function agregarTareaModal() {
    const input = document.getElementById("edit-nueva-tarea");
    const texto = input.value.trim();
    if (!texto) return;

    tareasModalActual.push({ texto: texto, hecho: false });
    input.value = "";
    renderizarTareasModal();
}

function alternarTareaModal(index) {
    if (tareasModalActual[index]) {
        tareasModalActual[index].hecho = !tareasModalActual[index].hecho;
        renderizarTareasModal();
    }
}

function eliminarTareaModal(index) {
    tareasModalActual.splice(index, 1);
    renderizarTareasModal();
}

function evaluarEstatusModal(valor) {
    if (valor === "Listo") {
        actualizarInterfazAvanceModal(100);
    } else {
        renderizarTareasModal(); 
    }
}

function actualizarInterfazAvanceModal(porcentaje) {
    document.getElementById("edit-lbl-avance-calculado").textContent = porcentaje + "%";
    const wrapperFoto = document.getElementById("wrapper-foto-despues");
    
    // Habilita o bloquea la carga de la foto final según el avance real
    if (porcentaje === 100) {
        wrapperFoto.classList.remove("hidden");
    } else {
        wrapperFoto.classList.add("hidden");
        document.getElementById("edit-foto-despues").value = ""; 
    }
}

/**
 * Empaqueta el diagnóstico final, calcula cierres de fecha y procesa base64 de salida
 */
async function guardarEdicionModal(event) {
    event.preventDefault();
    const id = document.getElementById("edit-id-registro").value;
    const btn = document.getElementById("btn-editar-submit");
    const fileInput = document.getElementById("edit-foto-despues");
    
    const original = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    const estatus = document.getElementById("edit-estatus").value;
    
    let avanceFinal = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceFinal = Math.round((completadas / total) * 100);
    }
    if (estatus === "Listo") avanceFinal = 100;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Actualizando registros...`;

    let fotoDespuesBase64 = "";
    if (fileInput && fileInput.files.length > 0) {
        fotoDespuesBase64 = await transformarABase64(fileInput.files[0]);
    }

    let fechaSalidaStr = original ? original.Fecha_Salida : "";
    if (estatus === "Listo" && !fechaSalidaStr) {
        const hoy = new Date();
        fechaSalidaStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    }

    const payload = {
        accion: "editar",
        id_registro: id,
        marca: document.getElementById("edit-marca").value.trim(),
        flota: $('#edit-flota').val(),
        gerencia: $('#edit-gerencia').val(),
        usuario: document.getElementById("edit-chofer").value.trim(),
        observaciones: document.getElementById("edit-observa").value.trim(),
        estatus: estatus,
        avance: avanceFinal.toString(),
        tareas: JSON.stringify(tareasModalActual), // Matriz serializada para persistencia en una sola celda
        foto_antes: original ? original.Foto_Antes : "",
        foto_despues: original ? original.Foto_Despues : "", 
        foto_despues_base64: fotoDespuesBase64, 
        fecha_salida: fechaSalidaStr,
        modificado_por: OPERADOR_ACTUAL
    };

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            cerrarModalEditar();
            await cargarTablaEditable();
        } else {
            alert("Error: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo crítico de comunicación.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    }
}
