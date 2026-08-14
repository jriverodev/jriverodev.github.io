// js/visor-flota.js - Consola de Solo Lectura y Métricas de Catálogo de Flota
"use strict";

let datosActivosGlobal = [];
let instanciaChartFlota = null;
let instanciaChartMarcas = null;

document.addEventListener("DOMContentLoaded", cargarDatosAnaliticos);

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
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="5" class="block md:table-cell p-6 text-center text-emerald-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Sincronizando catálogo de Activos...</td></tr>`;
        }

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer_activos" })
        });

        if (!response.ok) throw new Error(`Fallo HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="5" class="block md:table-cell p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${escapeHTML(res.message)}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || [];

        datosActivosGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }

            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            return {
                ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                Placa: getV(["PLACA"]) || u["Placa"] || "S/I",
                Serial: getV(["SERIAL"]) || u["Serial"] || "S/I",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "Liviana"
            };
        });

        calcularKpisGlobales(datosActivosGlobal);
        renderizarVisor(datosActivosGlobal);

    } catch (err) {
        console.error("Error analítico en visor de flota:", err);
        if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="5" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con la red central.</td></tr>`;
    }
}

function calcularKpisGlobales(datos) {
    let total = datos.length;
    let liviana = datos.filter(r => r.Tipo_Flota === "Liviana").length;
    let pesada = datos.filter(r => r.Tipo_Flota === "Pesada").length;

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiLiviana").textContent = liviana;
    document.getElementById("kpiPesada").textContent = pesada;
}

function filtrarVisor() {
    const query = document.getElementById("visor-busqueda").value.toLowerCase().trim();
    const flota = document.getElementById("visor-filtro-flota").value;

    const filtrados = datosActivosGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Placa || "").toLowerCase().includes(query) ||
            String(reg.Serial || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query);

        const matchesFlota = !flota || reg.Tipo_Flota === flota;

        return matchesBusqueda && matchesFlota;
    });

    renderizarVisor(filtrados);
}

function limpiarFiltrosVisor() {
    document.getElementById("visor-busqueda").value = "";
    document.getElementById("visor-filtro-flota").value = "";
    renderizarVisor(datosActivosGlobal);
}

function renderizarVisor(datos) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="5" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen activos que coincidan con los filtros</td></tr>`;
        renderizarGraficos(0, 0, {});
        return;
    }

    tbody.innerHTML = "";

    let liviana = datos.filter(r => r.Tipo_Flota === "Liviana").length;
    let pesada = datos.filter(r => r.Tipo_Flota === "Pesada").length;

    let conteoMarcas = {};

    [...datos].reverse().forEach(reg => {
        conteoMarcas[reg.Marca || "S/I"] = (conteoMarcas[reg.Marca || "S/I"] || 0) + 1;

        let colorFila = "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-950/20";

        let fila = `
            <tr id="fila-${escapeHTML(reg.ID_Unidad)}"
                class="block md:table-row ${colorFila} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">

                 <td class="flex justify-between items-center md:table-cell p-4 font-mono text-[11px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                     <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">ID Unidad</span>
                     <span class="font-black tracking-widest text-slate-800 dark:text-white text-xs uppercase">${escapeHTML(reg.ID_Unidad)}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 font-mono text-[11px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Placa</span>
                    <span class="text-slate-700 dark:text-slate-300 font-bold uppercase">${escapeHTML(reg.Placa)}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 font-mono text-[11px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Serial del Vehículo</span>
                    <span class="text-slate-600 dark:text-slate-400 uppercase">${escapeHTML(reg.Serial)}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Marca</span>
                    <span class="text-slate-800 dark:text-slate-200 uppercase font-bold text-xs">${escapeHTML(reg.Marca)}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Tipo de Flota</span>
                    <span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">${escapeHTML(reg.Tipo_Flota)}</span>
                 </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", fila);
    });

    renderizarGraficos(liviana, pesada, conteoMarcas);
}

function renderizarGraficos(liviana, pesada, marcasData) {
    const canvasFlota = document.getElementById("chartFlota");
    const canvasMarcas = document.getElementById("chartMarcas");

    if (!canvasFlota || !canvasMarcas) return;

    if (instanciaChartFlota) instanciaChartFlota.destroy();
    if (instanciaChartMarcas) instanciaChartMarcas.destroy();

    const esMovil = window.innerWidth < 768;

    const ctxFlota = canvasFlota.getContext('2d');
    instanciaChartFlota = new Chart(ctxFlota, {
        type: 'doughnut',
        data: {
            labels: ['Liviana', 'Pesada'],
            datasets: [{
                data: [liviana, pesada],
                backgroundColor: ['#10b981', '#f59e0b'],
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

    const ctxMarcas = canvasMarcas.getContext('2d');
    instanciaChartMarcas = new Chart(ctxMarcas, {
        type: 'bar',
        data: {
            labels: Object.keys(marcasData),
            datasets: [{
                label: 'Unidades',
                data: Object.values(marcasData),
                backgroundColor: '#10b981',
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
    if (instanciaChartFlota) instanciaChartFlota.resize();
    if (instanciaChartMarcas) instanciaChartMarcas.resize();
}

function exportarAExcel() {
    if (datosActivosGlobal.length === 0) return TTOCC_UI.error("Error", "No hay datos para exportar.");

    const exportData = datosActivosGlobal.map(reg => ({
        "ID Unidad": reg.ID_Unidad,
        "Placa": reg.Placa,
        "Serial Chasis": reg.Serial,
        "Marca": reg.Marca,
        "Tipo de Flota": reg.Tipo_Flota
    }));

    const hoja = XLSX.utils.json_to_sheet(exportData);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Catálogo de Activos");

    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(libro, `TTOCC_Maestro_Activos_${fecha}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    if (datosActivosGlobal.length === 0) return TTOCC_UI.error("Error", "No hay datos para exportar.");

    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_TTOCC_Maestro_Activos.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}

function filtrarPorKpi(flota) {
    const selectFlota = document.getElementById('visor-filtro-flota');
    if (selectFlota) {
        selectFlota.value = flota;
        filtrarVisor();
    }
}
