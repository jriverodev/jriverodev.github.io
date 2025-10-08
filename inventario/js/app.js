
class InventoryApp {
    constructor(api) {
        this.api = api;
        this.tableBody = document.getElementById('tableBody');
        this.inventoryData = [];
        this.filteredData = [];
        this.currentEditIndex = -1; // Se reemplazará por un ID único
        this.isInitialized = false;

        if (!this.tableBody) {
            console.error("CRITICAL: No se encontró el elemento 'tableBody'. La tabla no funcionará.");
            return;
        }
        this.init();
    }

    init() {
        console.log('🚀 Inicializando la aplicación de inventario...');
        this.setupEventListeners();
        this.loadInitialData();
        this.isInitialized = true;
        console.log('✅ Aplicación inicializada.');
    }

    async loadInitialData() {
        console.log('🔄 Cargando datos iniciales...');
        this.showLoadingMessage();

        const localData = this.loadFromLocalStorage();
        if (localData) {
            console.log(`💾 Datos cargados desde localStorage: ${localData.length} registros.`);
            this.inventoryData = localData;
            this.applyFilters(); // Renderiza y actualiza stats
        } else {
            console.log('No hay datos en localStorage, se intentará cargar desde la red.');
        }
        
        // Siempre intentar refrescar desde la red para obtener los últimos cambios
        await this.loadFromGoogleSheets();
    }

    async loadFromGoogleSheets() {
        console.log('📡 Intentando cargar datos desde Google Sheets...');
        try {
            const data = await this.api.loadData();
            // Asignar un ID único a cada fila para una manipulación más segura
            this.inventoryData = data.map((item, index) => ({ ...item, uniqueId: `row_${index}_${Date.now()}` }));
            this.saveToLocalStorage();
            this.applyFilters(); // Esto renderizará la tabla y actualizará los stats
            console.log(`✅ Datos de Google Sheets cargados y procesados: ${this.inventoryData.length} registros.`);
        } catch (error) {
            console.error('❌ Error fatal al cargar desde Google Sheets:', error);
            if (this.inventoryData.length === 0) {
                this.showErrorMessage('No se pudieron cargar los datos. Intente refrescar la página.');
            }
        }
    }

    setupEventListeners() {
        // Buscador
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        }

        // Filtros
        const deptoFilter = document.getElementById('deptoFilter');
        const statusFilter = document.getElementById('statusFilter');
        
        if (deptoFilter) deptoFilter.addEventListener('change', () => this.applyFilters());
        if (statusFilter) statusFilter.addEventListener('change', () => this.applyFilters());

        // Botones
        const addNewBtn = document.getElementById('addNewBtn');
        const exportBtn = document.getElementById('exportBtn');
        const clearLocalBtn = document.getElementById('clearLocalBtn');
        const refreshBtn = document.getElementById('refreshBtn');

        if (addNewBtn) addNewBtn.addEventListener('click', () => this.showAddModal());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());
        if (clearLocalBtn) clearLocalBtn.addEventListener('click', () => this.clearLocalData());
        if (refreshBtn) refreshBtn.addEventListener('click', () => this.refreshData());

        // Formularios modales
        const editForm = document.getElementById('editModalForm');
        const addForm = document.getElementById('addModalForm');

        if (editForm) editForm.addEventListener('submit', (e) => this.handleEditSubmit(e));
        if (addForm) addForm.addEventListener('submit', (e) => this.handleAddSubmit(e));
    }

    handleSearch(searchTerm) {
        if (!searchTerm) {
            this.filteredData = [...this.inventoryData];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredData = this.inventoryData.filter(item => 
                Object.values(item).some(value => 
                    value && value.toString().toLowerCase().includes(term)
                )
            );
        }
        this.renderTable();
        this.updateStats();
    }

    applyFilters() {
        const deptoFilter = document.getElementById('deptoFilter');
        const statusFilter = document.getElementById('statusFilter');
        
        const deptoValue = deptoFilter ? deptoFilter.value : '';
        const statusValue = statusFilter ? statusFilter.value : '';

        this.filteredData = this.inventoryData.filter(item => {
            const deptoMatch = !deptoValue || item.SECTOR === deptoValue;
            const statusMatch = !statusValue || item.STATUS === statusValue;
            return deptoMatch && statusMatch;
        });

        this.renderTable();
        this.updateStats();
    }

    renderTable() {
        // VERIFICACIÓN CRÍTICA - Esto evita el error
        if (!this.tableBody) {
            console.error('❌ tableBody no está disponible en renderTable');
            this.tableBody = document.getElementById('tableBody');
            if (!this.tableBody) return;
        }

        console.log(`🔄 Renderizando ${this.filteredData.length} registros...`);
        
        try {
            this.tableBody.innerHTML = '';

            if (this.filteredData.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = `
                    <td colspan="13">
                        <div class="no-data">📭 No se encontraron equipos</div>
                    </td>
                `;
                this.tableBody.appendChild(emptyRow);
                return;
            }

            this.filteredData.forEach((item, index) => {
                const row = this.createTableRow(item, index);
                this.tableBody.appendChild(row);
            });

            console.log('✅ Tabla renderizada correctamente');
        } catch (error) {
            console.error('❌ Error en renderTable:', error);
        }
    }

    createTableRow(item, index) {
        const row = document.createElement('tr');
        row.dataset.uniqueId = item.uniqueId; // Guardar ID único en el DOM

        // Usar textContent para prevenir XSS
        const createCell = (text) => {
            const cell = document.createElement('td');
            cell.textContent = text || '';
            return cell;
        };

        row.appendChild(createCell(index + 1));
        row.appendChild(createCell(item.DESCRIPCION));
        row.appendChild(createCell(item.MARCA));
        row.appendChild(createCell(item.MODELO));
        row.appendChild(createCell(item.SERIAL));
        row.appendChild(createCell(item.ETIQUETA));
        row.appendChild(createCell(item.SECTOR));

        // Celda de Status con formato
        const statusCell = document.createElement('td');
        const statusBadge = document.createElement('span');
        statusBadge.className = `status-badge ${item.STATUS === 'OPERATIVO' ? 'status-operativo' : 'status-inoperativo'}`;
        statusBadge.textContent = item.STATUS || 'OPERATIVO';
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(createCell(item.RESPONSABLE));
        row.appendChild(createCell(item.CEDULA));
        row.appendChild(createCell(item.CARGO));
        row.appendChild(createCell(item.OBSERVACIONES));

        // Celda de Acciones
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <button class="btn-edit" onclick="app.showEditModal('${item.uniqueId}')">✏️</button>
            <button class="btn-delete" onclick="app.deleteItem('${item.uniqueId}')">🗑️</button>
        `;
        row.appendChild(actionsCell);

        return row;
    }

    updateStats() {
        const stats = {
            totalEquipos: this.filteredData.length,
            operativos: this.filteredData.filter(item => item.STATUS === 'OPERATIVO').length,
            totalDeptos: new Set(this.filteredData.map(item => item.SECTOR)).size,
            totalCPUs: this.filteredData.filter(item => item.DESCRIPCION?.toUpperCase().includes('CPU')).length,
            totalLaptops: this.filteredData.filter(item => item.DESCRIPCION?.toUpperCase().includes('LAPTOP')).length,
            totalUsuarios: new Set(this.filteredData.map(item => item.RESPONSABLE)).size,
            modificados: this.inventoryData.filter(item => item.modificado).length,
        };

        for (const [key, value] of Object.entries(stats)) {
            document.getElementById(key).textContent = value;
        }
    }

    showEditModal(uniqueId) {
        const item = this.inventoryData.find(d => d.uniqueId === uniqueId);
        if (!item) {
            console.error(`No se encontró el item con ID: ${uniqueId}`);
            alert('Error: No se pudo encontrar el equipo para editar.');
            return;
        }

        this.currentEditId = uniqueId;
        const realIndex = this.inventoryData.indexOf(item);

        document.getElementById('editRowNumber').textContent = `#${realIndex + 1}`;
        document.getElementById('editDescripcion').value = item.DESCRIPCION || '';
        document.getElementById('editMarca').value = item.MARCA || '';
        document.getElementById('editModelo').value = item.MODELO || '';
        document.getElementById('editSerial').value = item.SERIAL || '';
        document.getElementById('editEtiqueta').value = item.ETIQUETA || '';
        document.getElementById('editSector').value = item.SECTOR || '';
        document.getElementById('editStatus').value = item.STATUS || 'OPERATIVO';
        document.getElementById('editResponsable').value = item.RESPONSABLE || '';
        document.getElementById('editCedula').value = item.CEDULA || '';
        document.getElementById('editCargo').value = item.CARGO || '';
        document.getElementById('editObservaciones').value = item.OBSERVACIONES || '';

        document.getElementById('editModal').style.display = 'block';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditId = null;
    }

    showAddModal() {
        document.getElementById('addModalForm').reset();
        document.getElementById('addModal').style.display = 'block';
    }

    closeAddModal() {
        document.getElementById('addModal').style.display = 'none';
    }

    async handleEditSubmit(e) {
        e.preventDefault();
        if (!this.currentEditId) return;

        const index = this.inventoryData.findIndex(d => d.uniqueId === this.currentEditId);
        if (index === -1) {
            alert('Error: No se pudo guardar el equipo. Intente de nuevo.');
            return;
        }

        const originalItem = this.inventoryData[index];
        const updates = {
            DESCRIPCION: document.getElementById('editDescripcion').value,
            MARCA: document.getElementById('editMarca').value,
            MODELO: document.getElementById('editModelo').value,
            SERIAL: document.getElementById('editSerial').value,
            ETIQUETA: document.getElementById('editEtiqueta').value,
            SECTOR: document.getElementById('editSector').value,
            STATUS: document.getElementById('editStatus').value,
            RESPONSABLE: document.getElementById('editResponsable').value,
            CEDULA: document.getElementById('editCedula').value,
            CARGO: document.getElementById('editCargo').value,
            OBSERVACIONES: document.getElementById('editObservaciones').value,
        };

        // Optimistic UI update
        this.inventoryData[index] = { ...originalItem, ...updates, modificado: true };
        this.saveToLocalStorage();
        this.applyFilters();
        this.closeEditModal();
        
        const result = await this.api.updateInventoryItem(originalItem['N°'], updates);
        if (result.success) {
            alert('✅ Equipo actualizado correctamente en el sistema.');
        } else {
            alert(`❌ Error guardando en Google Sheets: ${result.error}. Los datos locales están guardados.`);
            // Opcional: revertir el cambio si falla la API
            this.inventoryData[index] = originalItem;
            this.saveToLocalStorage();
            this.applyFilters();
        }
    }

    async handleAddSubmit(e) {
        e.preventDefault();
        const newItem = {
            'N°': this.inventoryData.length + 1, // Asignación temporal
            DESCRIPCION: document.getElementById('addDescripcion').value,
            MARCA: document.getElementById('addMarca').value,
            MODELO: document.getElementById('addModelo').value,
            SERIAL: document.getElementById('addSerial').value,
            ETIQUETA: document.getElementById('addEtiqueta').value,
            SECTOR: document.getElementById('addSector').value,
            STATUS: document.getElementById('addStatus').value,
            RESPONSABLE: document.getElementById('addResponsable').value,
            CEDULA: document.getElementById('addCedula').value,
            CARGO: document.getElementById('addCargo').value,
            OBSERVACIONES: document.getElementById('addObservaciones').value,
            uniqueId: `new_${Date.now()}`
        };

        this.inventoryData.push(newItem);
        this.saveToLocalStorage();
        this.applyFilters();
        this.closeAddModal();

        const result = await this.api.addInventoryItem(newItem);
        if (result.success) {
            alert('✅ Nuevo equipo agregado correctamente.');
            // Opcional: refrescar datos para obtener el 'N°' real
            this.loadFromGoogleSheets();
        } else {
             alert(`❌ Error guardando en Google Sheets: ${result.error}. El dato se guardó localmente.`);
        }
    }

    async deleteItem(uniqueId) {
        const index = this.inventoryData.findIndex(d => d.uniqueId === uniqueId);
        if (index === -1 || !confirm('¿Estás seguro de que quieres eliminar este equipo?')) {
            return;
        }

        const itemToDelete = this.inventoryData[index];
        this.inventoryData.splice(index, 1);
        this.saveToLocalStorage();
        this.applyFilters();

        const result = await this.api.deleteInventoryItem(itemToDelete['N°']);
        if (result.success) {
            alert('✅ Equipo eliminado correctamente.');
        } else {
            alert(`❌ Error eliminando en Google Sheets: ${result.error}. Se eliminó localmente.`);
            // Opcional: Re-agregar el item si la API falla
            this.inventoryData.splice(index, 0, itemToDelete);
            this.saveToLocalStorage();
            this.applyFilters();
        }
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem('inventoryData', JSON.stringify(this.inventoryData));
        } catch (e) {
            console.error("Error al guardar en localStorage:", e);
        }
    }

    loadFromLocalStorage() {
        try {
            const data = localStorage.getItem('inventoryData');
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error("Error al leer de localStorage:", e);
            return null;
        }
    }

    clearLocalData() {
        if (confirm('¿Seguro que quieres limpiar los datos locales? Esto no se puede deshacer.')) {
            localStorage.removeItem('inventoryData');
            this.inventoryData = [];
            this.filteredData = [];
            this.applyFilters();
            alert('🧹 Datos locales limpiados.');
            this.loadFromGoogleSheets(); // Intentar recargar desde la fuente oficial
        }
    }

    refreshData() {
        console.log('🔄 Forzando actualización de datos desde Google Sheets...');
        this.loadFromGoogleSheets();
    }

    exportToExcel() {
        if (this.filteredData.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }
        try {
            // Remover 'uniqueId' antes de exportar
            const dataToExport = this.filteredData.map(({ uniqueId, ...rest }) => rest);
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario");
            XLSX.writeFile(wb, `inventario_equipos_${new Date().toISOString().slice(0,10)}.xlsx`);
        } catch (error) {
            console.error('❌ Error exportando a Excel:', error);
            alert('Ocurrió un error al intentar exportar a Excel.');
        }
    }

    showLoadingMessage() {
        this.tableBody.innerHTML = '<tr><td colspan="13"><div class="loading">🔄 Cargando inventario...</div></td></tr>';
    }

    showErrorMessage(message) {
        this.tableBody.innerHTML = `<tr><td colspan="13"><div class="no-data">❌ ${message}</div></td></tr>`;
    }
}

// --- Punto de Entrada de la Aplicación ---
document.addEventListener('DOMContentLoaded', () => {
    const api = new GoogleSheetsAPI();
    window.app = new InventoryApp(api);
});
