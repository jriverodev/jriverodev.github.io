// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL - REPORTES
// ===============================================================================================
const CONFIG = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxC2GMVUYiag-R3pIljThXgeuKc2yVSVqyfb9qyyrpK4kU7LqZzJRq9HihMYJU3DP0/exec',
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
    dropdownOptions: {}
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        // Cargar datos primero
        await loadDriverData();
        await loadDropdownOptions();
        
        // Inicializar componentes
        initializeEventListeners();
        populateDropdowns();
        
        // Cargar datos de reportes
        await Promise.all([
            loadStatistics(),
            loadReports()
        ]);
        
        console.log('✅ Aplicación de reportes inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación:', error);
        showError('Error al inicializar la aplicación');
    }
}

// ===============================================================================================
// CARGA DE DATOS EXTERNOS
// ===============================================================================================
async function loadDriverData() {
    try {
        const response = await fetch(`${CONFIG.WEB_APP_URL}?action=drivers`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        AppState.driverData = data;
        
        console.log(`✅ Datos de ${data.length} choferes cargados correctamente`);
        
    } catch (error) {
        console.error('❌ Error cargando datos de choferes:', error);
        AppState.driverData = [];
        showError('Error cargando datos de choferes. Verifique que los choferes estén registrados.');
    }
}

async function loadDropdownOptions() {
    try {
        const response = await fetch(`${CONFIG.WEB_APP_URL}?action=dropdowns`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        AppState.dropdownOptions = data;
        
        console.log('✅ Opciones de dropdown cargadas correctamente');
        
    } catch (error) {
        console.error('❌ Error cargando opciones de dropdown:', error);
        AppState.dropdownOptions = {
            organizaciones: [],
            gerencias: []
        };
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
// FUNCIONALIDADES DEL FORMULARIO DE REPORTES
// ===============================================================================================
function populateDropdowns() {
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');

    // Limpiar selects
    organizacionSelect.innerHTML = '<option value="">Seleccione una organización...</option>';
    gerenciaSelect.innerHTML = '<option value="">Seleccione una gerencia...</option>';

    // Llenar organizaciones desde datos cargados
    if (AppState.dropdownOptions.organizaciones && AppState.dropdownOptions.organizaciones.length > 0) {
        AppState.dropdownOptions.organizaciones.forEach(org => {
            const option = document.createElement('option');
            option.value = org;
            option.textContent = org;
            organizacionSelect.appendChild(option);
        });
    }

    // Llenar gerencias desde datos cargados
    if (AppState.dropdownOptions.gerencias && AppState.dropdownOptions.gerencias.length > 0) {
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

    const cedula = cedulaInput.value.trim();
    
    // Validación básica
    if (cedula.length < 6) {
        resetDriverFields();
        return;
    }

    // Buscar en datos cargados dinámicamente
    const driver = AppState.driverData.find(d => d.cedula === cedula);

    if (driver) {
        nombreInput.value = driver.nombre;
        organizacionSelect.value = driver.organizacion;
        gerenciaSelect.value = driver.gerencia;
        showFieldSuccess(cedulaInput);
    } else {
        resetDriverFields();
        nombreInput.value = 'Chofer no encontrado. Verifique la cédula o regístrelo primero.';
        showFieldError(cedulaInput);
    }
}

function resetDriverFields() {
    document.getElementById('nombre').value = '';
    document.getElementById('organizacion').value = '';
    document.getElementById('gerencia').value = '';
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
    const originalText = submitBtn.innerHTML;
    
    try {
        AppState.isLoading = true;
        showLoading(true);
        hideMessages();
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Procesando...';
        
        const formData = {
            timestamp: new Date().toLocaleString('es-VE'),
            cedula: document.getElementById('cedula').value.trim(),
            nombre: document.getElementById('nombre').value,
            organizacion: document.getElementById('organizacion').value,
            gerencia: document.getElementById('gerencia').value,
            placa: document.getElementById('placa').value.toUpperCase(),
            estado: document.querySelector('input[name="estado"]:checked').value,
            observaciones: document.getElementById('observaciones').value.trim()
        };

        // Validación adicional
        if (!validateFormData(formData)) {
            throw new Error('Por favor complete todos los campos requeridos correctamente');
        }

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
            showSuccess('¡Reporte enviado con éxito! Se ha registrado en el sistema.');
            clearForm();
            await Promise.all([
                loadStatistics(),
                loadReports()
            ]);
        } else {
            throw new Error(result.error || 'Error desconocido al enviar el reporte');
        }

    } catch (error) {
        console.error('Error al enviar el reporte:', error);
        showError(`Error al enviar el reporte: ${error.message}`);
    } finally {
        AppState.isLoading = false;
        showLoading(false);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

function validateFormData(data) {
    if (!data.cedula || data.cedula.length < 6) {
        showFieldError(document.getElementById('cedula'));
        return false;
    }
    
    if (!data.placa || data.placa.length < 3) {
        showFieldError(document.getElementById('placa'));
        return false;
    }
    
    if (!data.organizacion || !data.gerencia) {
        return false;
    }
    
    return true;
}

function clearForm() {
    document.getElementById('report-form').reset();
    resetDriverFields();
    document.getElementById('char-count').textContent = '0';
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
async function loadReports(page = 1) {
    const reportsList = document.getElementById('reports-list');
    
    try {
        reportsList.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary mb-3"></div>
                <p class="text-muted">Cargando reportes...</p>
            </div>
        `;

        const url = `${CONFIG.WEB_APP_URL}?action=read&page=${page}&limit=${CONFIG.ITEMS_PER_PAGE}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.reports || !Array.isArray(data.reports)) {
            throw new Error('Formato de respuesta inválido');
        }

        AppState.allReports = data.reports;
        AppState.filteredReports = data.reports;
        AppState.currentPage = page;
        AppState.totalPages = data.pagination?.totalPages || 1;

        displayReports(data.reports);
        setupPagination();

    } catch (error) {
        console.error('Error cargando reportes:', error);
        reportsList.innerHTML = `
            <div class="text-center py-4">
                <i class="bi bi-exclamation-triangle display-4 text-danger mb-3"></i>
                <p class="text-danger">Error al cargar los reportes</p>
                <p class="text-muted small">${error.message}</p>
                <button class="btn btn-outline-primary btn-sm mt-2" onclick="loadReports()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Reintentar
                </button>
            </div>
        `;
    }
}

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
    
    if (!reports || reports.length === 0) {
        reportsList.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-inbox display-4 text-muted mb-3"></i>
                <p class="text-muted">No hay reportes para mostrar</p>
                ${AppState.searchTerm ? '<p class="small">Intente con otros términos de búsqueda</p>' : ''}
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
        button.addEventListener('click', () => loadReports(page));
    }
    
    li.appendChild(button);
    return li;
}

// ===============================================================================================
// ESTADÍSTICAS Y DASHBOARD
// ===============================================================================================
async function loadStatistics() {
    try {
        const response = await fetch(`${CONFIG.WEB_APP_URL}?action=stats`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const stats = await response.json();
        updateDashboard(stats);
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        updateDashboard({
            total: 0,
            operativas: 0,
            inoperativas: 0,
            organizaciones: {}
        });
    }
}

function updateDashboard(stats) {
    document.getElementById('stats-dashboard').style.display = 'flex';
    document.getElementById('total-reports').textContent = stats.total || 0;
    document.getElementById('operational-reports').textContent = stats.operativas || 0;
    document.getElementById('nonoperational-reports').textContent = stats.inoperativas || 0;
    document.getElementById('organizations-count').textContent = Object.keys(stats.organizaciones || {}).length;
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
    if (show) {
        loadingDiv.style.display = 'block';
        loadingDiv.querySelector('p').textContent = message;
    } else {
        loadingDiv.style.display = 'none';
    }
}

function showSuccess(message) {
    const successDiv = document.getElementById('success-message');
    const messageElement = successDiv.querySelector('.message');
    
    messageElement.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const messageElement = errorDiv.querySelector('.message');
    
    messageElement.textContent = message;
    errorDiv.style.display = 'block';
}

function hideMessages() {
    document.getElementById('success-message').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
}

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

// ===============================================================================================
// FUNCIONES GLOBALES PARA USO EN HTML
// ===============================================================================================
// Hacer funciones disponibles globalmente para onclick en HTML
window.loadReports = loadReports;
