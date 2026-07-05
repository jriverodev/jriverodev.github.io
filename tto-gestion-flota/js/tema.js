/**
 * TTOCC System - Gestión de Temas (Claro/Oscuro)
 * Estilo Bento - Soporte para persistencia y modo mixto
 */

function inicializarTema() {
    const temaGuardado = localStorage.getItem("TTOCC_THEME") || "dark";
    aplicarTema(temaGuardado);
}

function aplicarTema(tema) {
    if (tema === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = 'dark';
    } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem("TTOCC_THEME", tema);
    actualizarIconosTema(tema);
}

function toggleTema() {
    const esOscuro = document.documentElement.classList.contains("dark");
    aplicarTema(esOscuro ? "light" : "dark");
}

function actualizarIconosTema(tema) {
    const iconos = document.querySelectorAll(".theme-toggle-icon");
    iconos.forEach(icon => {
        if (tema === "dark") {
            icon.classList.remove("fa-moon");
            icon.classList.add("fa-sun");
        } else {
            icon.classList.remove("fa-sun");
            icon.classList.add("fa-moon");
        }
    });
}

// Inicialización
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inicializarTema);
} else {
    inicializarTema();
}
