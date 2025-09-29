// ===============================================================================================
// CONFIGURACIÓN PRINCIPAL - CHOFERES
// ===============================================================================================
const CONFIG = {
    WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbxC2GMVUYiag-R3pIljThXgeuKc2yVSVqyfb9qyyrpK4kU7LqZzJRq9HihMYJU3DP0/exec'
};

// Estado global de la aplicación
const ChoferesState = {
    driverData: [],
    searchTerm: '',
    isLoading: false
};

// ===============================================================================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ===============================================================================================
document.addEventListener('DOMContentLoaded', () => {
    initializeChoferesApp();
});

async function initializeChoferesApp() {
    try {
        // Cargar datos de choferes
        await loadChoferesData();
        
        // Inicializar componentes
        initializeChoferesEventListeners();
        
        console.log('✅ Aplicación de choferes inicializada correctamente');
        
    } catch (error) {
        console.error('❌ Error inicializando la aplicación de choferes:', error);
        showChoferError('Error al inicializar la aplicación');
    }
}

// ===============================================================================================
// CARGA DE DATOS DE CHOFERES
// ===============================================================================================
async function loadChoferesData() {
    try {
        showChoferLoading(true, 'Cargando choferes...');
        
        const response = await fetch(`${CONFIG.WEB_APP_URL}?action=drivers`);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        ChoferesState.driverData = data;
        
        updateChoferesStats(data);
        displayChoferes(data);
        
        console.log(`✅ ${data.length} choferes cargados correctamente`);
        
    } catch (error) {
        console.error('❌ Error cargando datos de choferes:', error);
        showChoferError('Error al cargar los datos de choferes');
        ChoferesState.driverData = [];
    } finally {
        showChoferLoading(false);
    }
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
    choferForm.addEventListener('submit', submitChofer);
    limpiarBtn.addEventListener('click', clearChoferForm);
    actualizarBtn.addEventListener('click', () => {
        actualizarBtn.classList.add('pulse');
        loadChoferesData().finally(() => {
            setTimeout(() => actualizarBtn.classList.remove('pulse'), 1000);
        });
    });

    buscarInput.addEventListener('input', (e) => {
        ChoferesState.searchTerm = e.target.value.trim();
        filterAndDisplayChoferes();
    });
}

// ===============================================================================================
// GESTIÓN DE CHOFERES
// ===============================================================================================
async function submitChofer(e) {
    e.preventDefault();
    
    if (ChoferesState.isLoading) return;
    
    const guardarBtn = document.getElementById('guardar-chofer');
    const originalText = guardarBtn.innerHTML;
    
    try {
        ChoferesState.isLoading = true;
        showChoferLoading(true, 'Guardando chofer...');
        hideChoferMessages();
        
        guardarBtn.disabled = true;
        guardarBtn.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Guardando...';
        
        const formData = {
            cedula: document.getElementById('nueva-cedula').value.trim(),
            nombre: document.getElementById('nuevo-nombre').value.trim(),
            organizacion: document.getElementById('nueva-organizacion').value.trim(),
            gerencia: document.getElementById('nueva-gerencia').value.trim()
        };

        // Validación
        if (!validateChoferData(formData)) {
            throw new Error('Por favor complete todos los campos correctamente');
        }

        // Verificar si la cédula ya existe
        const choferExistente = ChoferesState.driverData.find(c => c.cedula === formData.cedula);
        if (choferExistente) {
            throw new Error('Ya existe un chofer registrado con esta cédula');
        }

        // En una implementación real, aquí enviarías los datos al servidor
        // Por ahora, simulamos la adición local
        const nuevoChofer = { ...formData };
        ChoferesState.driverData.push(nuevoChofer);
        
        showChoferSuccess('¡Chofer registrado exitosamente!');
        clearChoferForm();
        updateChoferesStats(ChoferesState.driverData);
        displayChoferes(ChoferesState.driverData);

    } catch (error) {
        console.error('Error al guardar chofer:', error);
        showChoferError(`Error al guardar chofer: ${error.message}`);
    } finally {
        ChoferesState.isLoading = false;
        showChoferLoading(false);
        guardarBtn.disabled = false;
        guardarBtn.innerHTML = originalText;
    }
}

function validateChoferData(data) {
    if (!data.cedula || data.cedula.length < 6) {
        showFieldError(document.getElementById('nueva-cedula'));
        return false;
    }
    
    if (!data.nombre || data.nombre.length < 3) {
        showFieldError(document.getElementById('nuevo-nombre'));
        return false;
    }
    
    if (!data.organizacion) {
        showFieldError(document.getElementById('nueva-organizacion'));
        return false;
    }
    
    if (!data.gerencia) {
        showFieldError(document.getElementById('nueva-gerencia'));
        return false;
    }
    
    return true;
}

function clearChoferForm() {
    document.getElementById('chofer-form').reset();
    hideChoferMessages();
    
    // Limpiar estados de validación
    const inputs = document.querySelectorAll('.is-valid, .is-invalid');
    inputs.forEach(input => {
        input.classList.remove('is-valid', 'is-invalid');
    });
}

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
    
    if (!choferes || choferes.length === 0) {
        listaChoferes.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-people display-4 text-muted mb-3"></i>
                <p class="text-muted">No hay choferes registrados</p>
                ${ChoferesState.searchTerm ? '<p class="small">Intente con otros términos de búsqueda</p>' : ''}
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
                    <button class="btn btn-outline-danger btn-sm" onclick="eliminarChofer('${chofer.cedula}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function eliminarChofer(cedula) {
    if (confirm('¿Está seguro de que desea eliminar este chofer?')) {
        ChoferesState.driverData = ChoferesState.driverData.filter(c => c.cedula !== cedula);
        updateChoferesStats(ChoferesState.driverData);
        displayChoferes(ChoferesState.driverData);
        showChoferSuccess('Chofer eliminado correctamente');
    }
}

function updateChoferesStats(choferes) {
    const organizaciones = [...new Set(choferes.map(c => c.organizacion))];
    const gerencias = [...new Set(choferes.map(c => c.gerencia))];
    
    document.getElementById('total-choferes').textContent = choferes.length;
    document.getElementById('total-organizaciones').textContent = organizaciones.length;
    document.getElementById('total-gerencias').textContent = gerencias.length;
}

// ===============================================================================================
// UTILIDADES CHOFERES
// ===============================================================================================
function showChoferLoading(show, message = 'Procesando...') {
    const loadingDiv = document.getElementById('loading-chofer');
    if (show) {
        loadingDiv.style.display = 'block';
        loadingDiv.querySelector('p').textContent = message;
    } else {
        loadingDiv.style.display = 'none';
    }
}

function showChoferSuccess(message) {
    const successDiv = document.getElementById('success-chofer');
    const messageElement = successDiv.querySelector('.message');
    
    messageElement.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showChoferError(message) {
    const errorDiv = document.getElementById('error-chofer');
    const messageElement = errorDiv.querySelector('.message');
    
    messageElement.textContent = message;
    errorDiv.style.display = 'block';
}

function hideChoferMessages() {
    document.getElementById('success-chofer').style.display = 'none';
    document.getElementById('error-chofer').style.display = 'none';
}

function showFieldError(input) {
    input.classList.remove('is-valid');
    input.classList.add('is-invalid');
}
