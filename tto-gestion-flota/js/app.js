// js/app.js - Núcleo de Configuración y PWA (COMPLETO - SIN LOGIN)

// =========================================================================
// CONFIGURACIÓN GLOBAL DEL SISTEMA
// =========================================================================
const APP_CONFIG = {
    // REEMPLAZA ESTA URL CON EL LINK DE TU DESPLIEGUE EN GOOGLE APPS SCRIPT
    URL_API: "https://script.google.com/macros/s/AKfycby8Qga6rPVyzimxBK2dVfFMzuhaYTyQUIFNSlGb7-G1nOPS_KfgH5Eg0NdsOXTxG_RG9g/exec"
};

// Registro del Service Worker para soporte de PWA (Instalación y caché local)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('✔ Service Worker operativo en patio:', reg.scope))
            .catch(err => console.error('❌ Error registrando el Service Worker:', err));
    });
}
