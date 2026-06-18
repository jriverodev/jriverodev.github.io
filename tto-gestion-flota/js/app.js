// js/app.js - Lógica Global y Kernel de Seguridad (CON URL REAL DE PRODUCCIÓN)

const APP_CONFIG = {
    // Tu URL real de Google Apps Script vinculada a tu hoja de cálculo
    URL_API: "https://script.google.com/macros/s/AKfycbzpVKQ3KmUDa6F27H0cwgIOc13_F05f4aKgh03cOJzmiEgf6yQZ6xxGh2Nt7Cytq9-T5A/exec"
};

// Registrar Service Worker global de forma correcta en la raíz
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Operativo bajo alcance: ', reg.scope))
            .catch(err => console.error('Fallo en la carga del Service Worker: ', err));
    });
}

// Algoritmo nativo de generación de Hash SHA-256 (Se conserva para uso futuro)
async function generarHashCrypto(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verificación estructural de Sesiones Privadas
function validarAccesoPantalla(rolRequerido) {
    const rolActivo = sessionStorage.getItem("tto_sesion_rol");
    if (!rolActivo) {
        window.location.href = "index.html";
        return false;
    }
    if (rolRequerido && rolActivo !== rolRequerido) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}

// Inicialización del Login - MODO BYPASS BASADO EN TU SELECTOR DE ROL (Contraseña deshabilitada temporalmente)
if (document.getElementById("formLogin")) {
    // Eliminamos la obligación de rellenar la contraseña en el móvil para pruebas rápidas
    const campoClave = document.getElementById("txtPassword");
    if (campoClave) {
        campoClave.removeAttribute("required");
    }

    document.getElementById("formLogin").addEventListener("submit", (e) => {
        e.preventDefault();
        
        // Capturamos el valor real de tu select de index.html: "CARGA" o "VISOR"
        const rolSeleccionado = document.getElementById("selRol").value;
        
        Swal.fire({
            title: 'Conectando...',
            timer: 500,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); }
        }).then(() => {
            // Evaluamos la opción elegida en tu menú desplegable:
            if (rolSeleccionado === "VISOR") {
                sessionStorage.setItem("tto_sesion_rol", "GERENTE");
                window.location.href = "visor.html";
            } else if (rolSeleccionado === "CARGA") {
                sessionStorage.setItem("tto_sesion_rol", "OPERADOR");
                window.location.href = "panel.html";
            }
        });
    });
}
