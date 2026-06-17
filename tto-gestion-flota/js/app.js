// js/app.js - Lógica Global y Kernel de Seguridad

const APP_CONFIG = {
    URL_API: "https://script.google.com/macros/s/AKfycbxm_o6lpKUvllwxWei5MMnyhLnFC9HLwzUVsld2hsyLMpOQdCX_U6NxRN-uiCDXlf6YgA/exec" // REEMPLAZAR CON TU URL DE APLICACIÓN WEB DE GAS
};

// Registrar Service Worker global de forma correcta en la raíz
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Operativo bajo alcance: ', reg.scope))
            .catch(err => console.error('Fallo en la carga del Service Worker: ', err));
    });
}

// Algoritmo nativo de generación de Hash SHA-256
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

// Inicialización exclusiva de la interfaz del Login
if (document.getElementById("formLogin")) {
    document.getElementById("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        const clave = document.getElementById("txtPassword").value;
        
        Swal.fire({
            title: 'Autenticando...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });
        
        const hashGenerado = await generarHashCrypto(clave);
        
        try {
            const response = await fetch(APP_CONFIG.URL_API, {
                method: "POST",
                body: JSON.stringify({ accion: "login", hash: hashGenerado })
            });
            const data = await response.json();
            
            if (data.status === "SUCCESS") {
                sessionStorage.setItem("tto_sesion_rol", data.rol);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Acceso Concedido',
                    text: `Perfil: ${data.rol}`,
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    if (data.rol === "GERENTE") window.location.href = "visor.html";
                    else window.location.href = "panel.html";
                });
            } else {
                Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: 'Contraseña inválida' });
            }
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error de Red', text: 'Imposible conectar con Google API' });
        }
    });
}

