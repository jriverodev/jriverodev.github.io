// js/app.js - Lógica Global y Kernel de Seguridad (MODO DE PRUEBA LOCAL)

const APP_CONFIG = {
    URL_API: "https://script.google.com/macros/s/AKfycbxm_o6lpKUvllwxWei5MMnyhLnFC9HLwzUVsld2hsyLMpOQdCX_U6NxRN-uiCDXlf6YgA/exec" // Puenteado temporalmente para pruebas locales
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

// Inicialización del Login - MODO DE PRUEBA LOCAL (Sin petición externa)
if (document.getElementById("formLogin")) {
    // Eliminamos la validación obligatoria del HTML para permitir accesos directos en blanco
    document.getElementById("txtPassword").removeAttribute("required");

    document.getElementById("formLogin").addEventListener("submit", (e) => {
        e.preventDefault();
        
        const clave = document.getElementById("txtPassword").value.trim().toLowerCase();
        
        Swal.fire({
            title: 'Abriendo interfaz...',
            timer: 600,
            showConfirmButton: false,
            didOpen: () => { Swal.showLoading(); }
        }).then(() => {
            // MODO PUENTE TEMPORAL:
            // 1. Escribe la palabra "gerente" para ir directo a la pantalla de gráficos (visor.html).
            // 2. Si lo dejas vacío o escribes cualquier otra cosa, entras al Formulario de Carga (panel.html).
            if (clave === "gerente") {
                sessionStorage.setItem("tto_sesion_rol", "GERENTE");
                window.location.href = "visor.html";
            } else {
                sessionStorage.setItem("tto_sesion_rol", "OPERADOR");
                window.location.href = "panel.html";
            }
        });
    });
}
