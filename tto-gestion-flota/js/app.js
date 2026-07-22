// js/app.js - Núcleo de Configuración y PWA (COMPLETO - SIN LOGIN)

// =========================================================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// =========================================================================
const APP_CONFIG = {
    // REEMPLAZA ESTA URL CON EL LINK DE TU DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycbwM17iGCVD7YZpQj4fsD-pVBaip7ny5t5iIhuLluRLOVuLJNbTPjctopePliFIcjTFwLg/exec"
};

// Registro del Service Worker para soporte de PWA (Instalación y caché local)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✔ Service Worker operativo en patio:', reg.scope))
            .catch(err => console.error('❌ Error registrando el Service Worker:', err));
    });
}
