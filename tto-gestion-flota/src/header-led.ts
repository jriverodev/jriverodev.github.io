/**
 * SIAGOP System - Header & LED Network Status Indicator Component
 * js/header-led.js
 */
"use strict";

(function () {
    let ledElement = null;

    function inicializarHeaderLed() {
        const orgNombre = sessionStorage.getItem('SIAGOP_ORG_NOMBRE') || 'Gerencia de Transporte Terrestre Occidente';

        // Actualizar elementos con id u identificador de organización
        const orgContainers = document.querySelectorAll('#header-organizacion-nombre, .header-org-nombre');
        orgContainers.forEach(el => {
            el.textContent = orgNombre;
        });

        // Buscar o crear contenedor LED en los botones de salir / header acciones si no existe
        ledElement = document.getElementById('led-network-status');
        if (!ledElement) {
            const logoutButtons = document.querySelectorAll('button[onclick*="cerrarSesion"], a[href*="index.html"]');
            logoutButtons.forEach(btn => {
                if (!btn.querySelector('#led-network-status')) {
                    const ledSpan = document.createElement('span');
                    ledSpan.id = 'led-network-status';
                    ledSpan.title = navigator.onLine ? 'Conectado (En línea)' : 'Sin conexión (Offline)';
                    ledSpan.className = 'inline-block transition-all duration-300 mr-2 align-middle';
                    btn.insertBefore(ledSpan, btn.firstChild);
                    if (!ledElement) ledElement = ledSpan;
                }
            });
        }

        actualizarEstadoLed(navigator.onLine ? 'online' : 'offline');

        window.addEventListener('online', () => {
            actualizarEstadoLed('reconnecting');
            setTimeout(() => {
                actualizarEstadoLed('online');
            }, 1200);
        });

        window.addEventListener('offline', () => {
            actualizarEstadoLed('offline');
        });
    }

    function actualizarEstadoLed(estado) {
        const leds = document.querySelectorAll('#led-network-status');
        leds.forEach(led => {
            if (!led) return;
            if (estado === 'online') {
                led.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)] inline-block align-middle mr-2 transition-all duration-300';
                led.title = 'Estado: Conectado (En línea)';
            } else if (estado === 'offline') {
                led.className = 'w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] inline-block align-middle mr-2 transition-all duration-300';
                led.title = 'Estado: Sin conexión (Offline)';
            } else if (estado === 'reconnecting') {
                led.className = 'w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block align-middle mr-2 transition-all duration-300';
                led.title = 'Estado: Reconectando...';
            }
        });
    }

    window.SIAGOP_HEADER_LED = {
        inicializarHeaderLed,
        actualizarEstadoLed
    };

    document.addEventListener('DOMContentLoaded', inicializarHeaderLed);
})();
