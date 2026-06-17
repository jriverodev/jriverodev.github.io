
// js/panel.js - Controlador Operativo Offline-First

document.addEventListener("DOMContentLoaded", () => {
    if (!validarAccesoPantalla("OPERADOR")) return;
    
    configurarEventosFormulario();
    verificarColaDeSincronizacion();
});

function configurarEventosFormulario() {
    const ddlTaller = document.getElementById("ddlTaller");
    const groupExterno = document.getElementById("groupExterno");
    const txtTallerExt = document.getElementById("txtTallerExt");
    
    // Conmutador del input de Talleres Externos
    ddlTaller.addEventListener("change", (e) => {
        if (e.target.value === "EXTERNO") {
            groupExterno.classList.remove("hidden");
            txtTallerExt.setAttribute("required", "required");
        } else {
            groupExterno.classList.add("hidden");
            txtTallerExt.removeAttribute("required");
            txtTallerExt.value = "";
        }
    });
    
    document.getElementById("btnCerrarSesion").addEventListener("click", () => {
        sessionStorage.clear();
        window.location.href = "index.html";
    });
    
    document.getElementById("formRegistro").addEventListener("submit", manejarEnvioRegistro);
}

async function manejarEnvioRegistro(e) {
    e.preventDefault();
    
    const registroPayload = {
        accion: "registrar",
        id_unidad: document.getElementById("txtUnidad").value,
        tipo_flota: document.getElementById("ddlFlota").value,
        id_taller: document.getElementById("ddlTaller").value,
        nombre_taller_ext: document.getElementById("txtTallerExt").value || "N/A",
        estatus: document.getElementById("ddlEstatus").value,
        observaciones: document.getElementById("txtObservaciones").value
    };

    if (navigator.onLine) {
        enviarAlServidorDirecto(registroPayload);
    } else {
        guardarEnColaOffline(registroPayload);
    }
}

async function enviarAlServidorDirecto(payload) {
    Swal.fire({ title: 'Enviando Reporte...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
    
    try {
        const res = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const r = await res.json();
        
        if (r.status === "SUCCESS") {
            Swal.fire({ icon: 'success', title: 'Registrado', text: 'Datos guardados en Google Sheets', timer: 1500 });
            document.getElementById("formFormulario").reset();
            document.getElementById("groupExterno").classList.add("hidden");
        } else {
            throw new Error("Rechazo desde backend");
        }
    } catch (err) {
        guardarEnColaOffline(payload);
    }
}

function guardarEnColaOffline(payload) {
    let cola = JSON.parse(localStorage.getItem("tto_cola_offline")) || [];
    cola.push(payload);
    localStorage.setItem("tto_cola_offline", JSON.stringify(cola));
    
    actualizarBadgeEstado(false);
    
    Swal.fire({
        icon: 'warning',
        title: 'Modo Local Activado',
        text: 'Datos resguardados en memoria del móvil. Se subirán al recuperar cobertura en el taller.',
        confirmButtonColor: '#f59e0b'
    });
    
    document.getElementById("formRegistro").reset();
    document.getElementById("groupExterno").classList.add("hidden");
}

function verificarColaDeSincronizacion() {
    window.addEventListener('online', procesarColaSincronizacion);
    if (navigator.onLine) {
        procesarColaSincronizacion();
    } else {
        actualizarBadgeEstado(false);
    }
}

async function procesarColaSincronizacion() {
    let cola = JSON.parse(localStorage.getItem("tto_cola_offline")) || [];
    if (cola.length === 0) {
        actualizarBadgeEstado(true);
        return;
    }
    
    actualizarBadgeEstado(false);
    
    for (let i = 0; i < cola.length; i++) {
        try {
            await fetch(APP_CONFIG.URL_API, {
                method: "POST",
                body: JSON.stringify(cola[i])
            });
        } catch (e) {
            console.error("Fallo re-intento individual");
            return; // Detener re-intentos si la red sigue inestable
        }
    }
    
    localStorage.removeItem("tto_cola_offline");
    actualizarBadgeEstado(true);
    Swal.fire({ icon: 'success', title: 'Sincronización Exitosa', text: 'Todos los datos retrasados fueron migrados a Google Sheets.' });
}

function actualizarBadgeEstado(isSynced) {
    const b = document.getElementById("syncBadge");
    if (isSynced) {
        b.className = "badge-sync synced";
        b.innerText = "Sincronizado";
    } else {
        b.className = "badge-sync offline";
        b.innerText = "Offline Activo";
    }
}
