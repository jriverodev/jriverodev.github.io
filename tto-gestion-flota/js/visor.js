// js/visor.js - Inteligencia Analítica e Interactividad Gerencial (PRODUCCIÓN CENTRALIZADA)

let datosUnidadesGlobal = [];
let instanciaChartTalleres = null;
let instanciaChartEstatus = null;
let registroSeleccionadoId = null;

document.addEventListener("DOMContentLoaded", cargarDatosAnaliticos);

// EXTRAER Y PROCESAR REPOSITORIO CENTRAL
async function cargarDatosAnaliticos() {
    try {
        const tbody = document.getElementById("tablaCuerpo");
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Sincronizando con Google Sheets...</td></tr>`;
        }

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });

        if (!response.ok) throw new Error(`Fallo en HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || res.unidades || [];

        // NORMALIZADOR TÁCTICO DE COLUMNAS (Mapeo tolerante a fallas)
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
                Observaciones: normalized["OBSERVACIONES"] || normalized["DETALLE"] || u["Observaciones"] || "Sin novedades",
                Fecha_Registro: normalized["FECHAREGISTRO"] || normalized["FECHA"] || u["Fecha_Registro"] || "N/A",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
                Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
                Avance: parseInt(normalized["AVANCE"] || normalized["PORCENTAJEAVANCE"] || u["Avance"] || 0, 10),
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || ""
            };
        });

        // Métricas de KPIs
        let total = datosUnidadesGlobal.length;
        let porAtender = datosUnidadesGlobal.filter(r => r.Estatus === "Por Atender").length;
        let enProceso = datosUnidadesGlobal.filter(r => r.Estatus === "En Proceso").length;
        let listos = total - (porAtender + enProceso); 
        let porcDispo = total > 0 ? Math.round((listos / total) * 100) : 100;

        document.getElementById("kpiTotal").textContent = total;
        document.getElementById("kpiEspera").textContent = porAtender;
        document.getElementById("kpiProceso").textContent = enProceso;
        document.getElementById("kpiDispo").textContent = `${porcDispo}%`;

        if (total === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen registros operativos</td></tr>`;
            return;
        }

        if (tbody) {
            tbody.innerHTML = "";
            let conteoTalleres = {};

            [...datosUnidadesGlobal].reverse().forEach(reg => {
                let nombreTallerFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
                conteoTalleres[nombreTallerFinal] = (conteoTalleres[nombreTallerFinal] || 0) + 1;

                let badgeColor = "bg-amber-500/10 text-amber-400 border border-amber-500/30";
                if (reg.Estatus === "En Proceso") badgeColor = "bg-blue-500/10 text-blue-400 border border-blue-500/30";
                if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";

                let fila = `
                    <tr class="hover:bg-slate-950/30 transition-colors">
                        <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${reg.ID_Registro}</td>
                        <td class="p-3 font-black text-white tracking-wider font-mono">${reg.ID_Unidad} ${reg.Marca ? `<span class="text-[9px] text-slate-400 block font-sans font-normal uppercase tracking-wide">${reg.Marca}</span>` : ''}</td>
                        <td class="p-3 text-slate-400 text-[10px] font-bold">${reg.Tipo_Flota}</td>
                        <td class="p-3 text-slate-300 font-medium">${nombreTallerFinal}</td>
                        
                        <td class="p-3 min-w-[100px]">
                            <div class="flex flex-col gap-1 justify-center">
                                <span class="font-mono text-[10px] font-bold text-slate-400">${reg.Avance}%</span>
                                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden border border-slate-700/30">
                                    <div class="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500" style="width: ${reg.Avance}%"></div>
                                </div>
                            </div>
                        </td>

                        <td class="p-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeColor}">${reg.Estatus}</span></td>
                        <td class="p-3 text-slate-400 max-w-xs truncate" title="${reg.Observaciones}">${reg.Observaciones}</td>
                        <td class="p-3 font-mono text-slate-500 text-[11px]">${reg.Fecha_Registro}</td>
                        <td class="p-2 text-center">
                            <button onclick="abrirModalEditar('${reg.ID_Registro}')" class="bg-slate-800 hover:bg-blue-600 hover:text-white text-blue-400 p-1.5 rounded-lg transition-all border border-slate-700/60 cursor-pointer shadow" title="Gestionar Ficha">
                                <i class="fa-solid fa-file-pen text-xs"></i>
                            </button>
                        </td>
                    </tr>
                `;
                tbody.insertAdjacentHTML("beforeend", fila);
            });

            renderizarGraficos(conteoTalleres, porAtender, enProceso, listos);
        }

    } catch (err) {
        console.error("Error crítico en visor:", err);
        const tbody = document.getElementById("tablaCuerpo");
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal en red de datos central.</td></tr>`;
    }
}

// MANAGEMENT DEL MODAL GERENCIAL
function abrirModalEditar(idRegistro) {
    const registro = datosUnidadesGlobal.find(r => String(r.ID_Registro) === String(idRegistro));
    if (!registro) return;

    registroSeleccionadoId = idRegistro;

    document.getElementById("modalIdRegistro").textContent = registro.ID_Registro;
    document.getElementById("modalUnidadTexto").textContent = registro.ID_Unidad;
    document.getElementById("inputMarca").value = registro.Marca;
    document.getElementById("selectEstatus").value = registro.Estatus;
    document.getElementById("inputTaller").value = registro.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? registro.Nombre_Taller_Ext : registro.Nombre_Taller;
    document.getElementById("txtObservaciones").value = registro.Observaciones;
    document.getElementById("inputFotoAntes").value = registro.Foto_Antes;
    document.getElementById("inputFotoDespues").value = registro.Foto_Despues;
    document.getElementById("inputAvance").value = registro.Avance;
    document.getElementById("txtAvanceValor").textContent = registro.Avance + "%";

    // Calcular ciclo congelado o dinámico
    const dias = calcularDiasTranscurridos(registro.Fecha_Registro, registro.Fecha_Salida);
    document.getElementById("modalDiasTexto").textContent = dias === 0 ? "Ingresó el día de hoy" : `${dias} ${dias === 1 ? 'día' : 'días'} en patio`;

    if (registro.Fecha_Salida && registro.Fecha_Salida !== "") {
        document.getElementById("modalFechaSalidaTexto").textContent = "Salida: " + registro.Fecha_Salida;
        document.getElementById("modalFechaSalidaTexto").classList.remove("hidden");
    } else {
        document.getElementById("modalFechaSalidaTexto").classList.add("hidden");
    }

    document.getElementById("modalEdicion").classList.remove("hidden");
}

function cerrarModal() {
    document.getElementById("modalEdicion").classList.add("hidden");
    document.getElementById("formEdicionUnidad").reset();
    registroSeleccionadoId = null;
}

// CALCULO CRONOLÓGICO CONGELADO (Evita desvíos en KPIs de Control)
function calcularDiasTranscurridos(fechaIngresoStr, fechaSalidaStr) {
    if (!fechaIngresoStr || fechaIngresoStr === "N/A") return 0;
    try {
        const partesIngreso = fechaIngresoStr.split(/[-/]/);
        if (partesIngreso.length !== 3) return 0;
        
        const fechaIngreso = new Date(parseInt(partesIngreso[2], 10), parseInt(partesIngreso[1], 10) - 1, parseInt(partesIngreso[0], 10));
        let fechaFin = new Date();

        if (fechaSalidaStr && fechaSalidaStr !== "" && fechaSalidaStr !== "N/A") {
            const partesSalida = fechaSalidaStr.split(/[-/]/);
            if (partesSalida.length === 3) {
                fechaFin = new Date(parseInt(partesSalida[2], 10), parseInt(partesSalida[1], 10) - 1, parseInt(partesSalida[0], 10));
            }
        }
        
        fechaIngreso.setHours(0,0,0,0);
        fechaFin.setHours(0,0,0,0);
        
        const diferenciaMili = fechaFin - fechaIngreso;
        const dias = Math.floor(diferenciaMili / (1000 * 60 * 60 * 24));
        return dias < 0 ? 0 : dias;
    } catch (e) {
        return 0;
    }
}

// ENVÍO DE ACTUALIZACIONES (Lectura/Escritura bidireccional)
async function guardarCambiosEdicion(e) {
    e.preventDefault();
    const btnGuardar = document.getElementById("btnGuardarModal");
    const estatusSeleccionado = document.getElementById("selectEstatus").value;
    
    let fechaSalidaData = "";
    let avanceAsignado = document.getElementById("inputAvance").value;

    // Forzar el 100% de avance si el estatus se declara "Listo"
    if (estatusSeleccionado === "Listo") {
        avanceAsignado = "100";
        fechaSalidaData = obtenerFechaFormato(); 
    }

    const payload = {
        accion: "editar",
        id_registro: registroSeleccionadoId,
        marca: document.getElementById("inputMarca").value.trim(),
        estatus: estatusSeleccionado,
        observaciones: document.getElementById("txtObservaciones").value.trim(),
        foto_antes: document.getElementById("inputFotoAntes").value.trim(),
        foto_despues: document.getElementById("inputFotoDespues").value.trim(),
        avance: avanceAsignado,
        fecha_salida: fechaSalidaData
    };

    try {
        btnGuardar.disabled = true;
        btnGuardar.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Guardando...`;

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Error de transmisión");
        const res = await response.json();

        if (res.status === "SUCCESS") {
            cerrarModal();
            await cargarDatosAnaliticos();
        } else {
            alert(`Error de sincronización: ${res.message}`);
        }
    } catch (err) {
        console.error("Fallo de red:", err);
        alert("Fallo crítico de red comunicando con Google Server.");
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    }
}

// RENDERIZADO DE GRÁFICOS RESPONSIVOS
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

// UTILERÍAS CRONOLÓGICAS Y EXPORTACIONES
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
    if (!tabla || document.getElementById("tablaCuerpo").rows[0]?.cells?.length === 1) return alert("Base sin datos.");
    const libro = XLSX.utils.table_to_book(tabla, { sheet: "Bitácora" });
    XLSX.writeFile(libro, `Reporte_Patio_TTOCC_${obtenerFechaFormato()}.xlsx`);
}

function exportarAPDF() {
    const elemento = document.getElementById("contenedorTablaReporte");
    if (!elemento || document.getElementById("tablaCuerpo").rows[0]?.cells?.length === 1) return alert("Base sin datos.");
    html2pdf().set({
        margin: 0.3,
        filename: `Reporte_Patio_TTOCC_${obtenerFechaFormato()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#0b1329', useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    }).from(elemento).save();
}
