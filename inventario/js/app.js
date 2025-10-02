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
            
            console.log('✅ Inventario cargado:', this.inventoryData.length, 'registros');
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
            tbody.innerHTML = '<tr><td colspan="12"><div class="no-data">📭 No se encontraron equipos</div></td></tr>';
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
                    <button class="btn-delete" onclick="app.deleteItem(${index})">🗑️</button>
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

        document.getElementById('addNewBtn').addEventListener('click', () => {
            this.openAddModal();
        });

        // Modal
        document.querySelector('.close').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.querySelector('.close-add').addEventListener('click', () => {
            this.closeAddModal();
        });

        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            const editModal = document.getElementById('editModal');
            const addModal = document.getElementById('addModal');
            if (e.target === editModal) {
                this.closeEditModal();
            }
            if (e.target === addModal) {
                this.closeAddModal();
            }
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
        
        // NUEVOS CONTADORES
        const cpus = this.filteredData.filter(item => 
            item.DESCRIPCION && item.DESCRIPCION.toUpperCase().includes('CPU')
        ).length;
        
        const laptops = this.filteredData.filter(item => 
            item.DESCRIPCION && item.DESCRIPCION.toUpperCase().includes('LAPTOP')
        ).length;
        
        const usuariosUnicos = new Set(this.filteredData
            .filter(item => item['CUSTODIO RESPONSABLE'] && item['CUSTODIO RESPONSABLE'].trim() !== '')
            .map(item => item['CUSTODIO RESPONSABLE'])
        ).size;

        document.getElementById('totalEquipos').textContent = total;
        document.getElementById('operativos').textContent = operativos;
        document.getElementById('totalDeptos').textContent = departamentos;
        document.getElementById('totalCPUs').textContent = cpus;
        document.getElementById('totalLaptops').textContent = laptops;
        document.getElementById('totalUsuarios').textContent = usuariosUnicos;
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

    openAddModal() {
        const modal = document.getElementById('addModal');
        
        // Limpiar formulario
        document.getElementById('addDescripcion').value = '';
        document.getElementById('addMarca').value = '';
        document.getElementById('addModelo').value = '';
        document.getElementById('addSerial').value = '';
        document.getElementById('addEtiqueta').value = '';
        document.getElementById('addSector').value = '';
        document.getElementById('addStatus').value = 'OPERATIVO';
        document.getElementById('addResponsable').value = '';
        document.getElementById('addCedula').value = '';
        document.getElementById('addCargo').value = '';
        document.getElementById('addObservaciones').value = '';
        
        modal.style.display = 'block';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
    }

    closeAddModal() {
        document.getElementById('addModal').style.display = 'none';
    }

    saveChanges() {
        const index = document.getElementById('editRowIndex').value;
        if (index === '') return;
        
        // Obtener valores del formulario
        const updatedItem = {
            'DESCRIPCION': document.getElementById('editDescripcion').value,
            'MARCA': document.getElementById('editMarca').value,
            'MODELO': document.getElementById('editModelo').value,
            'SERIAL': document.getElementById('editSerial').value,
            'ETIQUETA': document.getElementById('editEtiqueta').value,
            'SECTOR': document.getElementById('editSector').value,
            'STATUS': document.getElementById('editStatus').value,
            'CUSTODIO RESPONSABLE': document.getElementById('editResponsable').value,
            'CEDULA': document.getElementById('editCedula').value,
            'CARGO': document.getElementById('editCargo').value,
            'OBSERVACIONES': document.getElementById('editObservaciones').value
        };
        
        // Actualizar en los datos
        this.filteredData[index] = { ...this.filteredData[index], ...updatedItem };
        this.inventoryData = [...this.filteredData];
        
        // Actualizar interfaz
        this.renderTable();
        this.updateStats();
        this.closeEditModal();
        
        // Mostrar confirmación
        this.showNotification('✅ Cambios guardados correctamente', 'success');
        
        console.log('📝 Item actualizado:', updatedItem);
    }

    addNewItem() {
        // Obtener valores del formulario
        const newItem = {
            'N°': this.inventoryData.length + 1,
            'DESCRIPCION': document.getElementById('addDescripcion').value,
            'MARCA': document.getElementById('addMarca').value,
            'MODELO': document.getElementById('addModelo').value,
            'SERIAL': document.getElementById('addSerial').value,
            'ETIQUETA': document.getElementById('addEtiqueta').value,
            'SECTOR': document.getElementById('addSector').value,
            'STATUS': document.getElementById('addStatus').value,
            'CUSTODIO RESPONSABLE': document.getElementById('addResponsable').value,
            'CEDULA': document.getElementById('addCedula').value,
            'CARGO': document.getElementById('addCargo').value,
            'OBSERVACIONES': document.getElementById('addObservaciones').value
        };
        
        // Validar campos requeridos
        if (!newItem.DESCRIPCION.trim()) {
            alert('❌ La descripción es obligatoria');
            return;
        }
        
        // Agregar a los datos
        this.inventoryData.push(newItem);
        this.filteredData = [...this.inventoryData];
        
        // Actualizar interfaz
        this.renderTable();
        this.updateStats();
        this.closeAddModal();
        
        // Mostrar confirmación
        this.showNotification('✅ Nuevo equipo agregado correctamente', 'success');
        
        console.log('➕ Nuevo item agregado:', newItem);
    }

    deleteItem(index) {
        if (!confirm('¿Estás seguro de que quieres eliminar este equipo?\n\nEsta acción no se puede deshacer.')) {
            return;
        }
        
        const deletedItem = this.filteredData[index];
        
        // Eliminar de los datos
        this.filteredData.splice(index, 1);
        this.inventoryData = this.inventoryData.filter(item => 
            item !== deletedItem
        );
        
        // Actualizar interfaz
        this.renderTable();
        this.updateStats();
        
        // Mostrar confirmación
        this.showNotification('🗑️ Equipo eliminado correctamente', 'warning');
        
        console.log('🗑️ Item eliminado:', deletedItem);
    }

    viewDetails(index) {
        const item = this.filteredData[index];
        const detalles = `
🔍 **DETALLES DEL EQUIPO**

📋 **Descripción:** ${item.DESCRIPCION || 'N/A'}
🏷️ **Marca:** ${item.MARCA || 'N/A'}
🔧 **Modelo:** ${item.MODELO || 'N/A'}
🔢 **Serial:** ${item.SERIAL || 'N/A'}
🏷️ **Etiqueta:** ${item.ETIQUETA || 'N/A'}

🏢 **Sector:** ${item.SECTOR || 'N/A'}
📊 **Status:** ${item.STATUS || 'N/A'}

👤 **Responsable:** ${item['CUSTODIO RESPONSABLE'] || 'N/A'}
🆔 **Cédula:** ${item.CEDULA || 'N/A'}
💼 **Cargo:** ${item.CARGO || 'N/A'}

📝 **Observaciones:** ${item.OBSERVACIONES || 'Ninguna'}
        `;
        
        alert(detalles);
    }

    showNotification(message, type = 'info') {
        // Crear notificación temporal
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#d4edda' : type === 'warning' ? '#fff3cd' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'warning' ? '#856404' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'warning' ? '#ffeaa7' : '#bee5eb'};
            border-radius: 5px;
            z-index: 10000;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Inicializar la aplicación cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    window.app = new InventoryApp();
});
