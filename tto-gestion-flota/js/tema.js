// js/tema.js - Gestor de Temas para la Pantalla Gerencial

const TTOCC_Tema = (() => {
    const HTML = document.documentElement;

    const init = () => {
        // 1. Buscar tema guardado o usar el oscuro por defecto (ideal para pantallas gerenciales)
        const temaGuardado = localStorage.getItem('ttocc-theme') || 'dark';
        
        if (temaGuardado === 'dark') {
            HTML.classList.add('dark');
        } else {
            HTML.classList.remove('dark');
        }
        actualizarIconoUI(temaGuardado);
    };

    const toggle = () => {
        let nuevoTema = 'light';
        
        if (HTML.classList.contains('dark')) {
            HTML.classList.remove('dark');
            nuevoTema = 'light';
        } else {
            HTML.classList.add('dark');
            nuevoTema = 'dark';
        }

        // Guardar la elección del usuario
        localStorage.setItem('ttocc-theme', nuevoTema);
        actualizarIconoUI(nuevoTema);

        // Ajuste preventivo para ChartJS: si los gráficos están vivos, forzar redibujado
        // ya que los colores de las cuadrículas (grid) podrían necesitar actualizarse.
        if (typeof actualizarGraficosVivos === 'function') {
            setTimeout(actualizarGraficosVivos, 50);
        }
    };

    const actualizarIconoUI = (tema) => {
        const btnIcono = document.getElementById('btn-tema-icono');
        if (!btnIcono) return;
        
        // Cambiar el icono dinámicamente (asumiendo FontAwesome)
        if (tema === 'dark') {
            btnIcono.className = 'fa-solid fa-moon';
        } else {
            btnIcono.className = 'fa-solid fa-sun';
        }
    };

    // Ejecución inmediata al cargar el script para evitar Flash visual
    init();

    return {
        toggle: toggle
    };
})();
