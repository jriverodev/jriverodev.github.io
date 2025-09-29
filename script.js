// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL
// ===============================================================================================
const CONFIG = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxC2GMVUYiag-R3pIljThXgeuKc2yVSVqyfb9qyyrpK4kU7LqZzJRq9HihMYJU3DP0/exec',
    VERSION: '2.0',
    ITEMS_PER_PAGE: 10,
    DEBOUNCE_DELAY: 500
};

// Datos de ejemplo mejorados
const personalData = [
    { cedula: '12345678', nombre: 'Juan Perez', organizacion: 'Contratista', gerencia: 'Transporte' },
    { cedula: '87654321', nombre: 'Maria Rodriguez', organizacion: 'PDVSA', gerencia: 'Producción' },
    { cedula: '11223344', nombre: 'Carlos Gomez', organizacion: 'Contratista', gerencia: 'Mantenimiento' },
    { cedula: '44332211', nombre: 'Ana Fernandez', organizacion: 'PDVSA', gerencia: 'Transporte' },
    { cedula: '55667788', nombre: 'Pedro Martinez', organizacion: 'Contratista', gerencia: 'Logística' },
    { cedula: '99887766', nombre: 'Laura Gonzalez', organizacion: 'PDVSA', gerencia: 'Seguridad' }
];

// Estado global de la aplicación
const AppState = {
    currentPage: 1,
    totalPages: 1,
    allReports: [],
    filteredReports: [],
    searchTerm: '',
    isLoading: false
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        // Configurar versión
        document.getElementById('app-version').textContent = `v${CONFIG.VERSION}`;
        
        // Inicializar componentes
        initializeEventListeners();
        populateDropdowns();
        setupRealTimeClock();
        
        // Cargar datos iniciales
        await Promise.all([
            loadStatistics(),
            loadReports()
        ]);
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación:', error);
        showError('Error al inicializar la aplicación');
    }
}

// ===============================================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ===============================================================================================
function initializeEventListeners() {
    const cedulaInput = document.getElementById('cedula');
    const reportForm = document.getElementById('report-form');
    const clearFormBtn = document.getElementById('clear-form');
    const refreshBtn = document.getElementById('refresh-reports');
    const searchInput = document.getElementById('search-reports');
    const observacionesTextarea = document.getElementById('observaciones');

    // Eventos del formulario
    cedulaInput.addEventListener('input', debounce(findDriver, CONFIG.DEBOUNCE_DELAY));
    cedulaInput.addEventListener('blur', findDriver);
    reportForm.addEventListener('submit', submitReport);
    clearFormBtn.addEventListener('click', clearForm);

    // Eventos de la lista de reportes
    refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('pulse');
        loadReports().finally(() => {
            setTimeout(() => refreshBtn.classList.remove('pulse'), 1000);
        });
    });

    searchInput.addEventListener('input', debounce((e) => {
        AppState.searchTerm = e.target.value.trim();
        filterAndDisplayReports();
    }, CONFIG.DEBOUNCE_DELAY));

    // Contador de caracteres para observaciones
    observacionesTextarea.addEventListener('input', updateCharacterCount);
}

// ===============================================================================================
// FUNCIONALIDADES DEL FORMULARIO
// ===============================================================================================
function populateDropdowns() {
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');

    const organizaciones = [...new Set(personalData.map(item => item.organizacion))];
    const gerencias = [...new Set(personalData.map(item => item.gerencia))];

    // Limpiar selects
    organizacionSelect.innerHTML = '<option value="">Seleccione una organización...</option>';
    gerenciaSelect.innerHTML = '<option value="">Seleccione una gerencia...</option>';

    // Llenar organizaciones
    organizaciones.forEach(org => {
        const option = document.createElement('option');
        option.value = org;
        option.textContent = org;
        organizacionSelect.appendChild(option);
    });

    // L
