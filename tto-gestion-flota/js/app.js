// js/app.js - Núcleo de Configuración y PWA (COMPLETO - SIN LOGIN)
// =========================================================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// =========================================================================
const APP_CONFIG = {
    // REEMPLAZA ESTA URL CON EL LINK DE TU DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycbx9Uf8cFB3wTMk_vGxBGPxGKw2TBOUWPGJ4-IOxql8dIPO4x6dzeVcfZ9cZJSMuN4fAmw/exec"
};

// Registro del Service Worker para soporte de PWA (Instalación y caché local)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✔ Service Worker operativo en patio:', reg.scope))
            .catch(err => console.error('❌ Error registrando el Service Worker:', err));
    });
}
