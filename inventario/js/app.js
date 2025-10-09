/**
 * SISTEMA DE INVENTARIO - Lógica Principal de la Aplicación
 *
 * Se encarga de:
 * - Gestionar los datos del inventario (carga, filtrado, guardado).
 * - Renderizar la tabla y las estadísticas.
 * - Manejar los eventos de la interfaz de usuario (botones, modales, formularios).
 * - Comunicarse con la GoogleSheetsAPI para las operaciones de backend.
 */
class InventoryApp {
  constructor(api) {
    this.api = api; // Instancia de GoogleSheetsAPI
    this.inventoryData = []; // Todos los datos del inventario
    this.filteredData = []; // Datos filtrados que se muestran en la tabla
    this.currentEditItemId = null; // ID ('N°') del item que se está editando
    this.localStorageKey = 'inventoryData_v3'; // Clave para el caché local

    this.init();
  }

  /**
   * INICIALIZACIÓN - Configura la app y carga los datos iniciales.
   */
  async init() {
    console.log('🚀 Inicializando la aplicación...');
    this.setupEventListeners();
    await this.loadInitialData();
    console.log('✅ Aplicación inicializada.');
  }

  // --- MÉTODOS DE CARGA Y MANEJO DE DATOS ---

  async loadInitialData() {
    this.showLoadingMessage('🔄 Cargando datos...');
    const localData = this.loadFromLocalStorage();
    if (localData && localData.length > 0) {
      console.log(`💾 Datos cargados desde caché local: ${localData.length} registros.`);
      this.inventoryData = localData;
      this.applyFiltersAndRender();
    }
    await this.refreshData();
  }

  async refreshData() {
    this.showLoadingMessage('📡 Actualizando desde Google Sheets...');
    try {
      const data = await this.api.loadData();
      this.inventoryData = data;
      this.saveToLocalStorage();
      this.applyFiltersAndRender();
      this.showNotification('✅ Inventario actualizado.', 'success');
    } catch (error) {
      console.error('❌ Error al refrescar los datos:', error);
      this.showNotification('❌ No se pudieron actualizar los datos desde Google Sheets.', 'error');
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.inventoryData));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(this.localStorageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error al leer de localStorage:', e);
      return null;
    }
  }

  clearLocalData() {
    if (confirm('¿Estás seguro de que quieres limpiar el caché local? Se recargarán los datos desde Google Sheets.')) {
      localStorage.removeItem(this.localStorageKey);
      this.inventoryData = [];
      this.filteredData = [];
      this.applyFiltersAndRender();
      this.showNotification('🧹 Caché local limpiado.', 'info');
      this.refreshData();
    }
  }

  // --- MÉTODOS DE MANEJO DE LA INTERFAZ (UI) ---

  applyFiltersAndRender() {
    const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const deptoFilter = document.getElementById('deptoFilter')?.value || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';

    this.filteredData = this.inventoryData.filter(item => {
      const searchMatch = !searchTerm || Object.values(item).some(val =>
        String(val).toLowerCase().includes(searchTerm)
      );
      const deptoMatch = !deptoFilter || item.SECTOR === deptoFilter;
      const statusMatch = !statusFilter || item.STATUS === statusFilter;
      return searchMatch && deptoMatch && statusMatch;
    });

    this.renderTable();
    this.updateStats();
  }

  renderTable() {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (this.filteredData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="13" class="no-results">No se encontraron equipos.</td></tr>';
      return;
    }

    this.filteredData.forEach(item => {
      const row = document.createElement('tr');
      const itemId = item['N°'];
      row.innerHTML = `
        <td>${itemId || ''}</td>
        <td>${item.DESCRIPCION || ''}</td>
        <td>${item.MARCA || ''}</td>
        <td>${item.MODELO || ''}</td>
        <td>${item.SERIAL || ''}</td>
        <td>${item.ETIQUETA || ''}</td>
        <td>${item.SECTOR || ''}</td>
        <td><span class="status ${item.STATUS === 'OPERATIVO' ? 'operativo' : 'inoperativo'}">${item.STATUS || 'N/A'}</span></td>
        <td>${item['CUSTODIO RESPONSABLE'] || ''}</td>
        <td>${item.CEDULA || ''}</td>
        <td>${item.CARGO || ''}</td>
        <td>${item.OBSERVACIONES || ''}</td>
        <td class="actions-cell">
          <button class="btn-action edit-btn" data-action="edit" data-id="${itemId}">✏️ Editar</button>
          <button class="btn-action delete-btn" data-action="delete" data-id="${itemId}">🗑️ Eliminar</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  updateStats() {
    const total = this.inventoryData.length;
    const operativo = this.inventoryData.filter(item => item.STATUS === 'OPERATIVO').length;
    const inoperativo = total - operativo;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('operativoCount').textContent = operativo;
    document.getElementById('inoperativoCount').textContent = inoperativo;
  }

  // --- MANEJO DE MODALES ---

  showAddModal() {
    document.getElementById('addModalForm').reset();
    document.getElementById('addModal').style.display = 'flex';
  }

  closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
  }

  showEditModal(itemId) {
    const item = this.inventoryData.find(d => String(d['N°']) === String(itemId));
    if (!item) {
      this.showNotification(`Error: No se encontró el equipo con ID: ${itemId}`, 'error');
      return;
    }
    this.currentEditItemId = itemId;
    document.getElementById('editRowNumber').textContent = item['N°'];
    const form = document.getElementById('editModalForm');
    form.querySelector('#editDESCRIPCION').value = item.DESCRIPCION || '';
    form.querySelector('#editMARCA').value = item.MARCA || '';
    form.querySelector('#editMODELO').value = item.MODELO || '';
    form.querySelector('#editSERIAL').value = item.SERIAL || '';
    form.querySelector('#editETIQUETA').value = item.ETIQUETA || '';
    form.querySelector('#editSECTOR').value = item.SECTOR || '';
    form.querySelector('#editSTATUS').value = item.STATUS || 'OPERATIVO';
    form.querySelector('#editCUSTODIORESPONSABLE').value = item['CUSTODIO RESPONSABLE'] || '';
    form.querySelector('#editCEDULA').value = item.CEDULA || '';
    form.querySelector('#editCARGO').value = item.CARGO || '';
    form.querySelector('#editOBSERVACIONES').value = item.OBSERVACIONES || '';
    document.getElementById('editModal').style.display = 'flex';
  }

  closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    this.currentEditItemId = null;
  }

  // --- MANEJO DE EVENTOS Y ACCIONES CRUD ---

  setupEventListeners() {
    // Event delegation for table actions
    document.getElementById('inventoryTableBody').addEventListener('click', (e) => {
        const button = e.target.closest('button.btn-action');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;
            if (action === 'edit') this.showEditModal(id);
            if (action === 'delete') this.handleDeleteItem(id);
        }
    });

    // Filtros
    document.getElementById('searchInput').addEventListener('input', () => this.applyFiltersAndRender());
    document.getElementById('deptoFilter').addEventListener('change', () => this.applyFiltersAndRender());
    document.getElementById('statusFilter').addEventListener('change', () => this.applyFiltersAndRender());

    // Botones principales
    document.getElementById('addNewBtn').addEventListener('click', () => this.showAddModal());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
    document.getElementById('clearLocalBtn').addEventListener('click', () => this.clearLocalData());
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (this.filteredData.length === 0) {
            this.showNotification('No hay datos para exportar.', 'warning');
            return;
        }
        const date = new Date().toISOString().split('T')[0];
        const filename = `inventario_equipos_${date}.xlsx`;
        exportToExcel(this.filteredData, filename);
        this.showNotification(`✅ Exportación completada: ${filename}`, 'success');
    });

    // Modal close/cancel buttons
    document.querySelectorAll('.modal .close, .modal .btn-cancel').forEach(el => {
        el.addEventListener('click', () => {
            const modal = el.closest('.modal');
            if (modal.id === 'addModal') {
                this.closeAddModal();
            } else if (modal.id === 'editModal') {
                this.closeEditModal();
            }
        });
    });

    // Formularios
    document.getElementById('addModalForm').addEventListener('submit', (e) => this.handleAddItem(e));
    document.getElementById('editModalForm').addEventListener('submit', (e) => this.handleEditItem(e));
  }

  async handleAddItem(e) {
    e.preventDefault();
    const form = e.target;
    const newItem = {
      DESCRIPCION: form.querySelector('#addDESCRIPCION').value,
      MARCA: form.querySelector('#addMARCA').value,
      MODELO: form.querySelector('#addMODELO').value,
      SERIAL: form.querySelector('#addSERIAL').value,
      ETIQUETA: form.querySelector('#addETIQUETA').value,
      SECTOR: form.querySelector('#addSECTOR').value,
      STATUS: form.querySelector('#addSTATUS').value,
      'CUSTODIO RESPONSABLE': form.querySelector('#addCUSTODIORESPONSABLE').value,
      CEDULA: form.querySelector('#addCEDULA').value,
      CARGO: form.querySelector('#addCARGO').value,
      OBSERVACIONES: form.querySelector('#addOBSERVACIONES').value,
    };

    if (!newItem.DESCRIPCION) {
      this.showNotification('La Descripción es un campo obligatorio.', 'error');
      return;
    }

    this.showLoadingMessage('⏳ Agregando equipo...', 'info');
    const result = await this.api.addInventoryItem(newItem);

    if (result.success) {
      this.showNotification('✅ Equipo agregado correctamente.', 'success');
      this.closeAddModal();
      await this.refreshData();
    } else {
      this.showNotification(`❌ Error al agregar: ${result.error}`, 'error');
    }
  }

  async handleEditItem(e) {
    e.preventDefault();
    if (!this.currentEditItemId) return;

    const form = e.target;
    const updates = {
      DESCRIPCION: form.querySelector('#editDESCRIPCION').value,
      MARCA: form.querySelector('#editMARCA').value,
      MODELO: form.querySelector('#editMODELO').value,
      SERIAL: form.querySelector('#editSERIAL').value,
      ETIQUETA: form.querySelector('#editETIQUETA').value,
      SECTOR: form.querySelector('#editSECTOR').value,
      STATUS: form.querySelector('#editSTATUS').value,
      'CUSTODIO RESPONSABLE': form.querySelector('#editCUSTODIORESPONSABLE').value,
      CEDULA: form.querySelector('#editCEDULA').value,
      CARGO: form.querySelector('#editCARGO').value,
      OBSERVACIONES: form.querySelector('#editOBSERVACIONES').value,
    };

    this.showLoadingMessage('⏳ Guardando cambios...', 'info');
    const result = await this.api.updateInventoryItem(this.currentEditItemId, updates);

    if (result.success) {
      this.showNotification('✅ Equipo actualizado correctamente.', 'success');
      const index = this.inventoryData.findIndex(item => String(item['N°']) === String(this.currentEditItemId));
      if (index !== -1) {
        this.inventoryData[index] = { ...this.inventoryData[index], ...updates };
        this.saveToLocalStorage();
        this.applyFiltersAndRender();
      }
      this.closeEditModal();
    } else {
      this.showNotification(`❌ Error al actualizar: ${result.error}`, 'error');
    }
  }

  async handleDeleteItem(itemId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el equipo N° ${itemId}? Esta acción es permanente.`)) {
      return;
    }

    this.showLoadingMessage('⏳ Eliminando equipo...', 'info');
    const result = await this.api.deleteInventoryItem(itemId);

    if (result.success) {
      this.showNotification('🗑️ Equipo eliminado permanentemente.', 'success');
      this.inventoryData = this.inventoryData.filter(item => String(item['N°']) !== String(itemId));
      this.saveToLocalStorage();
      this.applyFiltersAndRender();
    } else {
      this.showNotification(`❌ Error al eliminar: ${result.error}`, 'error');
    }
  }

  // --- MÉTODOS DE NOTIFICACIÓN ---

  showLoadingMessage(message = 'Cargando...') {
    this.showNotification(message, 'info', 2000);
  }

  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), duration);
  }
}

// --- PUNTO DE ENTRADA ---
document.addEventListener('DOMContentLoaded', () => {
  const api = new GoogleSheetsAPI();
  window.app = new InventoryApp(api);
});