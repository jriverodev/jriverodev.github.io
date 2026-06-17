// js/visor.js - Inteligencia Analítica Ejecutiva (PRODUCCIÓN ULTRA-RESILIENTE)

let datosUnidadesGlobal = [];
let chartInstancia = null;

document.addEventListener("DOMContentLoaded", () => {
    // Seguridad: Bloquea la pantalla si no hay sesión activa
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
        
        const data = await response.json();
        console.log("Datos brutos recibidos de Google:", data); // Diagnóstico en consola
        
        // =====================================================================
        // DETECTOR MULTI-FORMATO INTEGRADO
        // =====================================================================
        if (Array.isArray(data)) {
            // Caso A: Si tu script antiguo/actual devuelve directamente el arreglo de filas
            datosUnidadesGlobal = data;
            procesarFiltrosYGraficos();
            Swal.close();
        } else if (data && data.status === "SUCCESS") {
            // Caso B: Si responde el formato estructurado nuevo
            datosUnidadesGlobal = data.datos || data.unidades || [];
            procesarFiltrosYGraficos();
            Swal.close();
        } else {
            // Caso C: Google devolvió un objeto de error (Capturamos el texto real del fallo)
            const mensajeServidor = data.message || data.error || "Estructura de respuesta inesperada o vacía";
            throw new Error(mensajeServidor);
        }
        
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
        datosFiltrados = datosUnidadesGlobal.filter(u => u.ID_Taller === "EXTERNO");
    } else {
        datosFiltrados = datosUnidadesGlobal.filter(u => u.Nombre_Taller === seleccion && u.ID_Taller !== "EXTERNO");
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
        // Validación de campos para evitar que rompa el renderizado si vienen nulos
        const estatusOriginal = u.Estatus || "Por Atender";
        const claseEstatus = estatusOriginal.toLowerCase().replace(/\s+/g, '');
        const tallerFinal = u.ID_Taller === "EXTERNO" ? `Externo (${u.Nombre_Taller_Ext || 'No especificado'})` : (u.Nombre_Taller || 'No especificado');
        const unidadNombre = u.ID_Unidad || "S/I";
        const segmento = u.Tipo_Flota || "S/I";
        const notas = u.Observaciones || 'Sin novedades registradas';
        
        const card = document.createElement("div");
        card.className = `card-tto border-${claseEstatus}`;
        card.innerHTML = `
            <div class="card-header-tto">
                <span class="card-title-tto">${unidadNombre}</span>
                <span class="badge-status status-${claseEstatus}">${estatusOriginal}</span>
            </div>
            <div class="card-body-tto">
                <p><strong>Segmento:</strong> ${segmento}</p>
                <p><strong>Ubicación actual:</strong> ${tallerFinal}</p>
                <p><strong>Notas de taller:</strong> ${notas}</p>
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
            if (u.Estatus && conteo[u.Estatus] !== undefined) {
                conteo[u.Estatus]++;
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
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } }
            }
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
