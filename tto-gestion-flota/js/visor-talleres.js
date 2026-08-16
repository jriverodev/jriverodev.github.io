// js/visor.js - Consola de Solo Lectura y Métricas Estadísticas para Pantalla Gerencial

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

document.addEventListener("DOMContentLoaded", cargarDatosAnaliticos);

/**
 * Convierte una fecha/hora a un formato relativo estilo red social (ej. "hace 40 min", "ayer a las 5:00 pm")
 * @param {string|Date} fechaInput - Fecha ISO, string ejecutable o Date
 * @returns {string} Texto formateado con tiempo relativo
 */
function tiempoTranscurrido(fechaInput) {
    if (!fechaInput) return 'S/I';

    let fecha;
    if (fechaInput instanceof Date) {
        fecha = fechaInput;
    } else if (typeof fechaInput === 'string') {
        // Soporte para formato latino dd-mm-yyyy hh:mm o dd-mm-yyyy
        const partesFechaHora = fechaInput.trim().split(" ");
        const partesFecha = partesFechaHora[0].split("-");
        if (partesFecha.length === 3) {
            const dia = parseInt(partesFecha[0], 10);
            const mes = parseInt(partesFecha[1], 10) - 1; // 0-indexed
            const anio = parseInt(partesFecha[2], 10);

            let horas = 0;
            let minutos = 0;
            if (partesFechaHora[1]) {
                const partesHora = partesFechaHora[1].split(":");
                horas = parseInt(partesHora[0], 10) || 0;
                minutos = parseInt(partesHora[1], 10) || 0;
            }
            fecha = new Date(anio, mes, dia, horas, minutos);
        } else {
            fecha = new Date(fechaInput);
        }
    } else {
        fecha = new Date(fechaInput);
    }

    if (isNaN(fecha.getTime())) return fechaInput; // Retorna original si la fecha es inválida

    const ahora = new Date();
    const diferenciaMs = ahora - fecha;
    const diferenciaSeg = Math.floor(diferenciaMs / 1000);
    const diferenciaMin = Math.floor(diferenciaSeg / 60);
    const diferenciaHoras = Math.floor(diferenciaMin / 60);
    const diferenciaDias = Math.floor(diferenciaHoras / 24);

    // Formatear hora (ej. "5:00 pm")
    const formatoHora = fecha.toLocaleTimeString('es-ES', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).toLowerCase();

    // Comprobar si fue "Ayer"
    const ayer = new Date(ahora);
    ayer.setDate(ahora.getDate() - 1);
    const esAyer = fecha.getDate() === ayer.getDate() &&
                   fecha.getMonth() === ayer.getMonth() &&
                   fecha.getFullYear() === ayer.getFullYear();

    // Reglas estilo redes sociales
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

/**
 * Alterna la visibilidad de secciones (Filtros y Gráficos)
 */
function toggleSeccion(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle("hidden");
        // Si se muestran los gráficos, forzar redibujado para evitar glitches de tamaño
        if (id === 'visor-graficos-contenedor' && !el.classList.contains("hidden")) {
            setTimeout(actualizarGraficosVivos, 50);
        }
    }
}

// EXTRAER REGISTROS DESDE LA PESTAÑA HISTORIAL_MANTENIMIENTO
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
            if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || [];

        // MAPEADOR TOLERANTE (Garantiza lectura sin importar mayúsculas/minúsculas de la cabecera)
        datosUnidadesGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                let val = u[key];
                // Limpieza de URLs de Drive para evitar CORB
                if (typeof val === 'string' && val.includes('drive.google.com/uc?')) {
                    const id = val.split('id=')[1]?.split('&')[0];
                    if (id) val = `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
                }
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = val;
            }

            // Buscador flexible para campos específicos
            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            // Procesamiento de tareas (JSON)
            let tareasRaw = getV(["TAREAS", "CHECKLIST", "TAREA"]) || u["Tareas"] || "";
            let tareasArray = [];
            try {
                if (tareasRaw) {
                    tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
                }
            } catch(e) { console.error("Error parseando tareas", e); }

            return {
                ID_Registro: getV(["IDREGISTRO", "REGISTRO"]) || u["ID_Registro"] || "S/I",
                ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "S/I",
                Nombre_Taller: getV(["NOMBRETALLER", "TALLER"]) || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: getV(["TALLEREXT"]) || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: getV(["OBSERVACIONES", "DETALLE", "NOVEDAD", "OBS"]) || u["Observaciones"] || "Sin novedades",
                Fecha_Registro: getV(["FECHAING", "FECHA"]) || u["Fecha_Ingr"] || u["Fecha_Ingreso"] || "N/A",
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Gerencia: getV(["GERENCIA", "USUARIA"]) || u["Gerencia"] || "N/A",
                Usuario: getV(["USUARIO", "CHOFER", "CONDUCTOR"]) || u["Usuario"] || "S/I",
                Avance: parseInt(getV(["AVANCE", "PORCENTAJE"]) || 0, 10),
                Modificado_Por: getV(["MODIFICADO"]) || u["Modificado_Por"] || "S/I",
                Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
                Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
                Tareas: tareasArray
            };
        });

        // 1. Cómputo de KPIs fijos globales con toda la data descargada
        calcularKpisGlobales(datosUnidadesGlobal);

        // 2. Renderizado inicial del visor
        renderizarVisor(datosUnidadesGlobal);

    } catch (err) {
        console.error("Error analítico en visor:", err);
        if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con la red central.</td></tr>`;
    }
}

/**
 * Calcula e inyecta las estadísticas fijas basadas en el set inicial de datos globales
 * @param {Array} datos - El array completo con todos los registros del historial
 */
function calcularKpisGlobales(datos) {
    let total = datos.length;
    let porAtender = datos.filter(r => r.Estatus === "Por Atender").length;
    let enProceso = datos.filter(r => r.Estatus === "En Proceso").length;
    let listos = total - (porAtender + enProceso);

    // Los contenedores ahora retienen de forma persistente los totales generales
    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiEspera").textContent = porAtender;
    document.getElementById("kpiProceso").textContent = enProceso;
    document.getElementById("kpiDispo").textContent = listos;
}

/**
 * Lógica de Filtrado Multicriterio (Visor)
 */
function filtrarVisor() {
    const query = document.getElementById("visor-busqueda").value.toLowerCase().trim();
    const estatus = document.getElementById("visor-filtro-estatus").value;
    const ubicacion = document.getElementById("visor-filtro-ubicacion").value;
    const fechaDesde = document.getElementById("visor-fecha-desde").value;
    const fechaHasta = document.getElementById("visor-fecha-hasta").value;

    const filtrados = datosUnidadesGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query) ||
            String(reg.Gerencia || "").toLowerCase().includes(query);

        const matchesEstatus = !estatus || reg.Estatus === estatus;
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        let matchesFecha = true;
        if (fechaDesde || fechaHasta) {
            // reg.Fecha_Registro podría ser "dd-mm-yyyy hh:mm" o "dd-mm-yyyy"
            const partesFechaHora = reg.Fecha_Registro.split(" ");
            const [d, m, y] = partesFechaHora[0].split("-").map(Number);
            const fechaReg = new Date(y, m - 1, d);

            if (fechaDesde) {
                const fDesde = new Date(fechaDesde);
                if (fechaReg < fDesde) matchesFecha = false;
            }
            if (fechaHasta) {
                const fHasta = new Date(fechaHasta);
                if (fechaReg > fHasta) matchesFecha = false;
            }
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

/**
 * Renderiza la tabla y gráficos basándose en el set de datos proporcionado
 */
function renderizarVisor(datos) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    let total = datos.length;

    if (total === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen registros que coincidan con los filtros</td></tr>`;
        renderizarGraficos({}, 0, 0, 0);
        return;
    }

    tbody.innerHTML = "";
    let conteoTalleres = {};

    // Recalcular métricas contextuales locales únicamente para actualizar los gráficos dinámicos
    let porAtender = datos.filter(r => r.Estatus === "Por Atender").length;
    let enProceso = datos.filter(r => r.Estatus === "En Proceso").length;
    let listos = total - (porAtender + enProceso);

    [...datos].reverse().forEach(reg => {
        let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
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

        let fila = `
            <!--tr id="fila-${reg.ID_Registro}" class="block md:table-row ${colorFila} bg-white dark:bg-transparent md:bg-transparent border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors"-->
            <tr id="fila-${reg.ID_Registro}"
    class="block md:table-row ${colorFila || 'bg-white dark:bg-transparent'} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">

             <td class="flex justify-between items-center md:table-cell p-2 md:p-4 font-mono text-[10px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
              <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">ID Registro</span>

              <span class="text-right md:text-left font-black tracking-widest text-slate-700 dark:text-slate-400 transition-colors">#${reg.ID_Registro}</span>
             </td>

                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Unidad</span>
                    <div class="text-right md:text-left">
                    <span class="font-black text-slate-900 dark:text-white tracking-widest font-mono block text-xs transition-colors">${reg.ID_Unidad}</span>
                    <span class="text-[9px] text-slate-500 dark:text-slate-400 block font-sans font-black uppercase tracking-[0.1em] transition-colors">${reg.Marca}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Gerencia / Usuario</span>
                    <div class="text-right md:text-left">
                    <span class="text-slate-800 dark:text-white block font-black uppercase text-[10px] tracking-tight transition-colors">${reg.Gerencia}</span>
                    <span class="text-slate-500 dark:text-slate-400 block text-[9px] uppercase tracking-widest font-black transition-colors">${reg.Usuario}</span>
                    </div>
                </td>
                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Flota</span>
                    <span class="text-slate-700 dark:text-slate-400 font-black text-right md:text-left text-[10px] uppercase tracking-widest transition-colors">${reg.Tipo_Flota}</span>
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

                <!--td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-500 uppercase text-[9px] font-black tracking-widest">Estatus</span>
                    <div class="text-right md:text-left">
                        <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${badgeColor}">${reg.Estatus}</span>
                    </div>
                </td-->

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">
                        Estatus
                    </span>

                    <div class="flex items-center justify-end md:justify-start">
                    <span class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${badgeColor}">
                        ${reg.Estatus}
                    </span>
                    </div>
                </td>

                <!--td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto transition-colors">
                   <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-500 mb-1 block transition-colors">Obs:</span>
                    <p class="text-[11px] text-slate-700 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed text-right md:text-left transition-colors" title="${reg.Observaciones}">
                    ${reg.Observaciones || 'Sin observaciones.'}
                    </p>
                </td-->

                <td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-1 block transition-colors">Obs:</span>

                    <p class="text-[11px] text-slate-700 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed text-left transition-colors" title="${reg.Observaciones}">
                        ${reg.Observaciones || 'Sin observaciones.'}
                    </p>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Fechas</span>
                    <div class="text-right md:text-left font-mono text-[12px] font-black tracking-tighter">
                    <div class="text-blue-600 dark:text-blue-500/90"><i class="fa-solid fa-calendar-day text-[12px]"></i> ${reg.Fecha_Registro}</div>
                    <div class="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-tight mt-0.5"><i class="fa-solid fa-clock text-[10px]"></i> ${tiempoTranscurrido(reg.Fecha_Registro)}</div>
                    ${reg.Fecha_Salida ? `<div class="text-emerald-600 dark:text-emerald-500/90 mt-1"><i class="fa-solid fa-circle-check text-[12px]"></i> ${reg.Fecha_Salida}</div>` : ''}
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 md:w-28 text-center transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Detalle</span>
                    <div class="flex justify-end md:justify-center">
                        <button onclick="abrirModalDetalle('${reg.ID_Registro}')"
                        class="bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 text-[9px] font-black uppercase tracking-[0.2em] cursor-pointer shadow-md shadow-slate-200 dark:shadow-black/20 transition-all active:scale-95">
                        Detalle
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", fila);
    });

    renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
}

// ==========================================
// CONTROLADORES DE MODAL DETALLE
// ==========================================
function abrirModalDetalle(id) {
    const reg = datosUnidadesGlobal.find(r => String(r.ID_Registro) === String(id));
    if (!reg) return;

    document.getElementById("detalle-titulo-unidad").textContent = `UNIDAD: ${reg.ID_Unidad} - ${reg.Marca}`;
    document.getElementById("detalle-subtitulo-id").textContent = `ID REGISTRO: #${reg.ID_Registro} | FLOTA: ${reg.Tipo_Flota}`;

    document.getElementById("det-estatus").textContent = reg.Estatus;
    document.getElementById("det-ubicacion").textContent = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? reg.Nombre_Taller_Ext : reg.Nombre_Taller;
    document.getElementById("det-marca-flota").textContent = `${reg.Marca} (${reg.Tipo_Flota})`;
    document.getElementById("det-fecha-ingr").innerHTML = `${reg.Fecha_Registro} <span class="text-[10px] text-slate-400 dark:text-slate-500 lowercase font-normal ml-1">(${tiempoTranscurrido(reg.Fecha_Registro)})</span>`;
    document.getElementById("det-fecha-salida").textContent = reg.Fecha_Salida || "PENDIENTE";
    document.getElementById("det-usuario").textContent = reg.Usuario;
    document.getElementById("det-modificado-por").textContent = reg.Modificado_Por;
    document.getElementById("det-observaciones").textContent = reg.Observaciones;

    // Renderizar Checklist en el modal
const tareasContainer = document.getElementById("det-container-tareas");
tareasContainer.innerHTML = "";

if (reg.Tareas && reg.Tareas.length > 0) {
    reg.Tareas.forEach(t => {
        const item = document.createElement("div");
        // Ajuste de contenedor: Fondo y borde dinámicos con transición suave
        item.className = "flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800/40 transition-colors";

        item.innerHTML = `
            <i class="fa-solid ${t.hecho ? 'fa-circle-check text-emerald-500' : 'fa-circle-dot text-slate-400 dark:text-slate-600'} text-sm transition-colors"></i>
            <span class="text-xs ${t.hecho ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'} font-medium transition-colors">${t.texto}</span>
        `;
        tareasContainer.appendChild(item);
    });
} else {
    // Texto de "No se asignaron tareas" con colores corregidos para modo claro y oscuro
    tareasContainer.innerHTML = `<p class="text-[10px] text-slate-500 dark:text-slate-600 italic text-center py-4 transition-colors">No se asignaron tareas específicas en el diagnóstico.</p>`;
}

    // Renderizar Fotos
    const fotoAntes = document.getElementById("det-foto-antes-container");
    const fotoDespues = document.getElementById("det-foto-despues-container");

    if (reg.Foto_Antes) {
        fotoAntes.innerHTML = `
            <a href="${reg.Foto_Antes}" class="pswp-link w-full h-full block" data-pswp-width="1200" data-pswp-height="900">
                <img src="${reg.Foto_Antes}" class="w-full h-full object-contain">
            </a>`;
        fotoAntes.onclick = null;
    } else {
        fotoAntes.innerHTML = `<span class="text-[9px] font-black uppercase text-slate-600">SIN FOTO ANTES</span>`;
        fotoAntes.onclick = null;
    }

    if (reg.Foto_Despues) {
        fotoDespues.innerHTML = `
            <a href="${reg.Foto_Despues}" class="pswp-link w-full h-full block" data-pswp-width="1200" data-pswp-height="900">
                <img src="${reg.Foto_Despues}" class="w-full h-full object-contain">
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

// INYECCIÓN DE RENDIMIENTO GRÁFICO (ChartJS)
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

// UTILERÍAS DE EXPORTACIÓN
async function exportarAExcel() {
    if (datosUnidadesGlobal.length === 0) {
        return TTOCC_UI.error("Error de Exportación", "No hay datos disponibles en el visor para generar el archivo Excel.");
    }

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
    const nombreArchivo = `TTOCC_Historial_Completo_${fecha}.xlsx`;

    // Detectar si estamos en APK / Capacitor Nativo
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            // 1. Convertir el libro a base64
            const base64Data = XLSX.write(libro, { bookType: 'xlsx', type: 'base64' });

            // 2. Guardar el archivo en el almacenamiento del dispositivo
            const guardado = await Capacitor.Plugins.Filesystem.writeFile({
                path: nombreArchivo,
                data: base64Data,
                directory: 'DOCUMENTS' // Se guarda en la carpeta Documentos
            });

            // 3. Abrir el menú nativo para compartir/descargar/guardar
            await Capacitor.Plugins.Share.share({
                title: 'Exportación a Excel',
                text: 'Reporte generado con éxito',
                url: guardado.uri,
                dialogTitle: 'Guardar o enviar Excel'
            });

        } catch (error) {
            console.error("Error guardando Excel en APK:", error);
            TTOCC_UI.error("Error", "No se pudo guardar el archivo Excel en el dispositivo.");
        }
    } else {
        // Modo Navegador Web Tradicional
        XLSX.writeFile(libro, nombreArchivo);
    }
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

/**
 * Filtra el visor de forma rápida haciendo clic en las tarjetas de KPI
 * @param {string} estatus - El estatus seleccionado ('Por Atender', 'En Proceso', 'Listo' o '')
 */
function filtrarPorKpi(estatus) {
    const selectEstatus = document.getElementById('visor-filtro-estatus');
    if (selectEstatus) {
        selectEstatus.value = estatus;
        if (typeof filtrarVisor === 'function') {
            filtrarVisor();
        }
    }
}
