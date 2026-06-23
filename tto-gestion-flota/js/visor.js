// js/visor.js - Consola de Solo Lectura y Métricas Estadísticas para Pantalla Gerencial

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

document.addEventListener("DOMContentLoaded", cargarDatosAnaliticos);

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
            
            return {
                ID_Registro: normalized["IDREGISTRO"] || normalized["REGISTRO"] || u["ID_Registro"] || "S/I",
                ID_Unidad: normalized["IDUNIDAD"] || normalized["UNIDAD"] || u["ID_Unidad"] || "S/I",
                Tipo_Flota: normalized["TIPOFLOTA"] || normalized["FLOTA"] || u["Tipo_Flota"] || "S/I",
                Nombre_Taller: normalized["NOMBRETALLER"] || normalized["TALLER"] || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: normalized["NOMBRETALLEREXT"] || normalized["TALLEREXTERNO"] || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: normalized["OBSERVACIONES"] || normalized["DETALLE"] || u["Observaciones"] || "Sin novedades",
                Fecha_Registro: normalized["FECHAREGISTRO"] || normalized["FECHA"] || u["Fecha_Registro"] || "N/A",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Gerencia: normalized["GERENCIA"] || normalized["GERENCIAUSUARIA"] || u["Gerencia"] || "N/A",
                Usuario: normalized["USUARIO"] || normalized["USUARIOCHOFER"] || u["Usuario"] || "S/I",
                Avance: parseInt(normalized["AVANCE"] || normalized["PORCENTAJEAVANCE"] || 0, 10)
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
            // Convertir dd-mm-yyyy a objeto fecha para comparar
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
        renderizarGraficos({}, 0, 0, 0); // Limpiar gráficos
        return;
    }

    tbody.innerHTML = "";
    let conteoTalleres = {};

    // Renderizar ordenado del más reciente al más antiguo
    [...datos].reverse().forEach(reg => {
        let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
        conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;

        // Definición estilizada de Badges
        let badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/30";
        if (reg.Estatus === "En Proceso") badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/30";
        if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

        let fila = `
            <tr class="block md:table-row hover:bg-slate-950/30 border-b border-slate-800/20 transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-slate-900 md:bg-transparent rounded-2xl md:rounded-none">
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 text-slate-500 font-mono text-[11px] font-bold border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">ID Registro</span>
                    <span class="text-right md:text-left">${reg.ID_Registro}</span>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Unidad</span>
                    <div class="text-right md:text-left">
                        <span class="font-black text-white tracking-wider font-mono">${reg.ID_Unidad}</span>
                        ${reg.Marca ? `<span class="text-[9px] text-slate-400 block font-sans font-normal uppercase tracking-wide">${reg.Marca}</span>` : ''}
                    </div>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Gerencia / Usuario</span>
                    <div class="text-right md:text-left">
                        <span class="text-white block font-bold uppercase text-[10px]">${reg.Gerencia}</span>
                        <span class="text-slate-500 block text-[9px] uppercase tracking-tighter">${reg.Usuario}</span>
                    </div>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Flota</span>
                    <span class="text-slate-400 text-[10px] font-bold text-right md:text-left">${reg.Tipo_Flota}</span>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Ubicación</span>
                    <span class="text-slate-300 font-medium text-right md:text-left">${nombreTallerFinal}</span>
                </td>

                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Avance</span>
                    <div class="flex flex-col gap-1 justify-center w-full">
                        <span class="font-mono text-[10px] font-bold text-slate-400 text-right md:text-left">${reg.Avance}%</span>
                        <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/30">
                            <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500" style="width: ${reg.Avance}%"></div>
                        </div>
                    </div>
                </td>

                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Estatus</span>
                    <div class="text-right md:text-left">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}">${reg.Estatus}</span>
                    </div>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Observaciones</span>
                    <span class="text-slate-400 md:max-w-xs md:truncate text-right md:text-left" title="${reg.Observaciones}">${reg.Observaciones}</span>
                </td>
                <td class="grid grid-cols-[40%_60%] md:table-cell items-center p-2 md:p-3">
                    <span class="md:hidden text-slate-400 uppercase text-[9px] font-black">Fecha Ingreso</span>
                    <span class="font-mono text-slate-500 text-[11px] text-right md:text-left">${reg.Fecha_Registro}</span>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", fila);
    });

    renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
}

// INYECCIÓN DE RENDIMIENTO GRÁFICO (ChartJS)
function renderizarGraficos(talleresData, espera, proceso, listos) {
    const canvasTalleres = document.getElementById("chartTalleres");
    const canvasEstatus = document.getElementById("chartEstatus");

    if (!canvasTalleres || !canvasEstatus) return;

    if (instanciaChartTalleres) instanciaChartTalleres.destroy();
    if (instanciaChartEstatus) instanciaChartEstatus.destroy();

    const esMovil = window.innerWidth < 768;

    instanciaChartTalleres = new Chart(canvasTalleres, {
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

    instanciaChartEstatus = new Chart(canvasEstatus, {
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

// UTILERÍAS DE EXPORTACIÓN Y GENERACIÓN DE REPORTES
function obtenerFechaFormato() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    let mm = String(hoy.getMonth() + 1).padStart(2, '0');
    let dd = String(hoy.getDate()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
}

function exportarAExcel() {
    const tabla = document.getElementById("tablaLogistica");
    if (!tabla || document.getElementById("tablaCuerpo").rows[0]?.cells?.length === 1) return alert("No hay datos cargados para exportar.");
    const libro = XLSX.utils.table_to_book(tabla, { sheet: "Historial Mantenimiento" });
    XLSX.writeFile(libro, `Reporte_Mantenimiento_TTOCC_${obtenerFechaFormato()}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    if (!elemento || document.getElementById("tablaCuerpo").rows[0]?.cells?.length === 1) return alert("No hay datos cargados para exportar.");
    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_Mantenimiento_TTOCC_${obtenerFechaFormato()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}
