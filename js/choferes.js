// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL - GESTIÓN DE CHOFERES
// ===============================================================================================
const CONFIG_CHOFERES = {
    // ⚠️ ACTUALIZA ESTA URL CON TU WEB APP URL REAL
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbwlNHbAbgD3AZHjmhk8NDfh_uag5HXklXyJoN_i9qUCDbmajJwHfLvEa8lyBEq4HUW0/exec',
    DEBOUNCE_DELAY: 500
};

// Estado global de la aplicación de choferes
const ChoferesState = {
    driverData: [],
    searchTerm: '',
    isLoading: false,
    isOnline: true
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Iniciando aplicación de gestión de choferes...');
    initializeChoferesApp();
});

async function initializeChoferesApp() {
    try {
        // Mostrar estado de carga
        showChoferAppStatus('Cargando aplicación...', 'info');
        
        // Inicializar componentes básicos primero
        initializeChoferesEventListeners();
        
        // Verificar conexión con el servidor
        const isConnected = await testChoferesConnection();
        ChoferesState.isOnline = isConnected;
        
        if (isConnected) {
            // Cargar datos del servidor
            await loadChoferesData();
            showChoferAppStatus('Aplicación cargada correctamente', 'success');
        } else {
            // Modo offline con datos de ejemplo
            await loadExampleChoferesData();
            showChoferAppStatus('Modo offline - Usando datos de ejemplo', 'warning');
        }
        
        console.log('✅ Aplicación de choferes inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación de choferes:', error);
        showChoferAppStatus('Error al cargar la aplicación', 'error');
        // Cargar datos de ejemplo como fallback
        await loadExampleChoferesData();
    }
}

// ===============================================================================================
// VERIFICACIÓN DE CONEXIÓN
// ===============================================================================================
async function testChoferesConnection() {
    try {
        console.log('🔗 Probando conexión con el servidor...');
        const response = await fetch(`${CONFIG_CHOFERES.WEB_APP_URL}?action=test`);
        
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
// CARGA DE DATOS DE CHOFERES
// ===============================================================================================
async function loadChoferesData() {
    try {
        showChoferLoading(true, 'Cargando datos de choferes...');
        
        console.log('📋 Cargando datos de choferes...');
        const response = await fetch(`${CONFIG_CHOFERES.WEB_APP_URL}?action=drivers`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const text = await response.text();
        
        if (!text) {
            throw new Error('Respuesta vacía del servidor');
        }
        
        const data = JSON.parse(text);
        
        if (!Array.isArray(data)) {
            throw new Error('Formato de respuesta inválido');
        }
        
        ChoferesState.driverData = data;
        
        updateChoferesStats(data);
        displayChoferes(data);
        
        console.log(`✅ ${data.length} choferes cargados correctamente`);
        
    } catch (error) {
        console.error('❌ Error cargando datos de choferes:', error);
        showChoferError('Error al cargar los datos de choferes. Usando datos de ejemplo.');
        await loadExampleChoferesData();
    } finally {
        showChoferLoading(false);
    }
}

// ===============================================================================================
// DATOS DE EJEMPLO (FALLBACK)
// ===============================================================================================
function getExampleChoferes() {
    return [
        { cedula: '12345678', nombre: 'Juan Perez', organizacion: 'Contratista', gerencia: 'Transporte' },
        { cedula: '87654321', nombre: 'Maria Rodriguez', organizacion: 'PDVSA', gerencia: 'Producción' },
        { cedula: '11223344', nombre: 'Carlos Gomez', organizacion: 'Contratista', gerencia: 'Mantenimiento' },
        { cedula: '44332211', nombre: 'Ana Fernandez', organizacion: 'PDVSA', gerencia: 'Transporte' },
        { cedula: '55667788', nombre: 'Pedro Martinez', organizacion: 'Contratista', gerencia: 'Logística' },
        { cedula: '99887766', nombre: 'Laura Gonzalez', organizacion: 'PDVSA', gerencia: 'Seguridad' }
    ];
}

async function loadExampleChoferesData() {
    ChoferesState.driverData = getExampleChoferes();
    updateChoferesStats(ChoferesState.driverData);
    displayChoferes(ChoferesState.driverData);
}

// ===============================================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// ===============================================================================================
function initializeChoferesEventListeners() {
    const choferForm = document.getElementById('chofer-form');
    const limpiarBtn = document.getElementById('limpiar-chofer');
    const actualizarBtn = document.getElementById('actualizar-choferes');
    const buscarInput = document.getElementById('buscar-chofer');

    // Eventos del formulario
    if (choferForm) {
        choferForm.addEventListener('submit', submitChofer);
    }
    
    if (limpiarBtn) {
        limpiarBtn.addEventListener('click', clearChoferForm);
    }

    // Eventos de la lista de choferes
    if (actualizarBtn) {
        actualizarBtn.addEventListener('click', () => {
            actualizarBtn.classList.add('pulse');
            loadChoferesData().finally(() => {
                setTimeout(() => actualizarBtn.classList.remove('pulse'), 1000);
            });
        });
    }

    if (buscarInput) {
        buscarInput.addEventListener('input', debounceChofer((e) => {
            ChoferesState.searchTerm = e.target.value.trim();
            filterAndDisplayChoferes();
        }, CONFIG_CHOFERES.DEBOUNCE_DELAY));
    }
    
    console.log('✅ Event listeners de choferes inicializados');
}

// ===============================================================================================
// GESTIÓN DE CHOFERES - FORMULARIO
// ===============================================================================================
async function submitChofer(e) {
    e.preventDefault();
    
    if (ChoferesState.isLoading) return;
    
    const guardarBtn = document.getElementById('guardar-chofer');
    const originalText = guardarBtn ? guardarBtn.innerHTML : '';
    
    try {
        ChoferesState.isLoading = true;
        showChoferLoading(true, 'Guardando chofer...');
        hideChoferMessages();
        
        if (guardarBtn) {
            guardarBtn.disabled = true;
            guardarBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando...';
        }
        
        const formData = {
            cedula: document.getElementById('nueva-cedula')?.value.trim() || '',
            nombre: document.getElementById('nuevo-nombre')?.value.trim() || '',
            organizacion: document.getElementById('nueva-organizacion')?.value.trim() || '',
            gerencia: document.getElementById('nueva-gerencia')?.value.trim() || ''
        };

        // Validación
        if (!validateChoferData(formData)) {
            throw new Error('Por favor complete todos los campos correctamente');
        }

        // Verificar si la cédula ya existe (localmente)
        const choferExistente = ChoferesState.driverData.find(c => c.cedula === formData.cedula);
        if (choferExistente) {
            throw new Error('Ya existe un chofer registrado con esta cédula');
        }

        if (ChoferesState.isOnline) {
            // Enviar al servidor si estamos online
            await saveChoferToServer(formData);
        } else {
            // Guardar localmente si estamos offline
            saveChoferLocally(formData);
        }
        
        showChoferSuccess('¡Chofer registrado exitosamente!');
        clearChoferForm();
        
        // Actualizar estadísticas y lista
        updateChoferesStats(ChoferesState.driverData);
        filterAndDisplayChoferes();

    } catch (error) {
        console.error('Error al guardar chofer:', error);
        showChoferError(`Error al guardar chofer: ${error.message}`);
    } finally {
        ChoferesState.isLoading = false;
        showChoferLoading(false);
        if (guardarBtn) {
            guardarBtn.disabled = false;
            guardarBtn.innerHTML = originalText;
        }
    }
}

// Guardar chofer en el servidor
async function saveChoferToServer(choferData) {
    try {
        const params = new URLSearchParams({
            cedula: choferData.cedula,
            nombre: choferData.nombre,
            organizacion: choferData.organizacion,
            gerencia: choferData.gerencia
        });
        
        const response = await fetch(`${CONFIG_CHOFERES.WEB_APP_URL}?action=addDriver&${params}`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.result !== 'success') {
            throw new Error(result.error || 'Error desconocido al guardar chofer');
        }
        
        // Agregar a la lista local
        ChoferesState.driverData.push(choferData);
        
    } catch (error) {
        console.error('Error guardando chofer en servidor:', error);
        // Si falla el servidor, guardar localmente
        saveChoferLocally(choferData);
        throw new Error('No se pudo conectar con el servidor. El chofer se guardó localmente.');
    }
}

// Guardar chofer localmente
function saveChoferLocally(choferData) {
    ChoferesState.driverData.push(choferData);
    
    // Guardar en localStorage como respaldo
    try {
        localStorage.setItem('choferes_backup', JSON.stringify(ChoferesState.driverData));
    } catch (e) {
        console.warn('No se pudo guardar en localStorage:', e);
    }
}

function validateChoferData(data) {
    // Validar cédula (solo números, 6-10 dígitos)
    if (!data.cedula || !/^\d{6,10}$/.test(data.cedula)) {
        showFieldErrorChofer(document.getElementById('nueva-cedula'));
        return false;
    }
    
    // Validar nombre (mínimo 3 caracteres)
    if (!data.nombre || data.nombre.length < 3) {
        showFieldErrorChofer(document.getElementById('nuevo-nombre'));
        return false;
    }
    
    // Validar organización
    if (!data.organizacion) {
        showFieldErrorChofer(document.getElementById('nueva-organizacion'));
        return false;
    }
    
    // Validar gerencia
    if (!data.gerencia) {
        showFieldErrorChofer(document.getElementById('nueva-gerencia'));
        return false;
    }
    
    return true;
}

function clearChoferForm() {
    const form = document.getElementById('chofer-form');
    if (form) form.reset();
    
    hideChoferMessages();
    
    // Limpiar estados de validación
    const inputs = document.querySelectorAll('.is-valid, .is-invalid');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
}

// ===============================================================================================
// GESTIÓN DE CHOFERES - LISTA Y BÚSQUEDA
// ===============================================================================================
function filterAndDisplayChoferes() {
    let filteredData = ChoferesState.driverData;
    
    if (ChoferesState.searchTerm) {
        const searchTerm = ChoferesState.searchTerm.toLowerCase();
        filteredData = ChoferesState.driverData.filter(chofer => 
            Object.values(chofer).some(value => 
                value && value.toString().toLowerCase().includes(searchTerm)
            )
        );
    }
    
    displayChoferes(filteredData);
}

function displayChoferes(choferes) {
    const listaChoferes = document.getElementById('lista-choferes');
    if (!listaChoferes) return;
    
    if (!choferes || choferes.length === 0) {
        listaChoferes.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-people display-4 text-muted mb-3"></i>
                <p class="text-muted">No hay choferes registrados</p>
                ${ChoferesState.searchTerm ? '<p class="small">Intente con otros términos de búsqueda</p>' : ''}
                <button class="btn btn-outline-primary btn-sm mt-2" onclick="loadChoferesData()">
                    <i class="bi bi-arrow-clockwise me-1"></i> Recargar
                </button>
            </div>
        `;
        return;
    }

    listaChoferes.innerHTML = choferes.map(chofer => `
        <div class="chofer-item fade-in">
            <div class="row align-items-center">
                <div class="col-md-2">
                    <strong class="chofer-cedula">${chofer.cedula}</strong>
                </div>
                <div class="col-md-3">
                    <i class="bi bi-person me-1"></i>
                    ${chofer.nombre}
                </div>
                <div class="col-md-3">
                    <i class="bi bi-building me-1"></i>
                    ${chofer.organizacion}
                </div>
                <div class="col-md-3">
                    <i class="bi bi-diagram-3 me-1"></i>
                    ${chofer.gerencia}
                </div>
                <div class="col-md-1">
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarChofer('${chofer.cedula}')" 
                            ${!ChoferesState.isOnline ? 'disabled title="No disponible en modo offline"' : ''}>
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function eliminarChofer(cedula) {
    if (!confirm('¿Está seguro de que desea eliminar este chofer?')) {
        return;
    }
    
    try {
        if (ChoferesState.isOnline) {
            // Eliminar del servidor
            const response = await fetch(`${CONFIG_CHOFERES.WEB_APP_URL}?action=deleteDriver&cedula=${cedula}`);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.result !== 'success') {
                throw new Error(result.error || 'Error desconocido al eliminar chofer');
            }
        }
        
        // Eliminar localmente
        ChoferesState.driverData = ChoferesState.driverData.filter(c => c.cedula !== cedula);
        
        // Actualizar localStorage
        try {
            localStorage.setItem('choferes_backup', JSON.stringify(ChoferesState.driverData));
        } catch (e) {
            console.warn('No se pudo actualizar localStorage:', e);
        }
        
        updateChoferesStats(ChoferesState.driverData);
        filterAndDisplayChoferes();
        showChoferSuccess('Chofer eliminado correctamente');
        
    } catch (error) {
        console.error('Error eliminando chofer:', error);
        showChoferError(`Error al eliminar chofer: ${error.message}`);
    }
}

// ===============================================================================================
// ESTADÍSTICAS DE CHOFERES
// ===============================================================================================
function updateChoferesStats(choferes) {
    const organizaciones = [...new Set(choferes.map(c => c.organizacion).filter(Boolean))];
    const gerencias = [...new Set(choferes.map(c => c.gerencia).filter(Boolean))];
    
    const totalChoferesEl = document.getElementById('total-choferes');
    const totalOrganizacionesEl = document.getElementById('total-organizaciones');
    const totalGerenciasEl = document.getElementById('total-gerencias');
    
    if (totalChoferesEl) totalChoferesEl.textContent = choferes.length;
    if (totalOrganizacionesEl) totalOrganizacionesEl.textContent = organizaciones.length;
    if (totalGerenciasEl) totalGerenciasEl.textContent = gerencias.length;
    
    // Mostrar u ocultar el indicador de modo offline
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
        if (ChoferesState.isOnline) {
            offlineIndicator.style.display = 'none';
        } else {
            offlineIndicator.style.display = 'block';
        }
    }
}

// ===============================================================================================
// UTILIDADES CHOFERES
// ===============================================================================================
function debounceChofer(func, wait) {
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

function showChoferLoading(show, message = 'Procesando...') {
    const loadingDiv = document.getElementById('loading-chofer');
    if (!loadingDiv) return;
    
    if (show) {
        loadingDiv.style.display = 'block';
        const messageEl = loadingDiv.querySelector('p');
        if (messageEl) messageEl.textContent = message;
    } else {
        loadingDiv.style.display = 'none';
    }
}

function showChoferSuccess(message) {
    const successDiv = document.getElementById('success-chofer');
    if (!successDiv) return;
    
    const messageElement = successDiv.querySelector('.message');
    if (messageElement) messageElement.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showChoferError(message) {
    const errorDiv = document.getElementById('error-chofer');
    if (!errorDiv) return;
    
    const messageElement = errorDiv.querySelector('.message');
    if (messageElement) messageElement.textContent = message;
    errorDiv.style.display = 'block';
}

function hideChoferMessages() {
    const successDiv = document.getElementById('success-chofer');
    const errorDiv = document.getElementById('error-chofer');
    
    if (successDiv) successDiv.style.display = 'none';
    if (errorDiv) errorDiv.style.display = 'none';
}

function showFieldErrorChofer(input) {
    if (!input) return;
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
}

function showFieldSuccessChofer(input) {
    if (!input) return;
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
}

function showChoferAppStatus(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    
    // Puedes agregar aquí un sistema de notificaciones visual
    const statusElement = document.getElementById('app-status-choferes');
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
// SINCRONIZACIÓN Y RESPALDO
// ===============================================================================================
// Cargar datos de respaldo desde localStorage al iniciar
function loadBackupData() {
    try {
        const backup = localStorage.getItem('choferes_backup');
        if (backup) {
            const data = JSON.parse(backup);
            if (Array.isArray(data)) {
                ChoferesState.driverData = data;
                updateChoferesStats(data);
                displayChoferes(data);
                console.log('✅ Datos de respaldo cargados desde localStorage');
            }
        }
    } catch (e) {
        console.warn('Error cargando datos de respaldo:', e);
    }
}

// Intentar sincronizar datos pendientes cuando se recupere la conexión
async function syncPendingData() {
    if (!ChoferesState.isOnline) return;
    
    try {
        // Aquí podrías implementar la sincronización de datos pendientes
        // Por ejemplo, choferes guardados localmente que no se enviaron al servidor
        console.log('🔄 Sincronizando datos pendientes...');
    } catch (error) {
        console.error('Error en sincronización:', error);
    }
}

// ===============================================================================================
// FUNCIONES GLOBALES
// ===============================================================================================
// Hacer funciones disponibles globalmente
window.loadChoferesData = loadChoferesData;
window.clearChoferForm = clearChoferForm;
window.eliminarChofer = eliminarChofer;

// ===============================================================================================
// MANEJO DE ERRORES GLOBALES
// ===============================================================================================
window.addEventListener('error', (event) => {
    console.error('Error global en choferes:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Promise rechazada no manejada en choferes:', event.reason);
    showChoferError('Error inesperado en la aplicación');
});

// Detectar cambios en la conexión
window.addEventListener('online', () => {
    console.log('🌐 Conexión restaurada');
    ChoferesState.isOnline = true;
    showChoferAppStatus('Conexión restaurada - Modo online', 'success');
    syncPendingData();
});

window.addEventListener('offline', () => {
    console.log('📴 Sin conexión');
    ChoferesState.isOnline = false;
    showChoferAppStatus('Sin conexión - Modo offline', 'warning');
});

console.log('✅ choferes.js cargado correctamente');

// Cargar datos de respaldo al inicio
loadBackupData();
