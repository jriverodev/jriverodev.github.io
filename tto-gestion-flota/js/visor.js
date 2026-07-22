// ============================================================================
// js/visor.js - Consola de Solo Lectura y Métricas Estadísticas (Gerencial)
// ============================================================================

// Estado Global del Visor
let datosUnidadesGlobal = [];
let datosFiltradosGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

// Configuración de Paginación
const PAGINACION_CONFIG = {
    paginaActual: 1,
    filasPorPagina: 10
};

// Control de peticiones concurrentes
let controllerCarga = null;

// Inicialización al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    cargarDatosAnaliticos();
    
    // Escuchadores para búsqueda con debounce
    const inputBusqueda = document.getElementById("visor-busqueda");
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", debounce(filtrarVisor, 300));
    }

    // Auto-resize de gráficos al cambiar tamaño de pantalla
    window.addEventListener("resize", debounce(actualizarGraficosVivos, 150));
});

/**
 * Alterna la visibilidad de secciones (Filtros, Gráficos, etc.)
 * @param {string} id - ID del elemento HTML
 */
function toggleSeccion(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.toggle("hidden");

    // Si se muestran los gráficos, forzar redibujado para evitar glitches
    if (id === "visor-graficos-contenedor" && !el.classList.contains("hidden")) {
        setTimeout(actualizarGraficosVivos, 50);
    }
}

// ============================================================================
// 1. CARGA Y PROCESAMIENTO DE DATOS
// ============================================================================

/**
 * Extrae y mapea los registros desde el API/Servicio central
 */
async function cargarDatosAnaliticos() {
    const tbody = document.getElementById("tablaCuerpo");

    if (controllerCarga) controllerCarga.abort();
    controllerCarga = new AbortController();

    try {
        if (tbody) {
            tbody.innerHTML = `
                <tr class="block md:table-row">
                    <td colspan="10" class="block md:table-cell p-6 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                        <i class="fa-solid fa-spinner animate-spin mr-1"></i> Sincronizando datos de Historial...
                    </td>
                </tr>`;
        }

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accion: "leer" }),
            signal: controllerCarga.signal
        });

        if (!response.ok) throw new Error(`Fallo HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) {
                tbody.innerHTML = `
                    <tr class="block md:table-row">
                        <td colspan="10" class="block md:table-cell p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">
                            Error: ${escapeHtml(res.message || "Respuesta inválida del servidor")}
                        </td>
                    </tr>`;
            }
            return;
        }

        const filasCrudas = Array.isArray(res.datos) ? res.datos : [];

        // Mapeador Tolerante normalizado
        datosUnidadesGlobal = filasCrudas.map(u => normalizarRegistro(u));
        datosFiltradosGlobal = [...datosUnidadesGlobal];

        // 1. Cómputo de KPIs fijos globales
        calcularKpisGlobales(datosUnidadesGlobal);

        // 2. Poblado dinámico de selects (Ubicaciones)
        poblarFiltroUbicaciones(datosUnidadesGlobal);

        // 3. Renderizado inicial del visor
        PAGINACION_CONFIG.paginaActual = 1;
        renderizarVisor(datosFiltradosGlobal);

    } catch (err) {
        if (err.name === 'AbortError') return;
        
        console.error("[Visor] Error analítico:", err);
        if (tbody) {
            tbody.innerHTML = `
                <tr class="block md:table-row">
                    <td colspan="10" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">
                        Error fatal conectando con la red central.
                    </td>
                </tr>`;
        }
    }
}

/**
 * Normaliza cada fila de datos de entrada sin importar variaciones en la cabecera
 */
function normalizarRegistro(u) {
    const normalized = {};

    for (const key in u) {
        let val = u[key];
        // Limpieza de URLs de Google Drive para evitar bloqueo CORB
        if (typeof val === "string" && val.includes("drive.google.com/uc?")) {
            const fileId = val.split("id=")[1]?.split("&")[0];
            if (fileId) val = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`;
        }
        normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = val;
    }

    // Buscador flexible de campos
    const getV = (terms) => {
        const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
        return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
    };

    // Procesamiento de tareas (Checklist JSON)
    let tareasRaw = getV(["TAREAS", "CHECKLIST", "TAREA"]) || u["Tareas"] || "";
    let tareasArray = [];
    try {
        if (tareasRaw) {
            tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
        }
    } catch (e) {
        console.error("Error parseando checklist de tareas:", e);
    }

    // Estatus estandarizado
    let estatusRaw = String(normalized["ESTATUS"] || u["Estatus"] || "Por Atender").trim();
    let estatusNormalizado = "Por Atender";
    const estatusLower = estatusRaw.toLowerCase();

    if (estatusLower.includes("proceso")) estatusNormalizado = "En Proceso";
    else if (estatusLower.includes("listo") || estatusLower.includes("reparado") || estatusLower.includes("disponible")) estatusNormalizado = "Listo";

    return {
        ID_Registro: String(getV(["IDREGISTRO", "REGISTRO"]) || u["ID_Registro"] || "S/I"),
        ID_Unidad: String(getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I"),
        Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "S/I",
        Nombre_Taller: getV(["NOMBRETALLER", "TALLER"]) || u["Nombre_Taller"] || "No especificado",
        Nombre_Taller_Ext: getV(["TALLEREXT"]) || u["Nombre_Taller_Ext"] || "",
        Estatus: estatusNormalizado,
        Estatus_Raw: estatusRaw,
        Observaciones: getV(["OBSERVACIONES", "DETALLE", "NOVEDAD", "OBS"]) || u["Observaciones"] || "Sin novedades",
        Fecha_Registro: getV(["FECHAING", "FECHA"]) || u["Fecha_Ingr"] || u["Fecha_Ingreso"] || "N/A",
        Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
        Marca: normalized["MARCA"] || u["Marca"] || "N/A",
        Gerencia: getV(["GERENCIA", "USUARIA"]) || u["Gerencia"] || "N/A",
        Usuario: getV(["USUARIO", "CHOFER", "CONDUCTOR"]) || u["Usuario"] || "S/I",
        Avance: Math.min(100, Math.max(0, parseInt(getV(["AVANCE", "PORCENTAJE"]) || 0, 10) || 0)),
        Modificado_Por: getV(["MODIFICADO"]) || u["Modificado_Por"] || "S/I",
        Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
        Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
        Tareas: Array.isArray(tareasArray) ? tareasArray : []
    };
}

// ============================================================================
// 2. CÁLCULO DE KPIS Y FILTRADO
// ============================================================================

/**
 * Calcula e inyecta las estadísticas fijas globales
 */
function calcularKpisGlobales(datos) {
    const total = datos.length;
    const porAtender = datos.filter(r => r.Estatus === "Por Atender").length;
    const enProceso = datos.filter(r => r.Estatus === "En Proceso").length;
    const listos = datos.filter(r => r.Estatus === "Listo").length;

    setElementText("kpiTotal", total);
    setElementText("kpiEspera", porAtender);
    setElementText("kpiProceso", enProceso);
    setElementText("kpiDispo", listos);
}

/**
 * Llena de manera dinámica los talleres/ubicaciones en el filtro SELECT
 */
function poblarFiltroUbicaciones(datos) {
    const selectUbicacion = document.getElementById("visor-filtro-ubicacion");
    if (!selectUbicacion) return;

    const valorActual = selectUbicacion.value;
    const ubicaciones = [...new Set(datos.map(d => d.Nombre_Taller).filter(Boolean))].sort();

    selectUbicacion.innerHTML = `<option value="">Todas las Ubicaciones</option>`;
    ubicaciones.forEach(ub => {
        const opt = document.createElement("option");
        opt.value = ub;
        opt.textContent = ub;
        selectUbicacion.appendChild(opt);
    });

    selectUbicacion.value = valorActual;
}

/**
 * Lógica de Filtrado Multicriterio del Visor
 */
function filtrarVisor() {
    const query = document.getElementById("visor-busqueda")?.value.toLowerCase().trim() || "";
    const estatus = document.getElementById("visor-filtro-estatus")?.value || "";
    const ubicacion = document.getElementById("visor-filtro-ubicacion")?.value || "";
    const fechaDesde = document.getElementById("visor-fecha-desde")?.value || "";
    const fechaHasta = document.getElementById("visor-fecha-hasta")?.value || "";

    datosFiltradosGlobal = datosUnidadesGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            reg.ID_Unidad.toLowerCase().includes(query) ||
            reg.Marca.toLowerCase().includes(query) ||
            reg.Gerencia.toLowerCase().includes(query) ||
            reg.ID_Registro.toLowerCase().includes(query) ||
            reg.Usuario.toLowerCase().includes(query);

        const matchesEstatus = !estatus || reg.Estatus === estatus;
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        let matchesFecha = true;
        if (fechaDesde || fechaHasta) {
            const fechaRegStr = formatearFechaAISO(reg.Fecha_Registro);
            if (fechaRegStr) {
                if (fechaDesde && fechaRegStr < fechaDesde) matchesFecha = false;
                if (fechaHasta && fechaRegStr > fechaHasta) matchesFecha = false;
            }
        }

        return matchesBusqueda && matchesEstatus && matchesUbicacion && matchesFecha;
    });

    PAGINACION_CONFIG.paginaActual = 1;
    renderizarVisor(datosFiltradosGlobal);
}

/**
 * Restablece los filtros de búsqueda
 */
function limpiarFiltrosVisor() {
    setInputValue("visor-busqueda", "");
    setInputValue("visor-filtro-estatus", "");
    setInputValue("visor-filtro-ubicacion", "");
    setInputValue("visor-fecha-desde", "");
    setInputValue("visor-fecha-hasta", "");
    
    datosFiltradosGlobal = [...datosUnidadesGlobal];
    PAGINACION_CONFIG.paginaActual = 1;
    renderizarVisor(datosFiltradosGlobal);
}

/**
 * Aplica un filtro rápido al hacer clic en las tarjetas KPI
 */
function filtrarPorKpi(estatus) {
    const selectEstatus = document.getElementById("visor-filtro-estatus");
    if (selectEstatus) {
        selectEstatus.value = estatus;
        filtrarVisor();
    }
}

// ============================================================================
// 3. RENDERIZADO DE TABLA, PAGINACIÓN Y GRÁFICOS
// ============================================================================

/**
 * Renderiza la tabla con soporte de paginación y refresca gráficos
 */
function renderizarVisor(datos) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    const total = datos.length;

    // Métricas del conjunto actualmente filtrado (para gráficos)
    const conteoTalleres = {};
    let porAtender = 0;
    let enProceso = 0;
    let listos = 0;

    datos.forEach(reg => {
        if (reg.Estatus === "Por Atender") porAtender++;
        else if (reg.Estatus === "En Proceso") enProceso++;
        else listos++;

        const nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" 
            ? `EXT: ${reg.Nombre_Taller_Ext || 'N/A'}` 
            : reg.Nombre_Taller;

        conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;
    });

    if (total === 0) {
        tbody.innerHTML = `
            <tr class="block md:table-row">
                <td colspan="10" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">
                    No existen registros que coincidan con los filtros
                </td>
            </tr>`;
        renderizarPaginador(0);
        renderizarGraficos({}, 0, 0, 0);
        return;
    }

    // Cálculo de Paginación
    const inicio = (PAGINACION_CONFIG.paginaActual - 1) * PAGINACION_CONFIG.filasPorPagina;
    const fin = inicio + PAGINACION_CONFIG.filasPorPagina;
    const datosPagina = datos.slice(inicio, fin);

    // Generar HTML de filas
    const htmlFilas = datosPagina.map(reg => {
        const nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" 
            ? `EXT: ${reg.Nombre_Taller_Ext}` 
            : reg.Nombre_Taller;

        let badgeColor = "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500";
        let colorFila = "bg-white dark:bg-transparent border-slate-200 dark:border-slate-800/40 hover:bg-amber-500/[0.05] dark:hover:bg-amber-900/10";

        if (reg.Estatus === "En Proceso") {
            badgeColor = "bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400";
            colorFila = "bg-blue-500/[0.02] dark:bg-blue-900/10 border-blue-500/10 dark:border-blue-500/20 hover:bg-blue-500/[0.05] dark:hover:bg-blue-900/20";
        } else if (reg.Estatus === "Listo") {
            badgeColor = "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
            colorFila = "bg-emerald-500/[0.02] dark:bg-emerald-900/10 border-emerald-500/10 dark:border-emerald-500/20 hover:bg-emerald-500/[0.05] dark:hover:bg-emerald-900/20";
        }

        const tiempoEfectivo = tiempoTranscurrido(reg.Fecha_Registro, reg.Fecha_Salida);

        return `
            <tr id="fila-${reg.ID_Registro}" class="block md:table-row ${colorFila} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">   
                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 font-mono text-[10px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">ID Registro</span>
                    <span class="text-right md:text-left font-black tracking-widest text-slate-700 dark:text-slate-400">#${escapeHtml(reg.ID_Registro)}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Unidad</span>
                    <div class="text-right md:text-left">
                        <span class="font-black text-slate-900 dark:text-white tracking-widest font-mono block text-xs">${escapeHtml(reg.ID_Unidad)}</span>
                        <span class="text-[9px] text-slate-500 dark:text-slate-400 block font-sans font-black uppercase tracking-[0.1em]">${escapeHtml(reg.Marca)}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Gerencia / Usuario</span>
                    <div class="text-right md:text-left">
                        <span class="text-slate-800 dark:text-white block font-black uppercase text-[10px] tracking-tight">${escapeHtml(reg.Gerencia)}</span>
                        <span class="text-slate-500 dark:text-slate-400 block text-[9px] uppercase tracking-widest font-black">${escapeHtml(reg.Usuario)}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Flota</span>
                    <span class="text-slate-700 dark:text-slate-400 font-black text-right md:text-left text-[10px] uppercase tracking-widest">${escapeHtml(reg.Tipo_Flota)}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Ubicación</span>
                    <span class="text-slate-800 dark:text-slate-300 font-black text-right md:text-left text-[10px] uppercase tracking-wider">${escapeHtml(nombreTallerFinal)}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Avance</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="font-mono text-[12px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded-md">
                            ${reg.Avance}%
                        </span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Estatus</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${badgeColor}">
                            ${escapeHtml(reg.Estatus)}
                        </span>
                    </div>
                </td>

                <td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 block">Obs:</span>
                    <p class="text-[11px] text-slate-700 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed text-left" title="${escapeHtml(reg.Observaciones)}">
                        ${escapeHtml(reg.Observaciones || 'Sin observaciones.')}
                    </p>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Fechas</span>
                    <div class="text-right md:text-left font-mono text-[11px] font-black tracking-tighter">
                        <div class="text-blue-600 dark:text-blue-500/90"><i class="fa-solid fa-calendar-day text-[11px]"></i> ${escapeHtml(reg.Fecha_Registro)}</div>
                        ${reg.Fecha_Salida ? `<div class="text-emerald-600 dark:text-emerald-500/90 mt-0.5"><i class="fa-solid fa-circle-check text-[11px]"></i> ${escapeHtml(reg.Fecha_Salida)}</div>` : ''}
                        <div class="text-amber-600 dark:text-amber-500/90 text-[10px] font-sans font-bold mt-1 tracking-normal">
                            <i class="fa-regular fa-clock text-[10px] mr-0.5"></i> ${tiempoEfectivo}
                        </div>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 md:w-28 text-center">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest">Detalle</span>
                    <div class="flex justify-end md:justify-center">
                        <button onclick="abrirModalDetalle('${escapeHtml(reg.ID_Registro)}')" 
                                class="bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-md shadow-slate-200 dark:shadow-black/20 transition-all active:scale-95">
                            Detalle
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    tbody.innerHTML = htmlFilas;

    // Renderizar controles de Paginación y Gráficos
    renderizarPaginador(total);
    renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
}

/**
 * Renderiza los botones y controles de paginación
 */
function renderizarPaginador(totalItems) {
    let paginadorContainer = document.getElementById("visor-paginador");
    
    if (!paginadorContainer) {
        paginadorContainer = document.createElement("div");
        paginadorContainer.id = "visor-paginador";
        paginadorContainer.className = "flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 px-2 py-3 border-t border-slate-200 dark:border-slate-800";
        
        const tablaPadre = document.getElementById("tablaCuerpo")?.closest(".overflow-x-auto") || document.getElementById("tablaCuerpo")?.parentElement;
        if (tablaPadre) tablaPadre.after(paginadorContainer);
    }

    if (totalItems === 0) {
        paginadorContainer.innerHTML = "";
        return;
    }

    const totalPaginas = Math.ceil(totalItems / PAGINACION_CONFIG.filasPorPagina);
    const inicio = ((PAGINACION_CONFIG.paginaActual - 1) * PAGINACION_CONFIG.filasPorPagina) + 1;
    const fin = Math.min(PAGINACION_CONFIG.paginaActual * PAGINACION_CONFIG.filasPorPagina, totalItems);

    paginadorContainer.innerHTML = `
        <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Mostrando <span class="font-bold text-slate-700 dark:text-slate-200">${inicio}</span> a 
            <span class="font-bold text-slate-700 dark:text-slate-200">${fin}</span> de 
            <span class="font-bold text-slate-700 dark:text-slate-200">${totalItems}</span> registros
        </div>
        <div class="flex items-center gap-2">
            <button onclick="cambiarPagina(${PAGINACION_CONFIG.paginaActual - 1})" 
                    ${PAGINACION_CONFIG.paginaActual === 1 ? 'disabled' : ''}
                    class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <i class="fa-solid fa-chevron-left"></i> Anterior
            </button>
            <span class="text-xs font-black text-slate-700 dark:text-slate-300 px-2">
                ${PAGINACION_CONFIG.paginaActual} / ${totalPaginas}
            </span>
            <button onclick="cambiarPagina(${PAGINACION_CONFIG.paginaActual + 1})" 
                    ${PAGINACION_CONFIG.paginaActual >= totalPaginas ? 'disabled' : ''}
                    class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                Siguiente <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>
    `;
}

function cambiarPagina(nuevaPagina) {
    const totalPaginas = Math.ceil(datosFiltradosGlobal.length / PAGINACION_CONFIG.filasPorPagina);
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas) return;
    
    PAGINACION_CONFIG.paginaActual = nuevaPagina;
    renderizarVisor(datosFiltradosGlobal);
}

// ============================================================================
// 4. CONTROLADORES DEL MODAL DETALLE
// ============================================================================

/**
 * Abre y llena la información detallada del modal del registro
 */
function abrirModalDetalle(id) {
    const reg = datosUnidadesGlobal.find(r => String(r.ID_Registro) === String(id));
    if (!reg) return;

    const tiempoCalc = tiempoTranscurrido(reg.Fecha_Registro, reg.Fecha_Salida);

    setElementText("detalle-titulo-unidad", `UNIDAD: ${reg.ID_Unidad} - ${reg.Marca}`);
    setElementText("detalle-subtitulo-id", `ID REGISTRO: #${reg.ID_Registro} | FLOTA: ${reg.Tipo_Flota}`);
    setElementText("det-estatus", reg.Estatus);
    setElementText("det-ubicacion", reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? reg.Nombre_Taller_Ext : reg.Nombre_Taller);
    setElementText("det-marca-flota", `${reg.Marca} (${reg.Tipo_Flota})`);
    setElementText("det-fecha-ingr", reg.Fecha_Registro);
    setElementText("det-fecha-salida", reg.Fecha_Salida || "PENDIENTE");
    setElementText("det-tiempo-transcurrido", tiempoCalc);
    setElementText("det-usuario", reg.Usuario);
    setElementText("det-modificado-por", reg.Modificado_Por);
    setElementText("det-observaciones", reg.Observaciones);

    // Renderizar Checklist en el modal
    const tareasContainer = document.getElementById("det-container-tareas");
    if (tareasContainer) {
        tareasContainer.innerHTML = "";
        if (reg.Tareas && reg.Tareas.length > 0) {
            const frag = document.createDocumentFragment();
            reg.Tareas.forEach(t => {
                const item = document.createElement("div");
                item.className = "flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800/40 transition-colors";
                item.innerHTML = `
                    <i class="fa-solid ${t.hecho ? 'fa-circle-check text-emerald-500' : 'fa-circle-dot text-slate-400 dark:text-slate-600'} text-sm transition-colors"></i>
                    <span class="text-xs ${t.hecho ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'} font-medium transition-colors">${escapeHtml(t.texto || '')}</span>
                `;
                frag.appendChild(item);
            });
            tareasContainer.appendChild(frag);
        } else {
            tareasContainer.innerHTML = `<p class="text-[10px] text-slate-500 dark:text-slate-600 italic text-center py-4 transition-colors">No se asignaron tareas específicas en el diagnóstico.</p>`;
        }
    }

    // Renderizar Contenedores de Fotos
    renderizarFotoContainer("det-foto-antes-container", reg.Foto_Antes, "SIN FOTO ANTES");
    renderizarFotoContainer("det-foto-despues-container", reg.Foto_Despues, "SIN FOTO DESPUES");

    document.getElementById("modalDetalleRegistro")?.classList.remove("hidden");
}

/**
 * Renderiza contenedor individual de fotos para PhotoSwipe
 */
function renderizarFotoContainer(containerId, urlFoto, textoVacio) {
    const el = document.getElementById(containerId);
    if (!el) return;

    el.onclick = null;
    if (urlFoto) {
        const safeUrl = escapeHtml(urlFoto);
        el.innerHTML = `
            <a href="${safeUrl}" class="pswp-link w-full h-full block" data-pswp-width="1200" data-pswp-height="900" target="_blank" rel="noopener noreferrer">
                <img src="${safeUrl}" class="w-full h-full object-contain" alt="Evidencia Fotográfica" loading="lazy">
            </a>`;
    } else {
        el.innerHTML = `<span class="text-[9px] font-black uppercase text-slate-600">${textoVacio}</span>`;
    }
}

/**
 * Cierra el modal de detalle
 */
function cerrarModalDetalle() {
    document.getElementById("modalDetalleRegistro")?.classList.add("hidden");
}

// ============================================================================
// 5. INYECCIÓN DE GRÁFICOS (ChartJS)
// ============================================================================

function renderizarGraficos(talleresData, espera, proceso, listos) {
    if (typeof Chart === 'undefined') return;

    const canvasTalleres = document.getElementById("chartTalleres");
    const canvasEstatus = document.getElementById("chartEstatus");

    if (!canvasTalleres || !canvasEstatus) return;

    // Destruir instancias previas para liberar memoria
    if (instanciaChartTalleres) {
        instanciaChartTalleres.destroy();
        instanciaChartTalleres = null;
    }
    if (instanciaChartEstatus) {
        instanciaChartEstatus.destroy();
        instanciaChartEstatus = null;
    }

    const esMovil = window.innerWidth < 768;

    // 1. Gráfico Doughnut (Talleres)
    instanciaChartTalleres = new Chart(canvasTalleres.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(talleresData),
            datasets: [{
                data: Object.values(talleresData),
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: esMovil ? 'bottom' : 'right', 
                    labels: { color: '#94a3b8', font: { size: 9, weight: 'bold' }, boxWidth: 12 } 
                } 
            }
        }
    });

    // 2. Gráfico Bar (Estatus)
    instanciaChartEstatus = new Chart(canvasEstatus.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Por Atender', 'En Proceso', 'Disponibles'],
            datasets: [{
                label: 'Unidades',
                data: [espera, proceso, listos],
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9, weight: 'bold' } } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8', font: { size: 9 } }, beginAtZero: true }
            },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * Re-renderiza o escala los gráficos si están visibles
 */
function actualizarGraficosVivos() {
    if (instanciaChartTalleres) instanciaChartTalleres.resize();
    if (instanciaChartEstatus) instanciaChartEstatus.resize();
}

// ============================================================================
// 6. UTILIDADES DE EXPORTACIÓN (Excel & PDF)
// ============================================================================

function exportarAExcel() {
    const dataset = datosFiltradosGlobal.length > 0 ? datosFiltradosGlobal : datosUnidadesGlobal;

    if (dataset.length === 0) {
        return window.TTOCC_UI?.error?.("Error de Exportación", "No hay datos disponibles para generar el archivo Excel.") 
            || alert("No hay datos para exportar.");
    }

    if (typeof XLSX === 'undefined') {
        return alert("La librería XLSX no está cargada en el sistema.");
    }

    const exportData = dataset.map(reg => ({
        "ID Registro": reg.ID_Registro,
        "Unidad": reg.ID_Unidad,
        "Marca": reg.Marca,
        "Flota": reg.Tipo_Flota,
        "Ubicación": reg.Nombre_Taller,
        "Taller Externo": reg.Nombre_Taller_Ext,
        "Estatus": reg.Estatus,
        "Avance %": reg.Avance,
        "Gerencia Usuaria": reg.Gerencia,
        "Usuario/Chofer": reg.Usuario,
        "Fecha Ingreso": reg.Fecha_Registro,
        "Fecha Salida": reg.Fecha_Salida,
        "Tiempo Transcurrido": tiempoTranscurrido(reg.Fecha_Registro, reg.Fecha_Salida),
        "Observaciones": reg.Observaciones,
        "Modificado Por": reg.Modificado_Por,
        "Checklist": JSON.stringify(reg.Tareas),
        "Link Foto Antes": reg.Foto_Antes,
        "Link Foto Después": reg.Foto_Despues
    }));

    const hoja = XLSX.utils.json_to_sheet(exportData);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Historial");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `TTOCC_Historial_${fecha}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    if (!elemento || datosUnidadesGlobal.length === 0) {
        return window.TTOCC_UI?.error?.("Error de Exportación", "No hay datos para exportar a PDF.") 
            || alert("No hay datos para exportar a PDF.");
    }

    if (typeof html2pdf === 'undefined') {
        return alert("La librería html2pdf no está cargada en el sistema.");
    }

    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_TTOCC_Gerencial_${new Date().toISOString().slice(0, 10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}

// ============================================================================
// 7. FUNCIONES AUXILIARES / UTILERÍAS
// ============================================================================

/**
 * Calcula el tiempo transcurrido entre dos fechas o hasta el momento actual
 * @param {string} fechaInicioStr - Fecha inicial en formato string
 * @param {string} [fechaFinStr] - Fecha final opcional (si no se especifica o está pendiente, usa hoy)
 * @returns {string} Texto formateado del tiempo transcurrido (ej. "3d 12h", "5h 15m")
 */
function tiempoTranscurrido(fechaInicioStr, fechaFinStr = null) {
    if (!fechaInicioStr || fechaInicioStr === "N/A" || fechaInicioStr === "S/I") return "N/A";

    const isoInicio = formatearFechaAISO(fechaInicioStr);
    if (!isoInicio) return "N/A";

    // Intentar parsing con hora si estuviera presente o por defecto a medianoche
    const dateInicio = new Date(isoInicio.includes("T") ? isoInicio : `${isoInicio}T00:00:00`);
    if (isNaN(dateInicio.getTime())) return "N/A";

    let dateFin = new Date(); // Por defecto "ahora"
    
    if (fechaFinStr && fechaFinStr !== "PENDIENTE" && fechaFinStr !== "N/A" && fechaFinStr !== "S/I") {
        const isoFin = formatearFechaAISO(fechaFinStr);
        if (isoFin) {
            const tempFin = new Date(isoFin.includes("T") ? isoFin : `${isoFin}T23:59:59`);
            if (!isNaN(tempFin.getTime())) dateFin = tempFin;
        }
    }

    const diffMs = dateFin - dateInicio;
    if (diffMs < 0) return "0 días";

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias > 30) {
        const meses = Math.floor(diffDias / 30);
        const diasRestantes = diffDias % 30;
        return `${meses}m ${diasRestantes}d`;
    } else if (diffDias >= 1) {
        const horasRestantes = diffHoras % 24;
        return `${diffDias}d ${horasRestantes}h`;
    } else if (diffHoras >= 1) {
        const minsRestantes = diffMins % 60;
        return `${diffHoras}h ${minsRestantes}m`;
    } else {
        return `${Math.max(1, diffMins)}m`;
    }
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setInputValue(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatearFechaAISO(fechaStr) {
    if (!fechaStr || fechaStr === "N/A" || fechaStr === "S/I") return null;

    const strLimpia = String(fechaStr).trim();

    // Si ya viene en formato ISO (YYYY-MM-DD...)
    if (/^\d{4}-\d{2}-\d{2}/.test(strLimpia)) {
        return strLimpia.slice(0, 10);
    }

    // Para formato DD-MM-YYYY, DD/MM/YYYY o con hora
    const partesEspacio = strLimpia.split(" ");
    const fechaSolo = partesEspacio[0];

    const separador = fechaSolo.includes("-") ? "-" : fechaSolo.includes("/") ? "/" : null;
    if (!separador) return null;

    const partes = fechaSolo.split(separador);
    if (partes.length !== 3) return null;

    const [p1, p2, p3] = partes.map(p => p.trim().padStart(2, '0'));

    // Caso YYYY/MM/DD
    if (p1.length === 4) return `${p1}-${p2}-${p3}`;
    // Caso DD/MM/YYYY
    if (p3.length === 4) return `${p3}-${p2}-${p1}`;

    return null;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
