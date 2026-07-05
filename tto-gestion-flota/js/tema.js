// js/tema.js - Gestor de Temas para la Pantalla Gerencial (Módulo Optimizado)

const TTOCC_Tema = (() => {
    const HTML = document.documentElement;

    const init = () => {
        // 1. Obtener preferencia guardada o usar oscuro por defecto
        const temaGuardado = localStorage.getItem('ttocc-theme') || 'dark';
        
        // 2. Aplicar clase al HTML inmediatamente para evitar parpadeos (Flash)
        if (temaGuardado === 'dark') {
            HTML.classList.add('dark');
        } else {
            HTML.classList.remove('dark');
        }

        // 3. Esperar a que el DOM esté listo solo para actualizar el icono visual
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => actualizarIconoUI(temaGuardado));
        } else {
            actualizarIconoUI(temaGuardado);
        }
    };

    const toggle = () => {
        const esOscuro = HTML.classList.contains('dark');
        const nuevoTema = esOscuro ? 'light' : 'dark';
        
        if (esOscuro) {
            HTML.classList.remove('dark');
        } else {
            HTML.classList.add('dark');
        }

        // Guardar elección de manera persistente
        localStorage.setItem('ttocc-theme', nuevoTema);
        actualizarIconoUI(nuevoTema);

        // 4. Adaptar componentes dependientes del color del tema
        manejarCambioGraficos(nuevoTema);
    };

    const actualizarIconoUI = (tema) => {
        const btnIcono = document.getElementById('btn-tema-icono');
        if (!btnIcono) return;
        
        if (tema === 'dark') {
            btnIcono.className = 'fa-solid fa-moon';
        } else {
            btnIcono.className = 'fa-solid fa-sun';
        }
    };

    /**
     * Reconfigura y redibuja los gráficos si cambian las condiciones de contraste
     */
    const manejarCambioGraficos = (tema) => {
        if (typeof instanciaChartEstatus === 'undefined' || !instanciaChartEstatus) {
            // Si el visor no está activo o los gráficos no se han creado, solo forzar redimensionamiento preventivo
            if (typeof actualizarGraficosVivos === 'function') {
                setTimeout(actualizarGraficosVivos, 50);
            }
            return;
        }

        // Configuración de colores según el tema activo para evitar textos invisibles
        const colorTexto = tema === 'dark' ? '#94a3b8' : '#475569';
        const colorCuadricula = tema === 'dark' ? '#334155' : '#e2e8f0';

        // Actualizar dinámicamente las opciones del gráfico de barras (ChartEstatus)
        if (instanciaChartEstatus.options.scales) {
            instanciaChartEstatus.options.scales.x.ticks.color = colorTexto;
            instanciaChartEstatus.options.scales.y.ticks.color = colorTexto;
            instanciaChartEstatus.options.scales.y.grid.color = colorCuadricula;
        }

        // Actualizar las opciones del gráfico de donas (ChartTalleres)
        if (instanciaChartTalleres && instanciaChartTalleres.options.plugins?.legend?.labels) {
            instanciaChartTalleres.options.plugins.legend.labels.color = colorTexto;
        }

        // Forzar la actualización visual de Chart.js con una animación suave
        instanciaChartEstatus.update();
        instanciaChartTalleres.update();
    };

    // Ejecución inmediata del flujo de inicialización del tema
    init();

    // API Pública expuesta
    return {
        toggle: toggle,
        obtenerTemaActual: () => HTML.classList.contains('dark') ? 'dark' : 'light'
    };
})();
