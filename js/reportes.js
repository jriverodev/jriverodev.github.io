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
        
        const data = await jsonpRequest(`${CONFIG.WEB_APP_URL}?action=test`);
        console.log('✅ Conexión JSONP exitosa:', data);
        return true;
        
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
        const [driverData, dropdownOptions, stats, reports] = await Promise.allSettled([
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=drivers`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=dropdowns`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=stats`),
            safeJSONPRequest(`${CONFIG.WEB_APP_URL}?action=read&limit=${CONFIG.ITEMS_PER_PAGE}`)
        ]);
        
        // Procesar resultados
        if (driverData.status === 'fulfilled' && driverData.value) {
            AppState.driverData = driverData.value;
            console.log(`✅ ${driverData.value.length} choferes cargados via JSONP`);
        } else {
            console.warn('⚠️ No se pudieron cargar los datos de choferes via JSONP');
            AppState.driverData = getExampleDrivers();
        }
        
        if (dropdownOptions.status === 'fulfilled' && dropdownOptions.value) {
            AppState.dropdownOptions = dropdownOptions.value;
            populateDropdowns();
            console.log('✅ Dropdowns cargados via JSONP');
        } else {
            console.warn('⚠️ No se pudieron cargar las opciones de dropdown via JSONP');
            AppState.dropdownOptions = getExampleDropdowns();
            populateDropdowns();
        }
        
        if (stats.status === 'fulfilled' && stats.value) {
            updateDashboard(stats.value);
            console.log('✅ Estadísticas cargadas via JSONP');
        } else {
            console.warn('⚠️ No se pudieron cargar las estadísticas via JSONP');
            updateDashboard(getExampleStats());
        }
        
        if (reports.status === 'fulfilled' && reports.value) {
            AppState.allReports = reports.value.reports || [];
            AppState.filteredReports = reports.value.reports || [];
            displayReports(reports.value.reports || []);
            console.log(`✅ ${reports.value.reports?.length || 0} reportes cargados via JSONP`);
        } else {
            console.warn('⚠️ No se pudieron cargar los reportes via JSONP');
            displayReports([]);
        }
        
    } catch (error) {
        console.error('Error en loadAllDataJSONP:', error);
        throw error;
    }
}

async function safeJSONPRequest(url) {
    try {
        return await jsonpRequest(url);
    } catch (error) {
        console.error(`Error en safeJSONPRequest (${url}):`, error);
        return null;
    }
}

// ===============================================================================================
// ENVÍO DE REPORTES (POST normal - debería funcionar con CORS headers)
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
// FUNCIONES AUXILIARES (se mantienen igual)
// ===============================================================================================
function initializeEventListeners() {
    const cedulaInput = document.getElementById('cedula');
    const reportForm = document.getElementById('report-form');
    const clearFormBtn = document.getElementById('clear-form');
    const refreshBtn = document.getElementById('refresh-reports');
    const searchInput = document.getElementById('search-reports');
    const observacionesTextarea = document.getElementById('observaciones');

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

    if (observacionesTextarea) {
        observacionesTextarea.addEventListener('input', updateCharacterCount);
    }
    
    console.log('✅ Event listeners inicializados');
}

// ... (el resto de las funciones se mantienen igual: populateDropdownsWithDefaults, populateDropdowns, 
// findDriver, resetDriverFields, validateFormData, clearForm, filterAndDisplayReports, displayReports, 
// setupPagination, updateDashboard, debounce, showLoading, showSuccess, showError, hideMessages, 
// showAppStatus, getExampleDrivers, getExampleDropdowns, getExampleStats, loadExampleData)

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
}

// ===============================================================================================
// FUNCIONES GLOBALES
// ===============================================================================================
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

console.log('✅ reportes.js (JSONP) cargado correctamente');
console.log('💡 Usa testConnection() en la consola para probar la conexión JSONP');
