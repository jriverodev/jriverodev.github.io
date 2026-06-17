// js/visor.js - Inteligencia Analítica Ejecutiva (PRODUCCIÓN REAL)
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

// CONEXIÓN REAL CON EL BACKEND DE GOOGLE
async function cargarDatosEjecutivosReales() {
    Swal.fire({ 
        title: 'Conectando con el Servidor...', 
        text: 'Recuperando estatus de la flota en tiempo real...',
        allowOutsideClick: false, 
        didOpen: () => { Swal.showLoading(); }
    });
    
    try {
        // Petición POST real al Google Apps Script configurado en app.js
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" }) // Envía la acción de lectura al doPost
        });
        
        if (!response.ok) {
            throw new Error("La API de Google respondió con un estatus de error");
        }
        
        const data = await response.json();
        
        // Validamos que el backend responda con éxito y traiga datos
        if (data.status === "SUCCESS" && (data.datos || data.unidades)) {
            datosUnidadesGlobal = data.datos || data.unidades;
            procesarFiltrosYGraficos();
            Swal.close();
        } else {
            throw new Error("Estructura de respuesta inesperada o vacía");
        }
        
    } catch (error) {
        console.error("Error crítico de sincronización:", error);
        Swal.fire({ 
            icon: 'error', 
            title: 'Error de Lectura', 
            text: 'Imposible recuperar datos desde el servidor. Verifica los permisos de la API.' 
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
    
    if (lista.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px; color:#a0aec0;'>Sin unidades en esta fosa</p>";
        return;
    }
    
    lista.forEach(u => {
        const claseEstatus = u.Estatus.toLowerCase().replace(/\s+/g, '');
        const tallerFinal = u.ID_Taller === "EXTERNO" ? `Externo (${u.Nombre_Taller_Ext || 'No especificado'})` : u.Nombre_Taller;
        
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
                <p><strong>Notas de taller:</strong> ${u.Observaciones || 'Sin novedades registradas'}</p>
            </div>
        `;
        contenedor.appendChild(card);
    });
}

function actualizarEstructuraGrafica(lista) {
    const ctx = document.getElementById("canvasGrafico").getContext("2d");
    
    const conteo = { "Por Atender": 0, "En Proceso": 0, "Atendido": 0 };
    lista.forEach(u => {
        if (conteo[u.Estatus] !== undefined) conteo[u.Estatus]++;
    });
    
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
