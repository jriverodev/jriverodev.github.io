// js/visor-flota.js - Consola de Solo Lectura y Métricas de Catálogo de Flota
"use strict";

let datosActivosGlobal = [];
let datosFiltradosGlobal = [];
let mapaUltimoTaller = {};
let instanciaChartFlota = null;
let instanciaChartMarcas = null;
let paginaActual = 1;
const TAMANO_PAGINA = 20;

document.addEventListener("DOMContentLoaded", () => {
    cargarDatosAnaliticos();

    const searchInput = document.getElementById("visor-busqueda");
    if (searchInput) {
        searchInput.addEventListener("input", debounce(filtrarVisor, 250));
    }
});

function toggleSeccion(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.toggle("hidden");
        if (id === 'visor-graficos-contenedor' && !el.classList.contains("hidden")) {
            setTimeout(actualizarGraficosVivos, 50);
        }
    }
}

async function obtenerMapaUltimoTaller() {
    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            const historial = res.datos || res.unidades || [];
            const mapa = {};
            historial.forEach(item => {
                let normalized = {};
                for (let key in item) {
                    normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = item[key];
                }
                const getV = (terms) => {
                    const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                    return (key !== undefined && normalized[key] !== null) ? String(normalized[key]) : "";
                };

                const rawId = getV(["IDUNIDAD", "UNIDAD"]) || item["ID_Unidad"] || "";
                const idUnidad = String(rawId).toUpperCase();
                const taller = getV(["NOMBRETALLER", "TALLER"]) || item["Nombre_Taller"] || "";
                const tallerExt = getV(["TALLEREXT"]) || item["Nombre_Taller_Ext"] || "";
                const tallerFinal = taller === "TALLER EXTERNO (Terceros)" && tallerExt ? `EXT: ${tallerExt}` : taller;
                const fecha = getV(["FECHAING", "FECHA"]) || item["Fecha_Ingr"] || item["Fecha_Ingreso"] || "";

                if (idUnidad) {
                    mapa[idUnidad] = tallerFinal ? `${tallerFinal} (${fecha || 'S/F'})` : "Sin Historial Taller";
                }
            });
            mapaUltimoTaller = mapa;
        }
    } catch (e) {
        console.warn("No se pudo cargar historial de talleres para ubicación:", e);
    }
}

async function cargarDatosAnaliticos() {
    const tbody = document.getElementById("tablaCuerpo");
    try {
        if (tbody) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-emerald-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Sincronizando catálogo de Activos...</td></tr>`;
        }

        await obtenerMapaUltimoTaller();

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer_activos" })
        });

        if (!response.ok) throw new Error(`Fallo HTTP: ${response.status}`);
        const res = await response.json();

        if (res.status !== "SUCCESS") {
            if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 uppercase tracking-widest text-[10px] font-bold">Error: ${escapeHTML(res.message)}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || [];

        datosActivosGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }

            const getV = (terms) => {
                for (const term of terms) {
                    const cleanTerm = term.toUpperCase().replace(/_/g, "").replace(/\s/g, "");
                    if (normalized[cleanTerm] !== undefined && normalized[cleanTerm] !== null && String(normalized[cleanTerm]).trim() !== "") {
                        return String(normalized[cleanTerm]).trim();
                    }
                    const foundKey = Object.keys(normalized).find(k => k.includes(cleanTerm) && normalized[k] !== null && String(normalized[k]).trim() !== "");
                    if (foundKey !== undefined) {
                        return String(normalized[foundKey]).trim();
                    }
                }
                return "";
            };

            const rawId = getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || u["id_unidad"] || "S/I";
            const idUnidad = String(rawId);
            const idKey = idUnidad.toUpperCase();

            const docRaw = getV(["DOCUMENTOURL", "DOCUMENTO_URL", "DOCUMENTO", "DOC", "PDF"]) || (u["documento_url"] && String(u["documento_url"]).trim()) || (u["Documento_Url"] && String(u["Documento_Url"]).trim()) || "";

            return {
                ID_Unidad: idUnidad,
                Placa: getV(["PLACA"]) || u["Placa"] || u["placa"] || "S/I",
                VIN: getV(["VIN"]) || u["VIN"] || u["vin"] || "S/I",
                Marca: normalized["MARCA"] || u["Marca"] || u["marca"] || "",
                Modelo: normalized["MODELO"] || u["Modelo"] || u["modelo"] || "",
                Color: normalized["COLOR"] || u["Color"] || u["color"] || "",
                Tipo_Vehiculo: getV(["TIPOVEHICULO", "TIPOVEH", "CLASE"]) || u["Tipo_Vehiculo"] || u["tipo_vehiculo"] || "",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || u["tipo_flota"] || u["flota"] || "Liviana",
                Estatus_Final: getV(["ESTATUSFINAL", "ESTATUS"]) || u["Estatus_Final"] || u["estatus_final"] || "",
                Situacion_Actual: getV(["SITUACIONACTUAL", "SITUACION"]) || u["Situacion_Actual"] || u["situacion_actual"] || "",
                Gerencia: getV(["GERENCIA"]) || u["Gerencia"] || u["gerencia"] || "",
                Responsable_Usuario: getV(["RESPONSABLEUSUARIO", "RESPONSABLE", "USUARIO"]) || u["Responsable_Usuario"] || u["responsable_usuario"] || "",
                Cargo_Usuario: getV(["CARGOUSUARIO", "CARGO"]) || u["Cargo_Usuario"] || u["cargo_usuario"] || "",
                Ubicacion_Taller: mapaUltimoTaller[idKey] || getV(["UBICACIONTALLER", "UBICACION"]) || u["Ubicacion_Taller"] || u["ubicacion_taller"] || "Sin Historial Taller",
                Documento_Url: typeof normalizarUrlStorage === 'function' ? normalizarUrlStorage(docRaw, idUnidad) : docRaw,
                Documento_Nombre: getV(["DOCUMENTONOMBRE", "DOCUMENTO_NOMBRE"]) || (u["documento_nombre"] && String(u["documento_nombre"]).trim()) || (u["Documento_Nombre"] && String(u["Documento_Nombre"]).trim()) || ""
            };
        });

        if (typeof firmarUrlsDeRegistros === 'function') {
            await firmarUrlsDeRegistros(datosActivosGlobal, ['Documento_Url']);
        }

        poblarSelectorTipoVehiculo(datosActivosGlobal);
        poblarSelectorEstatus(datosActivosGlobal);
        calcularKpisGlobales(datosActivosGlobal);
        renderizarVisor(datosActivosGlobal);

    } catch (err) {
        console.error("Error analítico en visor de flota:", err);
        if (tbody) tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 uppercase font-bold text-[10px]">Error fatal conectando con la red central.</td></tr>`;
    }
}

function poblarSelectorTipoVehiculo(datos) {
    const select = document.getElementById("visor-filtro-tipo-vehiculo");
    if (!select) return;

    const tipos = [...new Set(datos.map(d => String(d.Tipo_Vehiculo || "").trim()).filter(Boolean))].sort();
    select.innerHTML = '<option value="">TODOS LOS TIPOS</option>';
    tipos.forEach(tipo => {
        select.innerHTML += `<option value="${escapeHTML(tipo)}">${escapeHTML(tipo.toUpperCase())}</option>`;
    });
}

function poblarSelectorEstatus(datos) {
    const select = document.getElementById("visor-filtro-estatus");
    if (!select) return;

    const estatusSet = new Set(datos.map(d => String(d.Estatus_Final || d.Estatus || "").trim()).filter(Boolean));
    const estatus = Array.from(estatusSet).sort((a,b) => a.localeCompare(b, 'es'));
    select.innerHTML = '<option value="">TODOS LOS ESTATUS</option>';
    estatus.forEach(e => {
        select.innerHTML += `<option value="${escapeHTML(e)}">${escapeHTML(e)}</option>`;
    });
}

function calcularKpisGlobales(datos) {
    let total = datos.length;
    let liviana = datos.filter(r => r.Tipo_Flota === "Liviana").length;
    let pesada = datos.filter(r => r.Tipo_Flota === "Pesada").length;

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiLiviana").textContent = liviana;
    document.getElementById("kpiPesada").textContent = pesada;
    document.getElementById("kpiFiltrado").textContent = total;
}

function filtrarVisor() {
    const query = document.getElementById("visor-busqueda").value.toLowerCase().trim();
    const flota = document.getElementById("visor-filtro-flota").value;
    const tipoVehiculo = document.getElementById("visor-filtro-tipo-vehiculo") ? document.getElementById("visor-filtro-tipo-vehiculo").value : "";
    const estatus = document.getElementById("visor-filtro-estatus") ? document.getElementById("visor-filtro-estatus").value : "";
    const entradasTaller = document.getElementById("visor-filtro-entradas-taller") ? document.getElementById("visor-filtro-entradas-taller").value : "";

    const filtrados = datosActivosGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Placa || "").toLowerCase().includes(query) ||
            String(reg.VIN || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query) ||
            String(reg.Modelo || "").toLowerCase().includes(query) ||
            String(reg.Gerencia || "").toLowerCase().includes(query) ||
            String(reg.Responsable_Usuario || "").toLowerCase().includes(query);

        const matchesFlota = !flota || reg.Tipo_Flota === flota;
        const matchesTipoVehiculo = !tipoVehiculo || String(reg.Tipo_Vehiculo || "").trim().toUpperCase() === tipoVehiculo.trim().toUpperCase();
        const matchesEstatus = !estatus || String(reg.Estatus_Final || reg.Estatus || "").trim().toUpperCase() === estatus.trim().toUpperCase();

        const tieneEntradaTaller = reg.Ubicacion_Taller && !String(reg.Ubicacion_Taller).toLowerCase().includes("sin historial");
        const matchesTaller = !entradasTaller ||
            (entradasTaller === "con_taller" && tieneEntradaTaller) ||
            (entradasTaller === "sin_taller" && !tieneEntradaTaller);

        return matchesBusqueda && matchesFlota && matchesTipoVehiculo && matchesEstatus && matchesTaller;
    });

    const kpiFiltradoEl = document.getElementById("kpiFiltrado");
    if (kpiFiltradoEl) {
        kpiFiltradoEl.textContent = filtrados.length;
    }

    paginaActual = 1;
    renderizarVisor(filtrados);
}

function limpiarFiltrosVisor() {
    document.getElementById("visor-busqueda").value = "";
    document.getElementById("visor-filtro-flota").value = "";
    const selectTipo = document.getElementById("visor-filtro-tipo-vehiculo");
    if (selectTipo) selectTipo.value = "";
    const selectEstatus = document.getElementById("visor-filtro-estatus");
    if (selectEstatus) selectEstatus.value = "";
    const selectTaller = document.getElementById("visor-filtro-entradas-taller");
    if (selectTaller) selectTaller.value = "";

    const kpiFiltradoEl = document.getElementById("kpiFiltrado");
    if (kpiFiltradoEl) {
        kpiFiltradoEl.textContent = datosActivosGlobal.length;
    }

    paginaActual = 1;
    renderizarVisor(datosActivosGlobal);
}

function cambiarPagina(delta) {
    const totalPaginas = Math.ceil(datosFiltradosGlobal.length / TAMANO_PAGINA) || 1;
    const nuevaPagina = paginaActual + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= totalPaginas) {
        paginaActual = nuevaPagina;
        renderizarVisor(datosFiltradosGlobal, true);
    }
}

function actualizarPaginacionUI(totalItems) {
    const contenedorPaginacion = document.getElementById("contenedorPaginacion");
    if (!contenedorPaginacion) return;

    if (totalItems <= TAMANO_PAGINA) {
        contenedorPaginacion.classList.add("hidden");
        return;
    }

    contenedorPaginacion.classList.remove("hidden");

    const totalPaginas = Math.ceil(totalItems / TAMANO_PAGINA) || 1;
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    const inicio = (paginaActual - 1) * TAMANO_PAGINA + 1;
    const fin = Math.min(paginaActual * TAMANO_PAGINA, totalItems);

    const infoEl = document.getElementById("infoPaginacion");
    if (infoEl) infoEl.textContent = `Mostrando ${inicio} - ${fin} de ${totalItems} activos`;

    const labelEl = document.getElementById("labelPaginaActual");
    if (labelEl) labelEl.textContent = `${paginaActual} / ${totalPaginas}`;

    const btnAnt = document.getElementById("btnPaginaAnterior");
    if (btnAnt) btnAnt.disabled = paginaActual === 1;

    const btnSig = document.getElementById("btnPaginaSiguiente");
    if (btnSig) btnSig.disabled = paginaActual === totalPaginas;
}

function renderizarVisor(datos, mantenerPagina = false) {
    const tbody = document.getElementById("tablaCuerpo");
    if (!tbody) return;

    datosFiltradosGlobal = datos || [];
    if (!mantenerPagina) {
        paginaActual = 1;
    }

    if (datosFiltradosGlobal.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 uppercase tracking-widest text-[10px] font-bold">No existen activos que coincidan con los filtros</td></tr>`;
        actualizarPaginacionUI(0);
        renderizarGraficos(0, 0, {});
        return;
    }

    let liviana = datosFiltradosGlobal.filter(r => r.Tipo_Flota === "Liviana").length;
    let pesada = datosFiltradosGlobal.filter(r => r.Tipo_Flota === "Pesada").length;

    let conteoMarcas = {};
    datosFiltradosGlobal.forEach(reg => {
        conteoMarcas[reg.Marca || "S/I"] = (conteoMarcas[reg.Marca || "S/I"] || 0) + 1;
    });

    const datosInvertidos = [...datosFiltradosGlobal].reverse();
    const inicio = (paginaActual - 1) * TAMANO_PAGINA;
    const paginaDatos = datosInvertidos.slice(inicio, inicio + TAMANO_PAGINA);

    const htmlFilas = paginaDatos.map(reg => {

        let colorFila = "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-950/20";

        let badgeDocumento = (reg.Documento_Url && String(reg.Documento_Url).trim() !== "")
            ? `<a href="${escapeHTML(reg.Documento_Url)}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider hover:underline transition-all">
                <i class="fa-solid fa-file-pdf"></i> Ver / Descargar
               </a>`
            : `<span class="text-[9px] text-slate-400 dark:text-slate-600 italic">Sin Documento</span>`;

        const idEscaped = escapeHTML(reg.ID_Unidad);

        return `
             <tr id="fila-${idEscaped}"
                 class="block md:table-row ${colorFila} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-lg mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">

                 <td class="flex justify-between items-center md:table-cell p-4 font-mono text-[11px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                     <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">ID Unidad</span>
                     <span class="font-black tracking-widest text-slate-800 dark:text-white text-xs uppercase">${idEscaped}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 font-mono text-[11px] border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Placa / VIN</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold uppercase block">${escapeHTML(reg.Placa)}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.VIN)}</span>
                    </div>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Marca / Modelo</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold text-xs uppercase block">${escapeHTML(reg.Marca)} ${escapeHTML(reg.Modelo)}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.Tipo_Vehiculo)} - ${escapeHTML(reg.Color)}</span>
                    </div>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Flota / Estatus</span>
                    <div>
                        <span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase inline-block mb-1">${escapeHTML(reg.Tipo_Flota)}</span>
                        <div class="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase">${escapeHTML(reg.Estatus_Final || 'S/E')} - ${escapeHTML(reg.Situacion_Actual || 'S/S')}</div>
                    </div>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Gerencia / Usuario</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold text-[10px] uppercase block">${escapeHTML(reg.Gerencia || 'SIN GERENCIA')}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.Responsable_Usuario || 'S/R')} (${escapeHTML(reg.Cargo_Usuario || 'S/C')})</span>
                    </div>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-100 dark:border-slate-800/30 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Último Taller</span>
                    <span class="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase block">${escapeHTML(reg.Ubicacion_Taller)}</span>
                 </td>

                 <td class="flex justify-between items-center md:table-cell p-4 border-b md:border-b-0 border-slate-200 dark:border-slate-800/20 transition-colors">
                    <span class="md:hidden text-slate-500 dark:text-slate-400 uppercase text-[9px] font-black tracking-widest transition-colors">Documentación</span>
                    <div>${badgeDocumento}</div>
                 </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlFilas.join('');
    actualizarPaginacionUI(datosFiltradosGlobal.length);
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

async function exportarAExcel() {
    if (datosActivosGlobal.length === 0) return TTOCC_UI.error("Error", "No hay datos para exportar.");

    const exportData = datosActivosGlobal.map(reg => ({
        "ID Unidad": reg.ID_Unidad,
        "Placa": reg.Placa,
        "VIN Chasis": reg.VIN,
        "Marca": reg.Marca,
        "Modelo": reg.Modelo,
        "Color": reg.Color,
        "Tipo de Vehículo": reg.Tipo_Vehiculo,
        "Tipo de Flota": reg.Tipo_Flota,
        "Estatus Final": reg.Estatus_Final,
        "Situación Actual": reg.Situacion_Actual,
        "Gerencia": reg.Gerencia,
        "Responsable Usuario": reg.Responsable_Usuario,
        "Cargo de Usuario": reg.Cargo_Usuario,
        "Última Ubicación Taller": reg.Ubicacion_Taller,
        "Link Documento": reg.Documento_Url
    }));

    const hoja = XLSX.utils.json_to_sheet(exportData);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Catálogo de Activos");

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreArchivo = `TTOCC_Maestro_Activos_${fecha}.xlsx`;

    // Detectar si la app corre como APK / Nativa
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
            // 1. Generar la data del Excel en formato base64
            const base64Data = XLSX.write(libro, { bookType: 'xlsx', type: 'base64' });

            // 2. Escribir el archivo en el sistema de archivos del dispositivo
            const guardado = await Capacitor.Plugins.Filesystem.writeFile({
                path: nombreArchivo,
                data: base64Data,
                directory: 'DOCUMENTS'
            });

            // 3. Abrir la ventana para compartir/guardar el archivo
            await Capacitor.Plugins.Share.share({
                title: 'Maestro de Activos',
                text: 'Catálogo de Activos exportado a Excel',
                url: guardado.uri,
                dialogTitle: 'Guardar o enviar Excel'
            });

        } catch (error) {
            console.error("Error guardando Excel en APK:", error);
            TTOCC_UI.error("Error de Exportación", "No se pudo guardar el archivo en el dispositivo.");
        }
    } else {
        // Comportamiento normal para la versión Web
        XLSX.writeFile(libro, nombreArchivo);
    }
}

/**
 
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
 */

function filtrarPorKpi(flota) {
    const selectFlota = document.getElementById('visor-filtro-flota');
    if (selectFlota) {
        selectFlota.value = flota;
        filtrarVisor();
    }
}
