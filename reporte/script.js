// ===============================================================================================
// PASO FINAL: Pega aquí la URL de tu Web App de Google Apps Script
// ===============================================================================================
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxC2GMVUYiag-R3pIljThXgeuKc2yVSVqyfb9qyyrpK4kU7LqZzJRq9HihMYJU3DP0/exec';
// ===============================================================================================

// DATOS DE EJEMPLO (reemplazables por la carga desde el CSV publicado)
const personalData = [
    { cedula: '12345678', nombre: 'Juan Perez', organizacion: 'Contratista', gerencia: 'Transporte' },
    { cedula: '87654321', nombre: 'Maria Rodriguez', organizacion: 'PDVSA', gerencia: 'Producción' },
    { cedula: '11223344', nombre: 'Carlos Gomez', organizacion: 'Contratista', gerencia: 'Mantenimiento' },
    { cedula: '44332211', nombre: 'Ana Fernandez', organizacion: 'PDVSA', gerencia: 'Transporte' }
];

document.addEventListener('DOMContentLoaded', () => {
    const cedulaInput = document.getElementById('cedula');
    const nombreInput = document.getElementById('nombre');
    const organizacionSelect = document.getElementById('organizacion');
    const gerenciaSelect = document.getElementById('gerencia');
    const reportForm = document.getElementById('report-form');
    const reportsList = document.getElementById('reports-list');
	const loadingDiv = document.getElementById('loading');
    const successMessageDiv = document.getElementById('success-message');
    const errorMessageDiv = document.getElementById('error-message');

    // --- 1. Llenar los desplegables con datos únicos ---
    function populateDropdowns() {
        const organizaciones = [...new Set(personalData.map(item => item.organizacion))];
        const gerencias = [...new Set(personalData.map(item => item.gerencia))];

        organizaciones.forEach(org => {
            const option = document.createElement('option');
            option.value = org;
            option.textContent = org;
            organizacionSelect.appendChild(option);
        });

        gerencias.forEach(ger => {
            const option = document.createElement('option');
            option.value = ger;
            option.textContent = ger;
            gerenciaSelect.appendChild(option);
        });
    }

    // --- 2. Buscar chofer por cédula ---
    function findDriver() {
        const cedula = cedulaInput.value.trim();
        const driver = personalData.find(d => d.cedula === cedula);

        if (driver) {
            nombreInput.value = driver.nombre;
            organizacionSelect.value = driver.organizacion;
            gerenciaSelect.value = driver.gerencia;
        } else {
            nombreInput.value = 'No encontrado. Verifique la cédula.';
        }
    }

    // --- 3. Enviar el formulario ---
    async function submitReport(e) {
        e.preventDefault();

        showLoading(true);
		hideMessages();

        const formData = {
            timestamp: new Date().toLocaleString('es-VE'),
            cedula: cedulaInput.value,
            nombre: nombreInput.value,
            organizacion: organizacionSelect.value,
            gerencia: gerenciaSelect.value,
            placa: document.getElementById('placa').value,
            estado: document.querySelector('input[name="estado"]:checked').value,
            observaciones: document.getElementById('observaciones').value,
        };

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                mode: 'no-cors', // Es importante para el tipo de respuesta de Apps Script
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

			// Con modo 'no-cors', no podemos leer la respuesta, pero si no hay error de red, asumimos éxito.
            showSuccess('¡Reporte enviado con éxito!');
            reportForm.reset();
            nombreInput.value = '';
			await loadReports();

        } catch (error) {
            console.error('Error al enviar el reporte:', error);
            showError('Hubo un error al enviar el reporte. Revise la consola.');
        } finally {
			showLoading(false);
		}
    }

    // --- 4. Cargar y mostrar los reportes ---
    async function loadReports() {
        reportsList.innerHTML = '<p class="text-center">Cargando reportes...</p>';

        if (WEB_APP_URL === 'https://script.google.com/macros/s/AKfycbxC2GMVUYiag-R3pIljThXgeuKc2yVSVqyfb9qyyrpK4kU7LqZzJRq9HihMYJU3DP0/exec') {
            reportsList.innerHTML = '<p class="text-center text-warning">La URL del script no está configurada. Mostrando datos de ejemplo.</p>';
            return;
        }

        try {
            // Se añade un parámetro 'action' para que el script sepa que queremos leer datos
            const response = await fetch(`${WEB_APP_URL}?action=read`);
            const data = await response.json();

            // Verificación para asegurar que la respuesta es un array
            if (!Array.isArray(data)) {
                console.error("La respuesta del script no es un array:", data);
                reportsList.innerHTML = '<p class="text-center text-danger">Error: La respuesta del servidor no tiene el formato esperado.</p>';
                return;
            }

            reportsList.innerHTML = ''; // Limpiar la lista

            if(data.length === 0){
                reportsList.innerHTML = '<p class="text-center">No hay reportes para mostrar.</p>';
                return;
            }

            data.reverse().forEach(report => {
                const reportDiv = document.createElement('div');
                reportDiv.className = 'report-item';

                const statusClass = report.estado === 'Operativa' ? 'status-operativa' : 'status-inoperativa';

                reportDiv.innerHTML = `
                    <div class="d-flex justify-content-between">
                        <span class="report-item-header">${report.placa} - ${report.nombre}</span>
                        <span class="${statusClass}">${report.estado}</span>
                    </div>
                    <div><strong>Gerencia:</strong> ${report.gerencia}</div>
                    <div><small class="text-muted">${report.timestamp}</small></div>
                    ${report.observaciones ? `<p class="mt-2 mb-0"><strong>Obs:</strong> ${report.observaciones}</p>` : ''}
                `;
                reportsList.appendChild(reportDiv);
            });

        } catch (error) {
            console.error('Error al cargar los reportes:', error);
            reportsList.innerHTML = '<p class="text-center text-danger">Error al cargar los reportes.</p>';
        }
    }

	// --- Funciones de UI ---
    function showLoading(isLoading) {
        loadingDiv.style.display = isLoading ? 'block' : 'none';
    }

    function showSuccess(message) {
        successMessageDiv.textContent = message;
        successMessageDiv.style.display = 'block';
    }

    function showError(message) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block';
    }

	function hideMessages() {
		successMessageDiv.style.display = 'none';
		errorMessageDiv.style.display = 'none';
	}


    // --- Event Listeners ---
    cedulaInput.addEventListener('change', findDriver);
    reportForm.addEventListener('submit', submitReport);

    // --- Carga inicial ---
    populateDropdowns();
    loadReports();
});
