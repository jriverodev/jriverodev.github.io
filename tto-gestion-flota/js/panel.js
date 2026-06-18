// js/panel.js - Controlador de Formulario de Patio, Cola Offline y Sincronización (COMPLETO)

document.addEventListener("DOMContentLoaded", () => {
    // 1. Blindaje de seguridad: Solo operadores autenticados entran a este formulario
    if (!validarAccesoPantalla("OPERADOR")) return;

    const formulario = document.getElementById("formRegistroFlota");
    const selectTaller = document.getElementById("cmbTaller");
    const btnCerrarPanel = document.getElementById("btnCerrarPanel");

    if (formulario) {
        formulario.addEventListener("submit", manejarEnvioFormulario);
    }

    // Control visual interactivo: Mostrar campo externo solo si seleccionan "EXTERNO"
    if (selectTaller) {
        selectTaller.addEventListener("change", alternarCampoTallerExterno);
    }

    // Salida segura de la aplicación
    if (btnCerrarPanel) {
        btnCerrarPanel.addEventListener("click", () => {
            sessionStorage.clear();
            window.location.href = "index.html";
        });
    }

    // Escuchadores del estado de la antena del móvil
    window.addEventListener("online", procesarColaPendiente);
    
    // Inspección inicial: Si el teléfono arranca con registros atrasados en la cola, los sube
    procesarColaPendiente();
    actualizarContadorPendientes();
});

// Interfaz Dinámica: Muestra u oculta el contenedor del taller externo
function alternarCampoTallerExterno() {
    const selectTaller = document.getElementById("cmbTaller");
    const contenedorExterno = document.getElementById("divTallerExternoContainer");
    const inputExterno = document.getElementById("txtTallerExt");

    if (selectTaller.value === "EXTERNO") {
        contenedorExterno.style.display = "block";
        if (inputExterno) inputExterno.required = true;
    } else {
        contenedorExterno.style.display = "none";
        if (inputExterno) {
            inputExterno.required = false;
            inputExterno.value = ""; // Limpiar residuo
        }
    }
}

// CAPTURA DE FORMULARIO Y ENRUTAMIENTO INTELIGENTE
async function manejarEnvioFormulario(e) {
    e.preventDefault();

    const selectTaller = document.getElementById("cmbTaller");
    
    // Construcción del paquete JSON estructurado según requiere Codigo.gs
    const datosRegistro = {
        accion: "guardar",
        idUnidad: document.getElementById("txtUnidad").value.trim().toUpperCase(),
        tipoFlota: document.getElementById("cmbFlota").value,
        idTaller: selectTaller.value,
        nombreTaller: selectTaller.options[selectTaller.selectedIndex].text,
        nombreTallerExt: document.getElementById("txtTallerExt") ? document.getElementById("txtTallerExt").value.trim() || "N/A" : "N/A",
        estatus: document.getElementById("cmbEstatus").value || "Por Atender",
        observaciones: document.getElementById("txtObservaciones").value.trim()
    };

    // Evaluación en caliente de cobertura de red
    if (navigator.onLine) {
        Swal.fire({
            title: 'Transmitiendo Datos...',
            text: 'Registrando estatus en Google Sheets...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        
        const exito = await enviarAGoogleSheets(datosRegistro);
        
        if (exito) {
            Swal.fire({ icon: 'success', title: 'Sincronizado', text: 'Unidad registrada directamente en la nube.' });
            document.getElementById("formRegistroFlota").reset();
            alternarCampoTallerExterno(); // Resetear vista externa
        } else {
            // Caída de señal fantasma durante la petición -> Proteger registro localmente
            resguardarEnMemoriaLocal(datosRegistro);
        }
    } else {
        // Red caída confirmada -> Guardar en el dispositivo móvil
        resguardarEnMemoriaLocal(datosRegistro);
    }
}

// LLAMADO AL BACKEND MEDIANTE FETCH API
async function enviarAGoogleSheets(datos) {
    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(datos)
        });

        if (!response.ok) return false;

        const resultado = await response.json();
        return resultado.status === "SUCCESS";
    } catch (error) {
        console.error("Fallo de red en envío Fetch:", error);
        return false;
    }
}

// RESPALDO EN LOCALSTORAGE (MODO OFFLINE ACTIVADO)
function resguardarEnMemoriaLocal(datos) {
    let cola = JSON.parse(localStorage.getItem("cola_transporte_ttocc")) || [];
    
    // Inyectar estampa de tiempo local para auditorías internas del operador
    datos.fechaLocal = new Date().toLocaleString();
    cola.push(datos);
    
    localStorage.setItem("cola_transporte_ttocc", JSON.stringify(cola));

    Swal.fire({
        icon: 'warning',
        title: 'Modo Local Activado',
        text: 'Sin cobertura en fosa. Datos resguardados en memoria del móvil. Se subirán al recuperar señal.',
        confirmButtonColor: '#f59e0b'
    });
    
    document.getElementById("formRegistroFlota").reset();
    alternarCampoTallerExterno();
    actualizarContadorPendientes();
}

// PROCESAMIENTO AUTOMÁTICO DE FILAS ACUMULADAS
async function procesarColaPendiente() {
    if (!navigator.onLine) return; // Continuar en espera si no hay cobertura estable

    let cola = JSON.parse(localStorage.getItem("cola_transporte_ttocc")) || [];
    if (cola.length === 0) return;

    console.log(`📡 Señal recuperada. Transmitiendo cola de ${cola.length} unidades registradas...`);
    
    let registrosFallidos = [];

    for (let registro of cola) {
        const subido = await enviarAGoogleSheets(registro);
        if (!subido) {
            registrosFallidos.push(registro); // Si falla la red a mitad de camino, se preserva
        }
    }

    if (registrosFallidos.length === 0) {
        localStorage.removeItem("cola_transporte_ttocc");
        
        // Notificación corporativa no invasiva (Toast) en la esquina superior
        const Toast = Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 4000 });
        Toast.fire({ icon: 'success', title: 'Sincronización Completa: Base de datos actualizada.' });
    } else {
        // Guardar solo los que rebotaron para el siguiente intento
        localStorage.setItem("cola_transporte_ttocc", JSON.stringify(registrosFallidos));
    }

    actualizarContadorPendientes();
}

// CONTROL DE INTERFAZ: CONTADOR DE REGISTROS EN ESPERA
function actualizarContadorPendientes() {
    const cola = JSON.parse(localStorage.getItem("cola_transporte_ttocc")) || [];
    const badge = document.getElementById("badgePendientes");
    
    if (badge) {
        if (cola.length > 0) {
            badge.textContent = `${cola.length} pendientes por subir`;
            badge.style.display = "inline-block";
            badge.style.backgroundColor = "#f59e0b"; // Alerta ámbar
            badge.style.color = "#ffffff";
        } else {
            badge.style.display = "none";
        }
    }
}
