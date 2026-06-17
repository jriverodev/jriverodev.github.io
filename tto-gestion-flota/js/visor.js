// js/visor.js - Inteligencia Analítica Ejecutiva (PRODUCCIÓN AUTO-ADAPTABLE)

let datosUnidadesGlobal = [];
let chartInstancia = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!validarAccesoPantalla("GERENTE")) return;
    
    inicializarEventosVisor();
    cargarDatosEjecutivosReales();
});

function inicializarEventosVisor() {
    document.getElementById("filtroTaller").addEventListener("change", procesarFiltrosYGraficos);
    document.getElementById("btnExportarExcel").addEventListener("click", exportarAExcelSheetJS);
    document.getElementById("btnGenerarPDF").addEventListener("click", () => window.print());
    
    document.getElementById("btnCerrarVisor").addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
}

// CONEXIÓN INTEGRAL CON EL BACKEND DE GOOGLE
async function cargarDatosEjecutivosReales() {
    Swal.fire({ 
        title: 'Conectando con el Servidor...', 
        text: 'Recuperando estatus de la flota en tiempo real...',
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });
    
    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        
        if (!response.ok) {
            throw new Error(`Error de red: Código de estado ${response.status}`);
        }
        
        const respuestaServidor = await response.json();
        console.log("Datos brutos recibidos de Google:", respuestaServidor);
        
        // Extraer las filas crudas del objeto de respuesta
        let filasCrudas = [];
        if (Array.isArray(respuestaServidor)) {
            filasCrudas = respuestaServidor;
        } else if (respuestaServidor && respuestaServidor.status === "SUCCESS") {
            filasCrudas = respuestaServidor.datos || respuestaServidor.unidades || [];
        }
        
        // =====================================================================
        // NORMALIZADOR INTELIGENTE DE COLUMNAS (Mapeo tolerante)
        // =====================================================================
        datosUnidadesGlobal = filasCrudas.map(u => {
            // Convertimos todas las llaves a mayúsculas y quitamos espacios/guiones para comparar
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
                Observaciones: normalized["OBSERVACIONES"] || normalized["DETALE"] || normalized["DETALLE"] || normalized["NOTAS"] || u["Observaciones"] || "Sin novedades registradas"
            };
        });
        
        procesarFiltrosYGraficos();
        Swal.close();
        
    } catch (error) {
        console.error("Error crítico de sincronización:", error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Error de Lectura', 
            text: `Detalle del Servidor: ${error.message}`
        });
    }
}

function procesarFiltrosYGraficos() {
    const seleccion = document.getElementById("filtroTaller").value;
    let datosFiltrados = [];
    
    if (seleccion === "TODOS") {
        datosFiltrados = datosUnidadesGlobal;
    } else if (seleccion === "EXTERNO") {
        datosFiltrados = datosUnidadesGlobal.filter(u => u.ID_Taller === "EXTERNO" || u.Nombre_Taller.toUpperCase() === "EXTERNO");
    } else {
        datosFiltrados = datosUnidadesGlobal.filter(u => u.Nombre_Taller.toUpperCase() === seleccion.toUpperCase());
    }
    
    renderizarTarjetas(datosFiltrados);
    actualizarEstructuraGrafica(datosFiltrados);
}

function renderizarTarjetas(lista) {
    const contenedor = document.getElementById("contenedorTarjetas");
    contenedor.innerHTML = "";
    
    if (!lista || lista.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px; color:#a0aec0;'>Sin unidades en esta fosa</p>";
        return;
    }
    
    lista.forEach(u => {
        const claseEstatus = u.Estatus.toLowerCase().replace(/\s+/g, '');
        const tallerFinal = (u.ID_Taller === "EXTERNO" || u.Nombre_Taller.toUpperCase() === "EXTERNO") 
            ? `Externo (${u.Nombre_Taller_Ext || 'No especificado'})` 
            : u.Nombre_Taller;
        
        const card = document.createElement("div");
        card.className = `card-tto border-${claseEstatus}`;
        card.innerHTML = `
            <div class="card-header-tto">
                <span class="card-title-tto">${u.ID_Unidad}</span>
                <span class="badge-status status-${claseEstatus}">${u.Estatus}</span>
            </div>
            <div class="card-body-tto">
                <p><strong>Segmento:</strong> ${u.Tipo_Flota}</p>
                <p><strong>Ubicación actual:</strong> ${tallerFinal}</p>
                <p><strong>Notas de taller:</strong> ${u.Observaciones}</p>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function actualizarEstructuraGrafica(lista) {
    const ctx = document.getElementById("canvasGrafico").getContext("2d");
    
    const conteo = { "Por Atender": 0, "En Proceso": 0, "Atendido": 0 };
    
    if (lista && lista.length > 0) {
        lista.forEach(u => {
            // Estandarizar nombres de estatus para el conteo de la gráfica
            let estatusFormateado = u.Estatus.trim();
            if (conteo[estatusFormateado] !== undefined) {
                conteo[estatusFormateado]++;
            }
        });
    }
    
    if (chartInstancia) chartInstancia.destroy();
    
    chartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(conteo),
            datasets: [{
                data: Object.values(conteo),
                backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false // Corregido para evitar colapsos visuales en contenedores flex/grid
        }
    });
}

function exportarAExcelSheetJS() {
    if (datosUnidadesGlobal.length === 0) return;
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(datosUnidadesGlobal);
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado_TTO");
    XLSX.writeFile(wb, "Reporte_Gerencial_Transporte.xlsx");
}
