// js/visor.js - Consola de Solo Lectura y Métricas Estadísticas para Pantalla Gerencial

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

document.addEventListener("DOMContentLoaded", cargarDatosAnaliticos);

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
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
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

        renderizarVisor(datosUnidadesGlobal);

    } catch (err) {
        console.error("Error analítico en visor:", err);
        if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con la red central.</td></tr>`;
    }
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
            reg.ID_Unidad.toLowerCase().includes(query) ||
            reg.Marca.toLowerCase().includes(query) ||
            reg.ID_Registro.toString().includes(query);

        const matchesEstatus = !estatus || reg.Estatus === estatus;
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        let matchesFecha = true;
        if (fechaDesde || fechaHasta) {
            const [d, m, y] = reg.Fecha_Registro.split("-").map(Number);
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
 * Renderiza la tabla y KPIs basándose en el set de datos proporcionado
 */
function renderizarVisor(datos) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    // CÓMPUTO DE ESTADÍSTICAS OPERATIVAS (KPIs)
    let total = datos.length;
    let porAtender = datos.filter(r => r.Estatus === "Por Atender").length;
    let enProceso = datos.filter(r => r.Estatus === "En Proceso").length;
    let listos = total - (porAtender + enProceso);
    let porcDispo = total > 0 ? Math.round((listos / total) * 100) : 100;

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiEspera").textContent = porAtender;
    document.getElementById("kpiProceso").textContent = enProceso;
    document.getElementById("kpiDispo").textContent = `${porcDispo}%`;

    if (total === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="9" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen registros que coincidan con los filtros</td></tr>`;
        renderizarGraficos({}, 0, 0, 0);
        return;
    }

    tbody.innerHTML = "";
    let conteoTalleres = {};

    [...datos].reverse().forEach(reg => {
        let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
        conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;

        let badgeColor = "bg-amber-950/60 border border-amber-500/30 text-amber-400";
        if (reg.Estatus === "En Proceso") badgeColor = "bg-blue-950/60 border border-blue-500/30 text-blue-400";
        if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") badgeColor = "bg-emerald-950/60 border border-emerald-500/30 text-emerald-400";

        let fila = `
            <tr class="block md:table-row hover:bg-slate-950/30 border-b border-slate-800/20 transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-slate-900 md:bg-transparent rounded-2xl md:rounded-none">
                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 text-slate-500 font-mono text-[10px] font-bold border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">ID Registro</span>
                    <span class="text-right md:text-left">${reg.ID_Registro}</span>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Unidad</span>
                    <div class="text-right md:text-left">
                        <span class="font-black text-white tracking-wider font-mono block text-xs">${reg.ID_Unidad}</span>
                        <span class="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-wide">${reg.Marca}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Gerencia / Usuario</span>
                    <div class="text-right md:text-left">
                        <span class="text-white block font-bold uppercase text-[10px]">${reg.Gerencia}</span>
                        <span class="text-slate-500 block text-[9px] uppercase tracking-tighter">${reg.Usuario}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Flota</span>
                    <span class="text-slate-300 font-bold text-right md:text-left text-[10px] uppercase">${reg.Tipo_Flota}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Ubicación</span>
                    <span class="text-slate-300 font-medium text-right md:text-left text-[11px]">${nombreTallerFinal}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Avance</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="font-mono text-[10px] font-black text-blue-400 bg-blue-950/50 border border-blue-500/20 px-2 py-0.5 rounded-md">${reg.Avance}%</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Estatus</span>
                    <div class="text-right md:text-left">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}">${reg.Estatus}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Obs</span>
                    <span class="text-slate-400 md:max-w-xs md:truncate text-right md:text-left" title="${reg.Observaciones}">${reg.Observaciones}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Fechas</span>
                    <div class="text-right md:text-left font-mono text-[9px]">
                        <div class="text-blue-400"><i class="fa-solid fa-arrow-right-to-bracket text-[8px]"></i> ${reg.Fecha_Registro}</div>
                        ${reg.Fecha_Salida ? `<div class="text-emerald-400"><i class="fa-solid fa-arrow-right-from-bracket text-[8px]"></i> ${reg.Fecha_Salida}</div>` : ''}
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-3 md:w-28 text-center">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Detalle</span>
                    <div class="flex justify-end md:justify-center">
                        <button onclick="abrirModalDetalle('${reg.ID_Registro}')" class="bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white px-3 py-1 rounded-lg transition-all border border-slate-700 hover:border-blue-500 text-[10px] font-black uppercase tracking-widest cursor-pointer">
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
    document.getElementById("det-fecha-ingr").textContent = reg.Fecha_Registro;
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
            item.className = "flex items-center gap-3 p-2 bg-slate-900/80 rounded-xl border border-slate-800/40";
            item.innerHTML = `
                <i class="fa-solid ${t.hecho ? 'fa-circle-check text-emerald-500' : 'fa-circle-dot text-slate-600'} text-sm"></i>
                <span class="text-xs ${t.hecho ? 'text-slate-300' : 'text-slate-500'} font-medium">${t.texto}</span>
            `;
            tareasContainer.appendChild(item);
        });
    } else {
        tareasContainer.innerHTML = `<p class="text-[10px] text-slate-600 italic text-center py-4">No se asignaron tareas específicas en el diagnóstico.</p>`;
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
function exportarAExcel() {
    if (datosUnidadesGlobal.length === 0) return alert("No hay datos para exportar.");

    // Transformar datos globales para el Excel (incluyendo todo)
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
    if (datosUnidadesGlobal.length === 0) return alert("No hay datos para exportar.");

    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_TTOCC_Gerencial.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}
