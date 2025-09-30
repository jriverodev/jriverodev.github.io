// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL - REPORTES
// ===============================================================================================
const CONFIG = {
    // ⚠️ ACTUALIZA ESTA URL CON TU WEB APP URL REAL
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbw3w4n2V5Q7XQ8kZQ7XQ8kZQ7XQ8kZQ7XQ8kZQ7XQ8kZQ7XQ8kZQ7XQ8k/exec',
    ITEMS_PER_PAGE: 10,
    DEBOUNCE_DELAY: 500
};

// Estado global de la aplicación
const AppState = {
    currentPage: 1,
    totalPages: 1,
    allReports: [],
    filteredReports: [],
    searchTerm: '',
    isLoading: false,
    driverData: [],
    dropdownOptions: {
        organizaciones: [],
        gerencias: []
    }
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación de reportes...');
    initializeApp();
});

async function initializeApp() {
    try {
        // Mostrar estado de carga
        showAppStatus('Cargando aplicación...', 'info');
        
        // Inicializar componentes básicos primero
        initializeEventListeners();
        populateDropdownsWithDefaults();
        
        // Verificar conexión con el servidor
        const isConnected = await testConnection();
        
        if (isConnected) {
            // Cargar datos del servidor
            await loadAllData();
            showAppStatus('Aplicación cargada correctamente', 'success');
        } else {
            // Modo offline con datos de ejemplo
            await loadExampleData();
            showAppStatus('Modo offline - Usando datos de ejemplo', 'warning');
        }
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación:', error);
        showAppStatus('Error al cargar la aplicación', 'error');
        // Cargar datos de ejemplo como fallback
        await loadExampleData();
    }
}

// ===============================================================================================
// VERIFICACIÓN DE CONEXIÓN
// ===============================================================================================
async function testConnection() {
    try {
        console.log('🔗 Probando conexión con el servidor...');
        const response = await fetch(`${CONFIG.WEB_APP_URL}?action=test`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        
        console.log('✅ Conexión exitosa:', data);
        return true;
        
    } catch (error) {
        console.error('❌ Error de conexión:', error);
        return false;
    }
}

// ===============================================================================================
// CARGA DE DATOS - VERSIÓN ROBUSTA
// ===============================================================================================
async function loadAllData() {
    try {
        // Cargar datos en paralelo con manejo de errores individual
        const [driverData, dropdownOptions, stats, reports] = await Promise.allSettled([
            safeFetch(`${CONFIG.WEB_APP_URL}?action=drivers`),
            safeFetch(`${CONFIG.WEB_APP_URL}?action=dropdowns`),
            safeFetch(`${CONFIG.WEB_APP_URL}?action=stats`),
            safeFetch(`${CONFIG.WEB_APP_URL}?action=read&limit=${CONFIG.ITEMS_PER_PAGE}`)
        ]);
        
        // Procesar resultados
        if (driverData.status === 'fulfilled' && driverData.value) {
            AppState.driverData = driverData.value;
            console.log(`✅ ${driverData.value.length} choferes cargados`);
        } else {
            console.warn('⚠️ No se pudieron cargar los datos de choferes');
            AppState.driverData = getExampleDrivers();
        }
        
        if (dropdownOptions.status === 'fulfilled' && dropdownOptions.value) {
            AppState.dropdownOptions = dropdownOptions.value;
            populateDropdowns();
            console.log('✅ Dropdowns cargados');
        } else {
            console.warn('⚠️ No se pudieron cargar las opciones de dropdown');
            AppState.dropdownOptions = getExampleDropdowns();
            populateDropdowns();
        }
        
        if (stats.status === 'fulfilled' && stats.value) {
            updateDashboard(stats.value);
            console.log('✅ Estadísticas cargadas');
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas');
            updateDashboard(getExampleStats());
        }
        
        if (reports.status === 'fulfilled' && reports.value) {
            AppState.allReports = reports.value.reports || [];
            AppState.filteredReports = reports.value.reports || [];
            displayReports(reports.value.reports || []);
            console.log(`✅ ${reports.value.reports?.length || 0} reportes cargados`);
        } else {
            console.warn('⚠️ No se pudieron cargar los reportes');
            displayReports([]);
        }
        
    } catch (error) {
        console.error('Error en loadAllData:', error);
        throw error;
    }
}

// Función segura para fetch
async function safeFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const text = await response.text();
        if (!text) throw new Error('Respuesta vacía');
        
        return JSON.parse(text);
    } catch (error) {
        console.error(`Error en safeFetch (${url}):`, error);
        return null;
    }
}

// ===============================================================================================
// DATOS DE EJEMPLO (FALLBACK)
// ===============================================================================================
function getExampleDrivers() {
    return [
        { cedula: '12345678', nombre: 'Juan Perez', organizacion: 'Contratista', gerencia: 'Transporte' },
        { cedula: '87654321', nombre: 'Maria Rodriguez', organizacion: 'PDVSA', gerencia: 'Producción' },
        { cedula: '11223344', nombre: 'Carlos Gomez', organizacion: 'Contratista', gerencia: 'Mantenimiento' },
        { cedula: '44332211', nombre: 'Ana Fernandez', organizacion: 'PDVSA', gerencia: 'Transporte' }
    ];
}

function getExampleDropdowns() {
    return {
        organizaciones: ['PDVSA', 'Contratista'],
        gerencias: ['Transporte', 'Producción', 'Mantenimiento', 'Logística', 'Seguridad']
    };
}

function getExampleStats() {
    return {
        total: 0,
        operativas: 0,
        inoperativas: 0,
        gerencias: {},
        organizaciones: {}
    };
}

async function loadExampleData() {
    AppState.driverData = getExampleDrivers();
    AppState.dropdownOptions = getExampleDropdowns();
    AppState.allReports = [];
    AppState.filteredReports = [];
    
    populateDropdowns();
    updateDashboard(getExampleStats());
    displayReports([]);
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
    if (cedulaInput) {
        cedulaInput.addEventListener('input', debounce(findDriver, CONFIG.DEBOUNCE_DELAY));
        cedulaInput.addEventListener('blur', findDriver);
    }
    
    if (reportForm) {
        reportForm.addEventListener('submit', submitReport);
    }
    
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', clearForm);
    }

    // Eventos de la lista de reportes
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.classList.add('pulse');
            loadAllData().finally(() => {
                setTimeout(() => refreshBtn.classList.remove('pulse'), 1000);
            });
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            AppState.searchTerm = e.target.value.trim();
            filterAndDisplayReports();
        }, CONFIG.DEBOUNCE_DELAY));
    }

    // Contador de caracteres para observaciones
    if (observacionesTextarea) {
        observacionesTextarea.addEventListener('input', updateCharacterCount);
    }
    
    console.log('✅ Event listeners inicializados');
}

// ===============================================================================================
// FUNCIONALIDADES DEL FORMULARIO
// ===============================================================================================
function populateDropdownsWithDefaults() {
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');

    if (!organizacionSelect || !gerenciaSelect) return;

    organizacionSelect.innerHTML = '<option value="">Seleccione una organización...</option>';
    gerenciaSelect.innerHTML = '<option value="">Seleccione una gerencia...</option>';

    // Valores por defecto
    const defaultOrgs = ['PDVSA', 'Contratista'];
    const defaultGerencias = ['Transporte', 'Producción', 'Mantenimiento'];

    defaultOrgs.forEach(org => {
        const option = document.createElement('option');
        option.value = org;
        option.textContent = org;
        organizacionSelect.appendChild(option);
    });

    defaultGerencias.forEach(ger => {
        const option = document.createElement('option');
        option.value = ger;
        option.textContent = ger;
        gerenciaSelect.appendChild(option);
    });
}

function populateDropdowns() {
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');

    if (!organizacionSelect || !gerenciaSelect) return;

    // Solo actualizar si tenemos datos reales del servidor
    if (AppState.dropdownOptions.organizaciones.length > 0) {
        organizacionSelect.innerHTML = '<option value="">Seleccione una organización...</option>';
        AppState.dropdownOptions.organizaciones.forEach(org => {
            const option = document.createElement('option');
            option.value = org;
            option.textContent = org;
            organizacionSelect.appendChild(option);
        });
    }

    if (AppState.dropdownOptions.gerencias.length > 0) {
        gerenciaSelect.innerHTML = '<option value="">Seleccione una gerencia...</option>';
        AppState.dropdownOptions.gerencias.forEach(ger => {
            const option = document.createElement('option');
            option.value = ger;
            option.textContent = ger;
            gerenciaSelect.appendChild(option);
        });
    }
}

function findDriver() {
    const cedulaInput = document.getElementById('cedula');
    const nombreInput = document.getElementById('nombre');
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');

    if (!cedulaInput || !nombreInput) return;

    const cedula = cedulaInput.value.trim();
    
    // Validación básica
    if (cedula.length < 6) {
        resetDriverFields();
        return;
    }

    // Buscar en datos cargados
    const driver = AppState.driverData.find(d => d.cedula === cedula);

    if (driver) {
        nombreInput.value = driver.nombre;
        if (organizacionSelect) organizacionSelect.value = driver.organizacion;
        if (gerenciaSelect) gerenciaSelect.value = driver.gerencia;
        showFieldSuccess(cedulaInput);
    } else {
        resetDriverFields();
        nombreInput.value = 'Chofer no encontrado. Verifique la cédula.';
        showFieldError(cedulaInput);
    }
}

function resetDriverFields() {
    const nombreInput = document.getElementById('nombre');
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');
    
    if (nombreInput) nombreInput.value = '';
    if (organizacionSelect) organizacionSelect.value = '';
    if (gerenciaSelect) gerenciaSelect.value = '';
}

function showFieldSuccess(input) {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
}

function showFieldError(input) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
}

function updateCharacterCount() {
    const textarea = document.getElementById('observaciones');
    const charCount = document.getElementById('char-count');
    
    if (!textarea || !charCount) return;
    
    const count = textarea.value.length;
    charCount.textContent = count;
    
    if (count > 450) {
        charCount.classList.add('char-limit-warning');
    } else {
        charCount.classList.remove('char-limit-warning');
    }
    
    if (count > 500) {
        textarea.value = textarea.value.substring(0, 500);
        charCount.textContent = 500;
    }
}

async function submitReport(e) {
    e.preventDefault();
    
    if (AppState.isLoading) return;
    
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    
    try {
        AppState.isLoading = true;
        showLoading(true);
        hideMessages();
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Procesando...';
        }
        
        const formData = {
            timestamp: new Date().toLocaleString('es-VE'),
            cedula: document.getElementById('cedula')?.value.trim() || '',
            nombre: document.getElementById('nombre')?.value || '',
            organizacion: document.getElementById('organizacion')?.value || '',
            gerencia: document.getElementById('gerencia')?.value || '',
            placa: document.getElementById('placa')?.value.toUpperCase() || '',
            estado: document.querySelector('input[name="estado"]:checked')?.value || '',
            observaciones: document.getElementById('observaciones')?.value.trim() || ''
        };

        // Validación adicional
        if (!validateFormData(formData)) {
            throw new Error('Por favor complete todos los campos requeridos correctamente');
        }

        // Enviar al servidor
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.result === 'success') {
            showSuccess('¡Reporte enviado con éxito!');
            clearForm();
            // Recargar datos
            await loadAllData();
        } else {
            throw new Error(result.error || 'Error desconocido al enviar el reporte');
        }

    } catch (error) {
        console.error('Error al enviar el reporte:', error);
        showError(`Error al enviar el reporte: ${error.message}`);
    } finally {
        AppState.isLoading = false;
        showLoading(false);
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

function validateFormData(data) {
    if (!data.cedula || data.cedula.length < 6) {
        const cedulaInput = document.getElementById('cedula');
        if (cedulaInput) showFieldError(cedulaInput);
        return false;
    }
    
    if (!data.placa || data.placa.length < 3) {
        const placaInput = document.getElementById('placa');
        if (placaInput) showFieldError(placaInput);
        return false;
    }
    
    if (!data.organizacion || !data.gerencia) {
        return false;
    }
    
    return true;
}

function clearForm() {
    const form = document.getElementById('report-form');
    if (form) form.reset();
    
    resetDriverFields();
    
    const charCount = document.getElementById('char-count');
    if (charCount) charCount.textContent = '0';
    
    hideMessages();
    
    // Limpiar estados de validación
    const inputs = document.querySelectorAll('.is-valid, .is-invalid');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
}

// ===============================================================================================
// GESTIÓN DE REPORTES
// ===============================================================================================
function filterAndDisplayReports() {
    if (!AppState.searchTerm) {
        AppState.filteredReports = AppState.allReports;
    } else {
        const searchTerm = AppState.searchTerm.toLowerCase();
        AppState.filteredReports = AppState.allReports.filter(report => 
            Object.values(report).some(value => 
                value && value.toString().toLowerCase().includes(searchTerm)
            )
        );
    }
    
    AppState.currentPage = 1;
    displayReports(AppState.filteredReports);
    setupPagination();
}

function displayReports(reports) {
    const reportsList = document.getElementById('reports-list');
    if (!reportsList) return;
    
    if (!reports || reports.length === 0) {
        reportsList.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                <p class="text-muted">No hay reportes para mostrar</p>
                ${AppState.searchTerm ? '<p class="small">Intente con otros términos de búsqueda</p>' : ''}
                <button class="btn btn-outline-primary btn-sm mt-2" onclick="window.loadAllData && window.loadAllData()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Recargar
                </button>
            </div>
        `;
        return;
    }

    reportsList.innerHTML = reports.map(report => `
        <div class="report-item fade-in ${report.estado === 'Operativa' ? 'operativa' : 'inoperativa'}">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div class="report-item-header">
                    ${report.placa} - ${report.nombre}
                </div>
                <span class="badge ${report.estado === 'Operativa' ? 'bg-success' : 'bg-danger'}">
                    ${report.estado}
                </span>
            </div>
            
            <div class="row report-meta">
                <div class="col-md-6">
                    <strong><i class="bi bi-credit-card me-1"></i>Cédula:</strong> ${report.cedula}
                </div>
                <div class="col-md-6">
                    <strong><i class="bi bi-building me-1"></i>Organización:</strong> ${report.organizacion}
                </div>
            </div>
            
            <div class="row report-meta mb-2">
                <div class="col-md-6">
                    <strong><i class="bi bi-diagram-3 me-1"></i>Gerencia:</strong> ${report.gerencia}
                </div>
                <div class="col-md-6">
                    <strong><i class="bi bi-clock me-1"></i>Reportado:</strong> ${report.timestamp}
                </div>
            </div>
            
            ${report.observaciones ? `
                <div class="report-observations">
                    <strong><i class="bi bi-chat-left-text me-1"></i>Observaciones:</strong>
                    <p class="mb-0 mt-1">${report.observaciones}</p>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function setupPagination() {
    const paginationContainer = document.getElementById('pagination-container');
    const pagination = document.getElementById('pagination');
    
    if (!paginationContainer || !pagination) return;
    
    if (AppState.totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'block';
    pagination.innerHTML = '';
    
    // Botón Anterior
    const prevButton = createPaginationButton('Anterior', AppState.currentPage - 1, AppState.currentPage === 1);
    pagination.appendChild(prevButton);
    
    // Páginas
    for (let i = 1; i <= AppState.totalPages; i++) {
        if (i === 1 || i === AppState.totalPages || Math.abs(i - AppState.currentPage) <= 2) {
            const pageButton = createPaginationButton(i, i, false, i === AppState.currentPage);
            pagination.appendChild(pageButton);
        } else if (Math.abs(i - AppState.currentPage) === 3) {
            const ellipsis = document.createElement('li');
            ellipsis.className = 'page-item disabled';
            ellipsis.innerHTML = '<span class="page-link">...</span>';
            pagination.appendChild(ellipsis);
        }
    }
    
    // Botón Siguiente
    const nextButton = createPaginationButton('Siguiente', AppState.currentPage + 1, AppState.currentPage === AppState.totalPages);
    pagination.appendChild(nextButton);
}

function createPaginationButton(text, page, disabled = false, active = false) {
    const li = document.createElement('li');
    li.className = `page-item ${disabled ? 'disabled' : ''} ${active ? 'active' : ''}`;
    
    const button = document.createElement('button');
    button.className = 'page-link';
    button.textContent = text;
    button.disabled = disabled;
    
    if (!disabled && !active) {
        button.addEventListener('click', () => {
            AppState.currentPage = page;
            loadAllData();
        });
    }
    
    li.appendChild(button);
    return li;
}

// ===============================================================================================
// ESTADÍSTICAS Y DASHBOARD
// ===============================================================================================
function updateDashboard(stats) {
    const dashboard = document.getElementById('stats-dashboard');
    if (!dashboard) return;
    
    dashboard.style.display = 'flex';
    
    const totalEl = document.getElementById('total-reports');
    const operationalEl = document.getElementById('operational-reports');
    const nonoperationalEl = document.getElementById('nonoperational-reports');
    const organizationsEl = document.getElementById('organizations-count');
    
    if (totalEl) totalEl.textContent = stats.total || 0;
    if (operationalEl) operationalEl.textContent = stats.operativas || 0;
    if (nonoperationalEl) nonoperationalEl.textContent = stats.inoperativas || 0;
    if (organizationsEl) organizationsEl.textContent = Object.keys(stats.organizaciones || {}).length;
}

// ===============================================================================================
// UTILIDADES
// ===============================================================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showLoading(show, message = 'Procesando...') {
    const loadingDiv = document.getElementById('loading');
    if (!loadingDiv) return;
    
    if (show) {
        loadingDiv.style.display = 'block';
        const messageEl = loadingDiv.querySelector('p');
        if (messageEl) messageEl.textContent = message;
    } else {
        loadingDiv.style.display = 'none';
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    if (!successDiv) return;
    
    const messageElement = successDiv.querySelector('.message');
    if (messageElement) messageElement.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return;
    
    const messageElement = errorDiv.querySelector('.message');
    if (messageElement) messageElement.textContent = message;
    errorDiv.style.display = 'block';
}

function hideMessages() {
    const successDiv = document.getElementById('success-message');
    const errorDiv = document.getElementById('error-message');
    
    if (successDiv) successDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
}

function showAppStatus(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Puedes agregar aquí un sistema de notificaciones visual
    const statusElement = document.getElementById('app-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `app-status app-status-${type}`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
}

// ===============================================================================================
// FUNCIONES GLOBALES
// ===============================================================================================
// Hacer funciones disponibles globalmente
window.loadAllData = loadAllData;
window.loadReports = loadAllData;
window.clearForm = clearForm;

// ===============================================================================================
// MANEJO DE ERRORES GLOBALES
// ===============================================================================================
window.addEventListener('error', (event) => {
    console.error('Error global:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rechazada no manejada:', event.reason);
    showError('Error inesperado en la aplicación');
});

console.log('✅ reportes.js cargado correctamente');
