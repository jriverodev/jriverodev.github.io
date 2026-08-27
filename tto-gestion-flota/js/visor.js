// js/visor.js - Consola de Solo Lectura y Métricas Estadísticas para Pantalla Gerencial
"use strict";

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosAnaliticos();

    const searchInput = document.getElementById("visor-busqueda");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(filtrarVisor, 250));
    }
});

/**
 * Convierte una fecha/hora a un formato relativo estilo red social
 * @param {string|Date} fechaInput - Fecha ISO, string ejecutable o Date
 * @returns {string} Texto formateado con tiempo relativo
 */
function tiempoTranscurrido(fechaInput) {
    if (!fechaInput) return 'S/I';

    let fecha;
    if (fechaInput instanceof Date) {
        fecha = fechaInput;
    } else if (typeof fechaInput === 'string') {
        const str = fechaInput.trim();
        if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
            fecha = new Date(str);
        } else {
            const partesFechaHora = str.split(" ");
            const partesFecha = partesFechaHora[0].split("-");
            if (partesFecha.length === 3) {
                if (partesFecha[0].length === 4) {
                    fecha = new Date(str);
                } else {
                    const dia = parseInt(partesFecha[0], 10);
                    const mes = parseInt(partesFecha[1], 10) - 1;
                    const anio = parseInt(partesFecha[2], 10);

                    let horas = 0;
                    let minutos = 0;
                    if (partesFechaHora[1]) {
                        const partesHora = partesFechaHora[1].split(":");
                        horas = parseInt(partesHora[0], 10) || 0;
                        minutos = parseInt(partesHora[1], 10) || 0;
                    }
                    fecha = new Date(anio, mes, dia, horas, minutos);
                }
            } else {
                fecha = new Date(str);
            }
        }
    } else {
        fecha = new Date(fechaInput);
    }

    if (isNaN(fecha.getTime())) return escapeHTML(String(fechaInput));

    const ahora = new Date();
    const diferenciaMs = ahora - fecha;
    const diferenciaSeg = Math.floor(diferenciaMs / 1000);
    const diferenciaMin = Math.floor(diferenciaSeg / 60);
    const diferenciaHoras = Math.floor(diferenciaMin / 60);
    const diferenciaDias = Math.floor(diferenciaHoras / 24);

    const formatoHora = fecha.toLocaleTimeString('es-ES', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).toLowerCase();

    const ayer = new Date(ahora);
    ayer.setDate(ahora.getDate() - 1);
    const esAyer = fecha.getDate() === ayer.getDate() &&
                   fecha.getMonth() === ayer.getMonth() &&
                   fecha.getFullYear() === ayer.getFullYear();

    if (diferenciaSeg < 60) {
        return 'hace un momento';
    } else if (diferenciaMin < 60) {
        return `hace ${diferenciaMin} min`;
    } else if (diferenciaHoras < 24 && fecha.getDate() === ahora.getDate()) {
        return `hace ${diferenciaHoras} ${diferenciaHoras === 1 ? 'hora' : 'horas'}`;
    } else if (esAyer) {
        return `ayer a las ${formatoHora}`;
    } else if (diferenciaDias < 30) {
        return `hace ${diferenciaDias} ${diferenciaDias === 1 ? 'día' : 'días'}`;
    } else if (diferenciaDias < 365) {
        const meses = Math.floor(diferenciaDias / 30);
        return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
    } else {
        const años = Math.floor(diferenciaDias / 365);
        return `hace ${años} ${años === 1 ? 'año' : 'años'}`;
    }
}

function toggleSeccion(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle("hidden");
        if (id === 'visor-graficos-contenedor' && !el.classList.contains("hidden")) {
            setTimeout(actualizarGraficosVivos, 50);
        }
    }
}

async function cargarDatosAnaliticos() {
    const tbody = document.getElementById("tablaCuerpo");
    try {
        if (tbody) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Sincronizando datos de Historial...</td></tr>`;
        }

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });

        if (!response.ok) throw new Error(`Fallo HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${escapeHTML(res.message)}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || [];

        datosUnidadesGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                let val = u[key];
                if (typeof val === 'string' && (val.includes('drive.google.com') || val.includes('docs.google.com'))) {
                    let driveId = '';
                    if (val.includes('id=')) driveId = val.split('id=')[1]?.split('&')[0];
                    else if (val.includes('/file/d/')) driveId = val.split('/file/d/')[1]?.split('/')[0];
                    if (driveId) val = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
                }
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = val;
            }
            
            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            let tareasRaw = getV(["TAREAS", "CHECKLIST", "TAREA"]) || u["Tareas"] || "";
            let tareasArray = [];
            try {
                if (tareasRaw) {
                    tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
                }
            } catch(e) { console.error("Error parseando tareas", e); }

            const fechaRegRaw = getV(["FECHAING", "FECHA"]) || u["Fecha_Ingr"] || u["Fecha_Ingreso"] || "N/A";

            let parsedFechaTimestamp = 0;
            if (fechaRegRaw && fechaRegRaw !== "N/A") {
                const strReg = String(fechaRegRaw).trim();
                let dt;
                if (strReg.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(strReg)) {
                    dt = new Date(strReg);
                } else {
                    const partesFechaHora = strReg.split(" ");
                    const partesFecha = partesFechaHora[0].split("-");
                    if (partesFecha.length === 3 && partesFecha[0].length !== 4) {
                        const d = parseInt(partesFecha[0], 10);
                        const m = parseInt(partesFecha[1], 10) - 1;
                        const y = parseInt(partesFecha[2], 10);
                        dt = new Date(y, m, d);
                    } else {
                        dt = new Date(strReg);
                    }
                }
                if (!isNaN(dt.getTime())) {
                    parsedFechaTimestamp = dt.getTime();
                }
            }

            const fotoAntesRaw = normalized["FOTOANTES"] || u["Foto_Antes"] || "";
            const fotoDespuesRaw = normalized["FOTODESPUES"] || u["Foto_Despues"] || "";

            return {
                ID_Registro: getV(["IDREGISTRO", "REGISTRO"]) || u["ID_Registro"] || "S/I",
                ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "S/I",
                Nombre_Taller: getV(["NOMBRETALLER", "TALLER"]) || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: getV(["TALLEREXT"]) || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: getV(["OBSERVACIONES", "DETALLE", "NOVEDAD", "OBS"]) || u["Observaciones"] || "Sin novedades",
                Fecha_Registro: fechaRegRaw,
                Fecha_Registro_Timestamp: parsedFechaTimestamp,
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Gerencia: getV(["GERENCIA", "USUARIA"]) || u["Gerencia"] || "N/A",
                Usuario: getV(["USUARIO", "CHOFER", "CONDUCTOR"]) || u["Usuario"] || "S/I",
                Avance: parseInt(getV(["AVANCE", "PORCENTAJE"]) || 0, 10),
                Modificado_Por: getV(["MODIFICADO"]) || u["Modificado_Por"] || "S/I",
                Foto_Antes: typeof normalizarUrlStorage === 'function' ? normalizarUrlStorage(fotoAntesRaw) : fotoAntesRaw,
                Foto_Despues: typeof normalizarUrlStorage === 'function' ? normalizarUrlStorage(fotoDespuesRaw) : fotoDespuesRaw,
                Tareas: tareasArray
            };
        });

        calcularKpisGlobales(datosUnidadesGlobal);
        renderizarVisor(datosUnidadesGlobal);

    } catch (err) {
        console.error("Error analítico en visor:", err);
        if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con la red central.</td></tr>`;
    }
}

function calcularKpisGlobales(datos) {
    let total = datos.length;
    let porAtender = datos.filter(r => r.Estatus === "Por Atender").length;
    let enProceso = datos.filter(r => r.Estatus === "En Proceso").length;
    let listos = total - (porAtender + enProceso);

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiEspera").textContent = porAtender;
    document.getElementById("kpiProceso").textContent = enProceso;
    document.getElementById("kpiDispo").textContent = listos;
}

function filtrarVisor() {
    const query = document.getElementById("visor-busqueda").value.toLowerCase().trim();
    const estatus = document.getElementById("visor-filtro-estatus").value;
    const ubicacion = document.getElementById("visor-filtro-ubicacion").value;
    const fechaDesde = document.getElementById("visor-fecha-desde").value;
    const fechaHasta = document.getElementById("visor-fecha-hasta").value;

    const fDesdeTs = fechaDesde ? new Date(fechaDesde).getTime() : null;
    const fHastaTs = fechaHasta ? new Date(fechaHasta).getTime() : null;

    const filtrados = datosUnidadesGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query) ||
            String(reg.Gerencia || "").toLowerCase().includes(query);

        const matchesEstatus = !estatus || reg.Estatus === estatus;
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        let matchesFecha = true;
        if ((fDesdeTs !== null || fHastaTs !== null) && reg.Fecha_Registro_Timestamp) {
            if (fDesdeTs !== null && reg.Fecha_Registro_Timestamp < fDesdeTs) matchesFecha = false;
            if (fHastaTs !== null && reg.Fecha_Registro_Timestamp > fHastaTs) matchesFecha = false;
        }

        return matchesBusqueda && matchesEstatus && matchesUbicacion && matchesFecha;
    });

    renderizarVisor(filtrados);
}

function limpiarFiltrosVisor() {
    document.getElementById("visor-busqueda").value = "";
    document.getElementById("visor-filtro-estatus").value = "";
    document.getElementById("visor-filtro-ubicacion").value = "";
    document.getElementById("visor-fecha-desde").value = "";
    document.getElementById("visor-fecha-hasta").value = "";
    renderizarVisor(datosUnidadesGlobal);
}

function renderizarVisor(datos) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    let total = datos.length;

    if (total === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen registros que coincidan con los filtros</td></tr>`;
        renderizarGraficos({}, 0, 0, 0);
        return;
    }

    let conteoTalleres = {};
    let porAtender = 0;
    let enProceso = 0;
    let listos = 0;

    const htmlFilas = [...datos].reverse().map(reg => {
        if (reg.Estatus === "Por Atender") porAtender++;
        else if (reg.Estatus === "En Proceso") enProceso++;
        else listos++;

        let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${escapeHTML(reg.Nombre_Taller_Ext)}` : escapeHTML(reg.Nombre_Taller);
        conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;

        let badgeColor = "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500";
        let colorFila = "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-950/40";

        if (reg.Estatus === "En Proceso") {
            badgeColor = "bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400";
            colorFila = "bg-blue-500/[0.02] dark:bg-blue-900/10 border-blue-500/10 dark:border-blue-500/20 hover:bg-blue-500/[0.05] dark:hover:bg-blue-900/20";
        } else if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") {
            badgeColor = "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400";
            colorFila = "bg-emerald-500/[0.02] dark:bg-emerald-900/10 border-emerald-500/10 dark:border-emerald-500/20 hover:bg-emerald-500/[0.05] dark:hover:bg-emerald-900/20";
        } else if (reg.Estatus === "Por Atender") {
            colorFila = "bg-amber-500/[0.02] dark:bg-amber-900/5 border-amber-500/10 dark:border-amber-500/20 hover:bg-amber-500/[0.05] dark:hover:bg-amber-900/10";
        }

        const idRegEscaped = escapeHTML(reg.ID_Registro);

        return `
            <tr id="fila-${idRegEscaped}"
    class="block md:table-row ${colorFila || 'bg-white dark:bg-transparent'} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">   
    
             <td class="flex justify-between items-center md:table-cell p-2 md:p-4 font-mono text-[10px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
              <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">ID Registro</span>
    
              <span class="text-right md:text-left font-black tracking-widest text-slate-700 dark:text-slate-400 transition-colors">#${idRegEscaped}</span>
             </td>

                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Unidad</span>
                    <div class="text-right md:text-left">
                    <span class="font-black text-slate-900 dark:text-white tracking-widest font-mono block text-xs transition-colors">${escapeHTML(reg.ID_Unidad)}</span>
                    <span class="text-[9px] text-slate-500 dark:text-slate-400 block font-sans font-black uppercase tracking-[0.1em] transition-colors">${escapeHTML(reg.Marca)}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Gerencia / Usuario</span>
                    <div class="text-right md:text-left">
                    <span class="text-slate-800 dark:text-white block font-black uppercase text-[10px] tracking-tight transition-colors">${escapeHTML(reg.Gerencia)}</span>
                    <span class="text-slate-500 dark:text-slate-400 block text-[9px] uppercase tracking-widest font-black transition-colors">${escapeHTML(reg.Usuario)}</span>
                    </div>
                </td>
                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Flota</span>
                    <span class="text-slate-700 dark:text-slate-400 font-black text-right md:text-left text-[10px] uppercase tracking-widest transition-colors">${escapeHTML(reg.Tipo_Flota)}</span>
                 </td>
                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Ubicación</span>
                    <span class="text-slate-800 dark:text-slate-300 font-black text-right md:text-left text-[10px] uppercase tracking-wider transition-colors">${nombreTallerFinal}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">
                        Avance
                    </span>
                    <div class="flex items-center justify-end md:justify-start">
                    <span class="font-mono text-[12px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded-md transition-colors">
                        ${reg.Avance}%
                    </span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">
                        Estatus
                    </span>
    
                    <div class="flex items-center justify-end md:justify-start">
                    <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${badgeColor}">
                        ${escapeHTML(reg.Estatus)}
                    </span>
                    </div>
                </td>

                <td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 block transition-colors">Obs:</span>
    
                    <p class="text-[11px] text-slate-700 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed text-left transition-colors" title="${escapeHTML(reg.Observaciones)}">
                        ${escapeHTML(reg.Observaciones) || 'Sin observaciones.'}
                    </p>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Fechas</span>
                    <div class="text-right md:text-left font-mono text-[12px] font-black tracking-tighter">
                    <div class="text-blue-600 dark:text-blue-500/90"><i class="fa-solid fa-calendar-day text-[12px]"></i> ${escapeHTML(reg.Fecha_Registro)}</div>
                    <div class="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-tight mt-0.5"><i class="fa-solid fa-clock text-[10px]"></i> ${tiempoTranscurrido(reg.Fecha_Registro)}</div>
                    ${reg.Fecha_Salida ? `<div class="text-emerald-600 dark:text-emerald-500/90 mt-1"><i class="fa-solid fa-circle-check text-[12px]"></i> ${escapeHTML(reg.Fecha_Salida)}</div>` : ''}
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 md:w-28 text-center transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Detalle</span>
                    <div class="flex justify-end md:justify-center">
                        <button onclick="abrirModalDetalle('${idRegEscaped}')"
                        class="bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-md shadow-slate-200 dark:shadow-black/20 transition-all active:scale-95">
                        Detalle
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlFilas.join('');
    renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
}

function abrirModalDetalle(id) {
    const reg = datosUnidadesGlobal.find(r => String(r.ID_Registro) === String(id));
    if (!reg) return;

    document.getElementById("detalle-titulo-unidad").textContent = `UNIDAD: ${reg.ID_Unidad} - ${reg.Marca}`;
    document.getElementById("detalle-subtitulo-id").textContent = `ID REGISTRO: #${reg.ID_Registro} | FLOTA: ${reg.Tipo_Flota}`;

    document.getElementById("det-estatus").textContent = reg.Estatus;
    document.getElementById("det-ubicacion").textContent = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? reg.Nombre_Taller_Ext : reg.Nombre_Taller;
    document.getElementById("det-marca-flota").textContent = `${reg.Marca} (${reg.Tipo_Flota})`;
    document.getElementById("det-fecha-ingr").innerHTML = `${escapeHTML(reg.Fecha_Registro)} <span class="text-[10px] text-slate-400 dark:text-slate-500 lowercase font-normal ml-1">(${tiempoTranscurrido(reg.Fecha_Registro)})</span>`;
    document.getElementById("det-fecha-salida").textContent = reg.Fecha_Salida || "PENDIENTE";
    document.getElementById("det-usuario").textContent = reg.Usuario;
    document.getElementById("det-modificado-por").textContent = reg.Modificado_Por;
    document.getElementById("det-observaciones").textContent = reg.Observaciones;

    const tareasContainer = document.getElementById("det-container-tareas");
    tareasContainer.innerHTML = "";

    if (reg.Tareas && reg.Tareas.length > 0) {
        const docFrag = document.createDocumentFragment();
        reg.Tareas.forEach(t => {
            const item = document.createElement("div");
            item.className = "flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800/40 transition-colors";

            item.innerHTML = `
                <i class="fa-solid ${t.hecho ? 'fa-circle-check text-emerald-500' : 'fa-circle-dot text-slate-400 dark:text-slate-600'} text-sm transition-colors"></i>
                <span class="text-xs ${t.hecho ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'} font-medium transition-colors">${escapeHTML(t.texto)}</span>
            `;
            docFrag.appendChild(item);
        });
        tareasContainer.appendChild(docFrag);
    } else {
        tareasContainer.innerHTML = `<p class="text-[10px] text-slate-500 dark:text-slate-600 italic text-center py-4 transition-colors">No se asignaron tareas específicas en el diagnóstico.</p>`;
    }

    const fotoAntes = document.getElementById("det-foto-antes-container");
    const fotoDespues = document.getElementById("det-foto-despues-container");

    if (reg.Foto_Antes) {
        fotoAntes.innerHTML = `
            <a href="${escapeHTML(reg.Foto_Antes)}" class="pswp-link w-full h-full block" data-pswp-width="1200" data-pswp-height="900">
                <img src="${escapeHTML(reg.Foto_Antes)}" class="w-full h-full object-contain" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'text-[9px] font-black uppercase text-slate-500\'>IMAGEN NO DISPONIBLE</span>';">
            </a>`;
        fotoAntes.onclick = null;
    } else {
        fotoAntes.innerHTML = `<span class="text-[9px] font-black uppercase text-slate-600">SIN FOTO ANTES</span>`;
        fotoAntes.onclick = null;
    }

    if (reg.Foto_Despues) {
        fotoDespues.innerHTML = `
            <a href="${escapeHTML(reg.Foto_Despues)}" class="pswp-link w-full h-full block" data-pswp-width="1200" data-pswp-height="900">
                <img src="${escapeHTML(reg.Foto_Despues)}" class="w-full h-full object-contain" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'text-[9px] font-black uppercase text-slate-500\'>IMAGEN NO DISPONIBLE</span>';">
            </a>`;
        fotoDespues.onclick = null;
    } else {
        fotoDespues.innerHTML = `<span class="text-[9px] font-black uppercase text-slate-600">SIN FOTO DESPUES</span>`;
        fotoDespues.onclick = null;
    }

    document.getElementById("modalDetalleRegistro").classList.remove("hidden");
}

function cerrarModalDetalle() {
    document.getElementById("modalDetalleRegistro").classList.add("hidden");
}

function renderizarGraficos(talleresData, espera, proceso, listos) {
    const canvasTalleres = document.getElementById("chartTalleres");
    const canvasEstatus = document.getElementById("chartEstatus");

    if (!canvasTalleres || !canvasEstatus) return;

    if (instanciaChartTalleres) instanciaChartTalleres.destroy();
    if (instanciaChartEstatus) instanciaChartEstatus.destroy();

    const esMovil = window.innerWidth < 768;

    const ctxTalleres = canvasTalleres.getContext('2d');
    instanciaChartTalleres = new Chart(ctxTalleres, {
        type: 'doughnut',
        data: {
            labels: Object.keys(talleresData),
            datasets: [{
                data: Object.values(talleresData),
                backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899'],
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

    const ctxEstatus = canvasEstatus.getContext('2d');
    instanciaChartEstatus = new Chart(ctxEstatus, {
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
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

function actualizarGraficosVivos() {
    if (instanciaChartTalleres) instanciaChartTalleres.resize();
    if (instanciaChartEstatus) instanciaChartEstatus.resize();
}

function exportarAExcel() {
    if (datosUnidadesGlobal.length === 0) return TTOCC_UI.error("Error de Exportación", "No hay datos disponibles en el visor para generar el archivo Excel.");

    const exportData = datosUnidadesGlobal.map(reg => ({
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
        "Observaciones": reg.Observaciones,
        "Modificado Por": reg.Modificado_Por,
        "Checklist": JSON.stringify(reg.Tareas),
        "Link Foto Antes": reg.Foto_Antes,
        "Link Foto Después": reg.Foto_Despues
    }));

    const hoja = XLSX.utils.json_to_sheet(exportData);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Historial Completo");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `TTOCC_Historial_Completo_${fecha}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    if (datosUnidadesGlobal.length === 0) return TTOCC_UI.error("Error de Exportación", "No hay datos para exportar a PDF.");

    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_TTOCC_Gerencial.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}

function filtrarPorKpi(estatus) {
    const selectEstatus = document.getElementById('visor-filtro-estatus');
    if (selectEstatus) {
        selectEstatus.value = estatus;
        if (typeof filtrarVisor === 'function') {
            filtrarVisor();
        }
    }
}
