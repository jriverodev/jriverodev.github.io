class InventoryApp {
    constructor() {
        this.sheetsAPI = new GoogleSheetsAPI();
        this.inventoryData = [];
        this.filteredData = [];
        this.init();
    }

    async init() {
        await this.loadInventory();
        this.setupEventListeners();
        this.renderTable();
        this.updateStats();
    }

    async loadInventory() {
    try {
        console.log('🔄 Iniciando carga de inventario...');
        document.getElementById('tableBody').innerHTML = '<tr><td colspan="12"><div class="loading">🔄 Cargando datos...</div></td></tr>';
        
        this.inventoryData = await this.sheetsAPI.loadData();
        this.filteredData = [...this.inventoryData];
        
        console.log('✅ Inventario cargado:', this.inventoryData);
        this.renderTable();
        this.updateStats();
        
    } catch (error) {
        console.error('❌ Error en loadInventory:', error);
        document.getElementById('tableBody').innerHTML = `
            <tr>
                <td colspan="12">
                    <div class="error-message">
                        ❌ Error cargando datos: ${error.message}
                        <br><small>Mostrando datos de ejemplo</small>
                    </div>
                </td>
            </tr>
        `;
        
        // Forzar datos de ejemplo
        this.inventoryData = this.sheetsAPI.getSampleData();
        this.filteredData = [...this.inventoryData];
        this.renderTable();
        this.updateStats();
    }
}

    renderTable() {
        const tbody = document.getElementById('tableBody');
        
        if (this.filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="12">No se encontraron equipos</td></tr>';
            return;
        }

        tbody.innerHTML = this.filteredData.map((item, index) => `
            <tr>
                <td>${item['N°'] || index + 1}</td>
                <td>${item.DESCRIPCION || ''}</td>
                <td>${item.MARCA || ''}</td>
                <td>${item.MODELO || ''}</td>
                <td>${item.SERIAL || ''}</td>
                <td>${item.ETIQUETA || ''}</td>
                <td>${item.SECTOR || ''}</td>
                <td><span class="status ${item.STATUS === 'OPERATIVO' ? 'operativo' : 'inoperativo'}">${item.STATUS || ''}</span></td>
                <td>${item['CUSTODIO RESPONSABLE'] || ''}</td>
                <td>${item.CEDULA || ''}</td>
                <td>${item.CARGO || ''}</td>
                <td>
                    <button class="btn-edit" onclick="app.openEditModal(${index})">✏️</button>
                    <button class="btn-view" onclick="app.viewDetails(${index})">👁️</button>
                </td>
            </tr>
        `).join('');
    }

    setupEventListeners() {
        // Búsqueda
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterData(e.target.value);
        });

        // Filtros
        document.getElementById('deptoFilter').addEventListener('change', (e) => {
            this.filterData();
        });

        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filterData();
        });

        // Botones
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadInventory();
        });

        // Modal
        document.querySelector('.close').addEventListener('click', () => {
            this.closeEditModal();
        });
    }

    filterData(searchTerm = '') {
        const deptoFilter = document.getElementById('deptoFilter').value;
        const statusFilter = document.getElementById('statusFilter').value;
        
        this.filteredData = this.inventoryData.filter(item => {
            const matchesSearch = !searchTerm || 
                Object.values(item).some(value => 
                    value.toString().toLowerCase().includes(searchTerm.toLowerCase())
                );
            
            const matchesDepto = !deptoFilter || item.SECTOR === deptoFilter;
            const matchesStatus = !statusFilter || item.STATUS === statusFilter;
            
            return matchesSearch && matchesDepto && matchesStatus;
        });
        
        this.renderTable();
        this.updateStats();
    }

    updateStats() {
        const total = this.filteredData.length;
        const operativos = this.filteredData.filter(item => item.STATUS === 'OPERATIVO').length;
        const departamentos = new Set(this.filteredData.map(item => item.SECTOR)).size;
        
        document.getElementById('totalEquipos').textContent = total;
        document.getElementById('operativos').textContent = operativos;
        document.getElementById('totalDeptos').textContent = departamentos;
    }

    openEditModal(index) {
        const item = this.filteredData[index];
        const modal = document.getElementById('editModal');
        
        // Llenar formulario con datos actuales
        document.getElementById('editRowIndex').value = index;
        document.getElementById('editDescripcion').value = item.DESCRIPCION || '';
        document.getElementById('editMarca').value = item.MARCA || '';
        document.getElementById('editModelo').value = item.MODELO || '';
        document.getElementById('editSerial').value = item.SERIAL || '';
        document.getElementById('editEtiqueta').value = item.ETIQUETA || '';
        document.getElementById('editSector').value = item.SECTOR || '';
        document.getElementById('editStatus').value = item.STATUS || 'OPERATIVO';
        document.getElementById('editResponsable').value = item['CUSTODIO RESPONSABLE'] || '';
        document.getElementById('editCedula').value = item.CEDULA || '';
        document.getElementById('editCargo').value = item.CARGO || '';
        document.getElementById('editObservaciones').value = item.OBSERVACIONES || '';
        
        modal.style.display = 'block';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }
}

// Inicializar la aplicación
const app = new InventoryApp();
