// js/visor.js - Inteligencia Analítica Ejecutiva (UNIFICADO Y EN PRODUCCIÓN)

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;

document.addEventListener("DOMContentLoaded", () => {
    // Blindaje de acceso opcional (comentar o dejar según tu flujo de seguridad)
    if (typeof validarAccesoPantalla === "function") {
        if (!validarAccesoPantalla("GERENTE")) return;
    }
    
    // Carga inicial automática de la base de datos
    cargarDatosAnaliticos();
});

// CONEXIÓN INTEGRAL CON EL BACKEND DE GOOGLE Y NORMALIZADOR
async function cargarDatosAnaliticos() {
    try {
        const tbody = document.getElementById("tablaCuerpo");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Extrayendo información de Google Sheets...</td></tr>`;
        }

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });

        if (!response.ok) throw new Error(`Fallo en HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = [];
        if (Array.isArray(res)) {
            filasCrudas = res;
        } else if (res && res.status === "SUCCESS") {
            filasCrudas = res.datos || res.unidades || [];
        }

        // =====================================================================
        // NORMALIZADOR INTELIGENTE DE COLUMNAS (Tu blindaje contra cambios)
        // =====================================================================
        datosUnidadesGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                let cleanKey = key.toUpperCase().replace(/_/g, "").replace(/\s/g, "");
                normalized[cleanKey] = u[key];
            }
            
            return {
                ID_Registro: normalized["IDREGISTRO"] || normalized["REGISTRO"] || u["ID_Registro"] || "S/I",
                ID_Unidad: normalized["IDUNIDAD"] || normalized["UNIDAD"] || u["ID_Unidad"] || "S/I",
                Tipo_Flota: normalized["TIPOFLOTA"] || normalized["FLOTA"] || u["Tipo_Flota"] || "S/I",
                ID_Taller: normalized["IDTALLER"] || u["ID_Taller"] || "",
                Nombre_Taller: normalized["NOMBRETALLER"] || normalized["TALLER"] || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: normalized["NOMBRETALLEREXT"] || normalized["TALLEREXTERNO"] || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: normalized["OBSERVACIONES"] || normalized["DETALE"] || normalized["DETALLE"] || normalized["NOTAS"] || u["Observaciones"] || "Sin novedades",
                Fecha_Registro: normalized["FECHAREGISTRO"] || normalized["FECHA"] || u["Fecha_Registro"] || "N/A"
            };
        });

        // Procesar KPIs Numéricos
        let total = datosUnidadesGlobal.length;
        let porAtender = datosUnidadesGlobal.filter(r => r.Estatus === "Por Atender").length;
        let enProceso = datosUnidadesGlobal.filter(r => r.Estatus === "En Proceso").length;
        let listos = total - (porAtender + enProceso); 
        let porcDispo = total > 0 ? Math.round((listos / total) * 100) : 100;

        // Inyectar valores en la interfaz
        document.getElementById("kpiTotal").textContent = total;
        document.getElementById("kpiEspera").textContent = porAtender;
        document.getElementById("kpiProceso").textContent = enProceso;
        document.getElementById("kpiDispo").textContent = `${porcDispo}%`;

        if (total === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen registros en la base de datos</td></tr>`;
            return;
        }

        // Construcción dinámica de la Tabla
        if (tbody) {
            tbody.innerHTML = "";
            let conteoTalleres = {};

            // Renderizado inverso (más nuevo primero)
            [...datosUnidadesGlobal].reverse().forEach(reg => {
                let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
                conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;

                let badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/30";
                if (reg.Estatus === "En Proceso") badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/30";
                if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

                let fila = `
                    <tr class="hover:bg-slate-950/30 transition-colors">
                        <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${reg.ID_Registro}</td>
                        <td class="p-3 font-bold text-white tracking-wider font-mono">${reg.ID_Unidad}</td>
                        <td class="p-3 text-slate-400 text-[10px] font-bold">${reg.Tipo_Flota}</td>
                        <td class="p-3 text-slate-300 font-medium">${nombreTallerFinal}</td>
                        <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}">${reg.Estatus}</span></td>
                        <td class="p-3 text-slate-400 max-w-xs truncate" title="${reg.Observaciones}">${reg.Observaciones}</td>
                        <td class="p-3 text-right font-mono text-slate-500 text-[11px]">${reg.Fecha_Registro}</td>
                    </tr>
                `;
                tbody.insertAdjacentHTML("beforeend", fila);
            });

            // Actualizar la estructura de gráficos
            renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
        }

    } catch (err) {
        console.error("Error crítico en visor:", err);
        const tbody = document.getElementById("tablaCuerpo");
        if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con el repositorio de datos.</td></tr>`;
    }
}

// RENDERIZADO DE GRÁFICOS (MÁXIMO RENDIMIENTO)
function renderizarGraficos(talleresData, espera, proceso, listos) {
    const canvasTalleres = document.getElementById("chartTalleres");
    const canvasEstatus = document.getElementById("chartEstatus");

    if (!canvasTalleres || !canvasEstatus) return;

    const ctxTalleres = canvasTalleres.getContext("2d");
    const ctxEstatus = canvasEstatus.getContext("2d");

    if (instanciaChartTalleres) instanciaChartTalleres.destroy();
    if (instanciaChartEstatus) instanciaChartEstatus.destroy();

    // Gráfico 1: Distribución por Talleres (Dona)
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
            plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10, weight: 'bold' } } } }
        }
    });

    // Gráfico 2: Balance Operativo (Barras)
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
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10, weight: 'bold' } } },
                y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// CONTROL DE EXPORTACIONES DE DATOS
// ==========================================
function obtenerFechaFormato() {
    const hoy = new Date();
    const yyyy = hoy.getFullYear();
    let mm = hoy.getMonth() + 1;
    let dd = hoy.getDate();
    if (dd < 10) dd = '0' + dd;
    if (mm < 10) mm = '0' + mm;
    return `${dd}-${mm}-${yyyy}`;
}

function exportarAExcel() {
    const tabla = document.getElementById("tablaLogistica");
    const tbody = document.getElementById("tablaCuerpo");
    
    if (!tabla || !tbody || tbody.rows[0]?.cells?.length === 1) {
        alert("La base de datos analítica está vacía o cargando.");
        return;
    }
    
    const libro = XLSX.utils.table_to_book(tabla, { sheet: "Bitácora de Patio" });
    XLSX.writeFile(libro, `Reporte_Patio_TTOCC_${obtenerFechaFormato()}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    const tbody = document.getElementById("tablaCuerpo");

    if (!elemento || !tbody || tbody.rows[0]?.cells?.length === 1) {
        alert("La base de datos analítica está vacía o cargando.");
        return;
    }

    const opciones = {
        margin: 0.3,
        filename: `Reporte_Patio_TTOCC_${obtenerFechaFormato()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opciones).from(elemento).save();
}
