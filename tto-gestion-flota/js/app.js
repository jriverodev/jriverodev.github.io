// js/app.js - Núcleo de Configuración, Seguridad y PWA (COMPLETO)

// =========================================================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// =========================================================================
const APP_CONFIG = {
    // REEMPLAZA ESTA URL CON EL LINK DE TU DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycbzpVKQ3KmUDa6F27H0cwgIOc13_F05f4aKgh03cOJzmiEgf6yQZ6xxGh2Nt7Cytq9-T5A/exec"
};

// Registro del Service Worker para soporte de PWA (Instalación en móviles)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✔ Service Worker operativo en patio:', reg.scope))
            .catch(err => console.error('❌ Error registrando el Service Worker:', err));
    });
}

// =========================================================================
// MÓDULO DE AUTENTICACIÓN (LOGIN)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", ejecutarAutenticacionZulia);
    }
});

async function ejecutarAutenticacionZulia(e) {
    e.preventDefault();
    
    const inputClave = document.getElementById("txtClave");
    if (!inputClave) return;
    
    const claveIngresada = inputClave.value.trim();
    
    if (!claveIngresada) {
        Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Por favor, ingrese su credencial de acceso.' });
        return;
    }

    Swal.fire({
        title: 'Verificando Credenciales...',
        text: 'Conectando con el servidor central...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "login", clave: claveIngresada })
        });

        if (!response.ok) throw new Error("Fallo de respuesta del servidor de Google");

        const resultado = await response.json();
        Swal.close();

        if (resultado.status === "SUCCESS") {
            // Guardar sesión en el almacenamiento temporal del navegador
            sessionStorage.setItem("TTOCC_SESION_ROL", resultado.rol);
            sessionStorage.setItem("TTOCC_SESION_ACTIVA", "TRUE");

            // Redirección inteligente basada en el rol de seguridad devuelto por el script
            if (resultado.rol === "GERENTE") {
                window.location.href = "visor.html";
            } else if (resultado.rol === "OPERADOR") {
                window.location.href = "panel.html";
            }
        } else {
            Swal.fire({ icon: 'error', title: 'Acceso Denegado', text: resultado.message || 'Contraseña incorrecta.' });
        }

    } catch (error) {
        console.error("Error en módulo de login:", error);
        Swal.fire({
            icon: 'error',
            title: 'Fallo de Conexión',
            text: 'No se pudo contactar al servidor. Compruebe su señal de datos.'
        });
    }
}

// =========================================================================
// GUARDIÁN DE SEGURIDAD (CONTROL DE ACCESO ENTRE PANTALLAS)
// =========================================================================
function validarAccesoPantalla(rolRequerido) {
    const sesionActiva = sessionStorage.getItem("TTOCC_SESION_ACTIVA");
    const rolActual = sessionStorage.getItem("TTOCC_SESION_ROL");

    if (sesionActiva !== "TRUE" || !rolActual) {
        sessionStorage.clear();
        window.location.href = "index.html";
        return false;
    }

    // Un Gerente puede auditar todo, un Operador solo puede estar en su formulario
    if (rolRequerido === "GERENTE" && rolActual !== "GERENTE") {
        Swal.fire({
            icon: 'error',
            title: 'Restricción de Nivel',
            text: 'Su rol no tiene privilegios analíticos gerenciales.',
            confirmButtonText: 'Volver'
        }).then(() => {
            window.location.href = "panel.html";
        });
        return false;
    }
    
    return true;
}
