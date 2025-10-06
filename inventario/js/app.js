class InventoryApp {
    constructor() {
        // Definir todas las propiedades primero
        this.tableBody = null;
        this.inventoryData = [];
        this.filteredData = [];
        this.currentEditIndex = -1;
        this.isInitialized = false;
        
        // Inicializar la aplicación
        this.init();
    }

    init() {
        console.log('🔄 Inicializando aplicación...');
        
        // Obtener referencia al elemento tableBody
        this.tableBody = document.getElementById('tableBody');
        
        // Verificar si se encontró el elemento
        if (!this.tableBody) {
            console.error('❌ ERROR: No se pudo encontrar el elemento con ID "tableBody"');
            console.log('🔍 Elementos disponibles:');
            console.log(document.querySelectorAll('tbody'));
            return;
        }
        
        console.log('✅ tableBody encontrado correctamente');
        
        // Cargar datos y configurar la aplicación
        this.loadData();
        this.setupEventListeners();
        this.isInitialized = true;
        console.log('✅ Aplicación inicializada correctamente');
    }

    loadData() {
        console.log('🔄 Cargando inventario...');
        
        // Intentar cargar desde localStorage primero
        const localData = localStorage.getItem('inventoryData');
        if (localData) {
            this.inventoryData = JSON.parse(localData);
            console.log(`💾 Datos cargados desde localStorage: ${this.inventoryData.length} registros`);
            this.filteredData = [...this.inventoryData];
            this.renderTable();
            this.updateStats();
        }
        
        // Luego cargar desde Google Sheets (si está configurado)
        this.loadFromGoogleSheets();
    }

    async loadFromGoogleSheets() {
        try {
            console.log('📡 Cargando datos desde Google Sheets...');
            
            // Aquí iría tu lógica para cargar desde Google Sheets
            // Por ahora, simulamos una carga exitosa
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Si hay datos de Google Sheets, actualizamos
            if (typeof googleSheetsData !== 'undefined' && googleSheetsData.length > 0) {
                this.inventoryData = googleSheetsData;
                this.filteredData = [...this.inventoryData];
                this.saveToLocalStorage();
                this.renderTable();
                this.updateStats();
                console.log(`✅ Datos reales cargados: ${this.inventoryData.length} registros`);
            }
        } catch (error) {
            console.error('❌ Error cargando desde Google Sheets:', error);
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
        
        // Encontrar el índice real en inventoryData
        const realIndex = this.inventoryData.findIndex(invItem => 
            invItem.SERIAL === item.SERIAL && invItem.ETIQUETA === item.ETIQUETA
        );

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.DESCRIPCION || ''}</td>
            <td>${item.MARCA || ''}</td>
            <td>${item.MODELO || ''}</td>
            <td>${item.SERIAL || ''}</td>
            <td>${item.ETIQUETA || ''}</td>
            <td>${item.SECTOR || ''}</td>
            <td>
                <span class="status-badge ${item.STATUS === 'OPERATIVO' ? 'status-operativo' : 'status-inoperativo'}">
                    ${item.STATUS || 'OPERATIVO'}
                </span>
            </td>
            <td>${item.RESPONSABLE || ''}</td>
            <td>${item.CEDULA || ''}</td>
            <td>${item.CARGO || ''}</td>
            <td>${item.OBSERVACIONES || ''}</td>
            <td>
                <button class="btn-edit" onclick="app.showEditModal(${realIndex})">✏️</button>
                <button class="btn-delete" onclick="app.deleteItem(${realIndex})">🗑️</button>
            </td>
        `;
        
        return row;
    }

    updateStats() {
        const stats = {
            totalEquipos: this.filteredData.length,
            operativos: this.filteredData.filter(item => item.STATUS === 'OPERATIVO').length,
            totalDeptos: new Set(this.filteredData.map(item => item.SECTOR)).size,
            totalCPUs: this.filteredData.filter(item => 
                item.DESCRIPCION && item.DESCRIPCION.toUpperCase().includes('CPU')
            ).length,
            totalLaptops: this.filteredData.filter(item => 
                item.DESCRIPCION && item.DESCRIPCION.toUpperCase().includes('LAPTOP')
            ).length,
            totalUsuarios: new Set(this.filteredData.map(item => item.RESPONSABLE)).size,
            modificados: this.inventoryData.filter(item => item.modificado).length
        };

        // Actualizar elementos del DOM
        Object.keys(stats).forEach(stat => {
            const element = document.getElementById(stat);
            if (element) {
                element.textContent = stats[stat];
            }
        });
    }

    showEditModal(index) {
        if (index < 0 || index >= this.inventoryData.length) {
            console.error('❌ Índice inválido para editar:', index);
            return;
        }

        this.currentEditIndex = index;
        const item = this.inventoryData[index];

        // Llenar el formulario con los datos actuales
        document.getElementById('editRowNumber').textContent = `#${index + 1}`;
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

        // Mostrar el modal
        document.getElementById('editModal').style.display = 'block';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        this.currentEditIndex = -1;
    }

    showAddModal() {
        // Limpiar el formulario
        document.getElementById('addModalForm').reset();
        document.getElementById('addModal').style.display = 'block';
    }

    closeAddModal() {
        document.getElementById('addModal').style.display = 'none';
    }

    handleEditSubmit(e) {
        e.preventDefault();
        
        if (this.currentEditIndex === -1) return;

        const updatedItem = {
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
            modificado: true
        };

        // Actualizar el dato
        this.inventoryData[this.currentEditIndex] = updatedItem;
        this.saveToLocalStorage();
        
        // Actualizar la vista
        this.applyFilters();
        this.closeEditModal();
        
        alert('✅ Equipo actualizado correctamente');
    }

    handleAddSubmit(e) {
        e.preventDefault();

        const newItem = {
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
            modificado: true
        };

        // Agregar el nuevo equipo
        this.inventoryData.push(newItem);
        this.saveToLocalStorage();
        
        // Actualizar la vista
        this.applyFilters();
        this.closeAddModal();
        
        alert('✅ Equipo agregado correctamente');
    }

    deleteItem(index) {
        if (!confirm('¿Estás seguro de que quieres eliminar este equipo?')) {
            return;
        }

        if (index >= 0 && index < this.inventoryData.length) {
            this.inventoryData.splice(index, 1);
            this.saveToLocalStorage();
            this.applyFilters();
            alert('✅ Equipo eliminado correctamente');
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('inventoryData', JSON.stringify(this.inventoryData));
        console.log('💾 Datos guardados en localStorage');
    }

    clearLocalData() {
        if (confirm('¿Estás seguro de que quieres limpiar todos los datos locales?')) {
            localStorage.removeItem('inventoryData');
            this.inventoryData = [];
            this.filteredData = [];
            this.renderTable();
            this.updateStats();
            alert('🧹 Datos locales limpiados');
        }
    }

    refreshData() {
        console.log('🔄 Actualizando datos...');
        this.loadFromGoogleSheets();
    }

    exportToExcel() {
        try {
            const ws = XLSX.utils.json_to_sheet(this.filteredData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Inventario");
            XLSX.writeFile(wb, "inventario_equipos.xlsx");
            console.log('📊 Excel exportado correctamente');
        } catch (error) {
            console.error('❌ Error exportando a Excel:', error);
            alert('Error al exportar a Excel');
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    window.app = new InventoryApp();
});

// También manejar el caso de que el DOM ya esté cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.app = new InventoryApp();
    });
} else {
    window.app = new InventoryApp();
}
