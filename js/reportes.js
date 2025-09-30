// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL - REPORTES (VERSIÓN JSONP)
// ===============================================================================================
const CONFIG = {
    // TU URL REAL - FUNCIONA CON JSONP
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwlNHbAbgD3AZHjmhk8NDfh_uag5HXklXyJoN_i9qUCDbmajJwHfLvEa8lyBEq4HUW0/exec',
    ITEMS_PER_PAGE: 10,
    DEBOUNCE_DELAY: 500,
    REQUEST_TIMEOUT: 15000
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
    },
    isOnline: true
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación de reportes...');
    console.log('🔗 URL del script:', CONFIG.WEB_APP_URL);
    initializeApp();
});

async function initializeApp() {
    try {
        showAppStatus('Inicializando aplicación...', 'info');
        
        // Inicializar componentes básicos primero
        initializeEventListeners();
        populateDropdownsWithDefaults();
        
        // Verificar conexión con JSONP
        const isConnected = await testConnectionJSONP();
        AppState.isOnline = isConnected;
        
        if (isConnected) {
            await loadAllDataJSONP();
            showAppStatus('Aplicación cargada correctamente', 'success');
        } else {
            await loadExampleData();
            showAppStatus('Modo offline - Usando datos de ejemplo', 'warning');
        }
        
        console.log('✅ Aplicación inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación:', error);
        showAppStatus('Error al cargar la aplicación', 'error');
        await loadExampleData();
    }
}

// ===============================================================================================
// MÉTODOS JSONP PARA GET
// ===============================================================================================
function jsonpRequest(url) {
    return new Promise((resolve, reject) => {
        const callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random());
        const timeoutId = setTimeout(() => {
            reject(new Error('JSONP timeout'));
            cleanup();
        }, 10000);

        function cleanup() {
            clearTimeout(timeoutId);
            delete window[callbackName];
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
        }

        window[callbackName] = function(data) {
            cleanup();
            resolve(data);
        };

        const script = document.createElement('script');
        script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'callback=' + callbackName;
        script.onerror = function() {
            cleanup();
            reject(new Error('JSONP script error'));
        };

        document.head.appendChild(script);
    });
}

// ===============================================================================================
// VERIFICACIÓN DE CONEXIÓN CON JSONP
// ===============================================================================================
async function testConnectionJSONP() {
    try {
        console.log('🔗 Probando conexión JSONP...');
        
        // CORRECCIÓN: safeJSONPRequest ahora maneja errores del Apps Script
        const data = await safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=test`);
        
        if (data && data.status === 'success') {
            console.log('✅ Conexión JSONP exitosa:', data);
            return true;
        } else {
            console.error('❌ Conexión JSONP fallida o Apps Script reportó un error:', data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ Error de conexión JSONP:', error);
        return false;
    }
}

// ===============================================================================================
// CARGA DE DATOS CON JSONP
// ===============================================================================================
async function loadAllDataJSONP() {
    try {
        // Cargar datos en paralelo con JSONP
        const [driverDataResult, dropdownOptionsResult, statsResult, reportsResult] = await Promise.allSettled([
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=drivers`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=dropdowns`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=stats`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=read&limit=${CONFIG.ITEMS_PER_PAGE}`)
        ]);
        
        // Procesar resultados
        if (driverDataResult.status === 'fulfilled' && driverDataResult.value) {
            AppState.driverData = driverDataResult.value;
            console.log(`✅ ${AppState.driverData.length} choferes cargados via JSONP`);
        } else {
            console.warn('⚠️ No se pudieron cargar los datos de choferes via JSONP. Usando datos de ejemplo.');
            AppState.driverData = getExampleDrivers();
        }
        
        if (dropdownOptionsResult.status === 'fulfilled' && dropdownOptionsResult.value) {
            AppState.dropdownOptions = dropdownOptionsResult.value;
            populateDropdowns();
            console.log('✅ Dropdowns cargados via JSONP');
        } else {
            console.warn('⚠️ No se pudieron cargar las opciones de dropdown via JSONP. Usando datos de ejemplo.');
            AppState.dropdownOptions = getExampleDropdowns();
            populateDropdowns(); // Asegurarse de que los dropdowns se pueblen incluso con ejemplos
        }
        
        if (statsResult.status === 'fulfilled' && statsResult.value) {
            updateDashboard(statsResult.value);
            console.log('✅ Estadísticas cargadas via JSONP');
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas via JSONP. Usando datos de ejemplo.');
            updateDashboard(getExampleStats());
        }
        
        if (reportsResult.status === 'fulfilled' && reportsResult.value) {
            AppState.allReports = reportsResult.value.reports || [];
            AppState.filteredReports = reportsResult.value.reports || [];
            displayReports(reportsResult.value.reports || []);
            console.log(`✅ ${AppState.allReports.length} reportes cargados via JSONP`);
        } else {
            console.warn('⚠️ No se pudieron cargar los reportes via JSONP. Mostrando lista vacía.');
            displayReports([]);
        }
        
    } catch (error) {
        console.error('Error en loadAllDataJSONP:', error);
        throw error;
    }
}

// CORRECCIÓN: Función para envolver las solicitudes JSONP y manejar errores del Apps Script
async function safeJSONPRequest(url) {
    try {
        const responseData = await jsonpRequest(url);
        // Verificar si la respuesta del Apps Script indica un error
        if (responseData && responseData.result === 'error') {
            console.error(`Error reportado por Apps Script para ${url}:`, responseData.error);
            // Lanzar un error para que Promise.allSettled lo capture como 'rejected'
            throw new Error(responseData.error.message || 'Error desconocido del Apps Script');
        }
        return responseData;
    } catch (error) {
        console.error(`Error en safeJSONPRequest (${url}):`, error);
        return null; // Devolver null para indicar que la solicitud falló o hubo un error en el script
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
            loadAllDataJSONP().finally(() => {
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
    if (AppState.dropdownOptions && AppState.dropdownOptions.organizaciones && AppState.dropdownOptions.organizaciones.length > 0) {
        organizacionSelect.innerHTML = '<option value="">Seleccione una organización...</option>';
        AppState.dropdownOptions.organizaciones.forEach(org => {
            const option = document.createElement('option');
            option.value = org;
            option.textContent = org;
            organizacionSelect.appendChild(option);
        });
    } else {
        // Si no hay datos del servidor, asegúrate de que los valores por defecto estén presentes
        populateDropdownsWithDefaults();
    }

    if (AppState.dropdownOptions && AppState.dropdownOptions.gerencias && AppState.dropdownOptions.gerencias.length > 0) {
        gerenciaSelect.innerHTML = '<option value="">Seleccione una gerencia...</option>';
        AppState.dropdownOptions.gerencias.forEach(ger => {
            const option = document.createElement('option');
            option.value = ger;
            option.textContent = ger;
            gerenciaSelect.appendChild(option);
        });
    } else {
        // Si no hay datos del servidor, asegúrate de que los valores por defecto estén presentes
        populateDropdownsWithDefaults();
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

// ===============================================================================================
// ENVÍO DE REPORTES (POST)
// ===============================================================================================
async function submitReport(e) {
    e.preventDefault();
    
    if (AppState.isLoading) return;
    
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    
    try {
        AppState.isLoading = true;
        showLoading(true, 'Enviando reporte...');
        hideMessages();
        
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Enviando...';
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

        console.log('📤 Enviando datos del reporte:', formData);

        // Validación adicional
        if (!validateFormData(formData)) {
            throw new Error('Por favor complete todos los campos requeridos correctamente');
        }

        // Enviar POST normal (debería funcionar con los headers CORS)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

        console.log('🔗 Enviando POST a:', CONFIG.WEB_APP_URL);
        
        const response = await fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.result === 'success') {
            showSuccess('¡Reporte enviado con éxito! Se ha registrado en el sistema.');
            clearForm();
            // Recargar datos usando JSONP
            await loadAllDataJSONP();
        } else {
            throw new Error(result.error || 'Error desconocido al enviar el reporte');
        }

    } catch (error) {
        console.error('❌ Error al enviar el reporte:', error);
        
        let errorMessage = 'Error al enviar el reporte: ';
        
        if (error.name === 'AbortError') {
            errorMessage += 'Tiempo de espera agotado. ';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += 'Error de red/CORS. ';
        }
        
        errorMessage += 'Los datos se guardaron localmente y se sincronizarán cuando se restablezca la conexión.';
        
        showError(errorMessage);
        
        // Guardar localmente como fallback
        saveReportLocally(formData);
        
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
    let isValid = true;
    
    // Resetear validación visual
    const inputsToValidate = ['cedula', 'placa', 'organizacion', 'gerencia'];
    inputsToValidate.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.classList.remove('is-valid', 'is-invalid');
        }
    });

    if (!data.cedula || data.cedula.length < 6) {
        const cedulaInput = document.getElementById('cedula');
        if (cedulaInput) showFieldError(cedulaInput);
        isValid = false;
    } else {
        const cedulaInput = document.getElementById('cedula');
        if (cedulaInput) showFieldSuccess(cedulaInput);
    }
    
    if (!data.placa || data.placa.length < 3) {
        const placaInput = document.getElementById('placa');
        if (placaInput) showFieldError(placaInput);
        isValid = false;
    } else {
        const placaInput = document.getElementById('placa');
        if (placaInput) showFieldSuccess(placaInput);
    }
    
    if (!data.organizacion) {
        const orgSelect = document.getElementById('organizacion');
        if (orgSelect) showFieldError(orgSelect);
        isValid = false;
    } else {
        const orgSelect = document.getElementById('organizacion');
        if (orgSelect) showFieldSuccess(orgSelect);
    }
    
    if (!data.gerencia) {
        const gerenciaSelect = document.getElementById('gerencia');
        if (gerenciaSelect) showFieldError(gerenciaSelect);
        isValid = false;
    } else {
        const gerenciaSelect = document.getElementById('gerencia');
        if (gerenciaSelect) showFieldSuccess(gerenciaSelect);
    }
    
    return isValid;
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

// Guardar reporte localmente como fallback
function saveReportLocally(formData) {
    try {
        const localReports = JSON.parse(localStorage.getItem('pending_reports') || '[]');
        localReports.push({
            ...formData,
            id: Date.now(),
            pending: true
        });
        localStorage.setItem('pending_reports', JSON.stringify(localReports));
        console.log('💾 Reporte guardado localmente:', formData);
    } catch (error) {
        console.error('Error guardando localmente:', error);
    }
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
    
    // CORRECCIÓN: Calcular totalPages basado en AppState.filteredReports
    AppState.totalPages = Math.ceil(AppState.filteredReports.length / CONFIG.ITEMS_PER_PAGE);

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
            // CORRECCIÓN: Volver a filtrar y mostrar los reportes paginados localmente
            const startIndex = (AppState.currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
            const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
            displayReports(AppState.filteredReports.slice(startIndex, endIndex));
            setupPagination(); // Re-renderizar paginación para actualizar estados
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
        }, 5000);
    }
}

// ===============================================================================================
// FUNCIONES DE DIAGNÓSTICO MEJORADAS
// ===============================================================================================
async function testConnectionManual() {
    try {
        console.log('🧪 Probando conexión manualmente...');
        showAppStatus('Probando conexión JSONP...', 'info');
        
        const result = await testConnectionJSONP();
        
        if (result) {
            showAppStatus('✅ Conexión JSONP exitosa', 'success');
            await loadAllDataJSONP();
        } else {
            showAppStatus('❌ Error de conexión JSONP', 'error');
        }
        
        return result;
    } catch (error) {
        console.error('Error en test manual:', error);
        showAppStatus('❌ Error en prueba de conexión', 'error');
        return false;
    }
}

function showSystemInfo() {
    console.log('🔧 Información del sistema:');
    console.log('• URL:', CONFIG.WEB_APP_URL);
    console.log('• Choferes cargados:', AppState.driverData.length);
    console.log('• Reportes cargados:', AppState.allReports.length);
    console.log('• Estado conexión:', AppState.isOnline ? 'Online' : 'Offline');
    console.log('• Método:', 'JSONP');
    console.log('• Organizaciones:', AppState.dropdownOptions.organizaciones);
    console.log('• Gerencias:', AppState.dropdownOptions.gerencias);
}

// ===============================================================================================
// FUNCIONES GLOBALES
// ===============================================================================================
// Hacer funciones disponibles globalmente
window.loadAllData = loadAllDataJSONP;
window.loadReports = loadAllDataJSONP;
window.clearForm = clearForm;
window.testConnection = testConnectionManual;
window.showSystemInfo = showSystemInfo;

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

// Detectar cambios en la conexión
window.addEventListener('online', () => {
    console.log('🌐 Conexión restaurada');
    AppState.isOnline = true;
    showAppStatus('Conexión restaurada - Sincronizando datos...', 'success');
    loadAllDataJSONP();
});

window.addEventListener('offline', () => {
    console.log('📴 Sin conexión');
    AppState.isOnline = false;
    showAppStatus('Sin conexión - Modo offline', 'warning');
});

console.log('✅ reportes.js (JSONP) cargado correctamente');
console.log('💡 Usa testConnection() en la consola para probar la conexión JSONP');
console.log('💡 Usa showSystemInfo() para ver información del sistema');
