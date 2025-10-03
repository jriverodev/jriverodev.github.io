/**
 * SISTEMA DE INVENTARIO - VERSIÓN HÍBRIDA
 * Usa localStorage como caché y permite exportación manual
 */

class InventoryApp {
  constructor() {
    this.sheetsAPI = new GoogleSheetsAPI();
    this.inventoryData = [];
    this.filteredData = [];
    this.localStorageKey = 'inventoryData_v2';
    this.init();
  }

  /**
   * INICIALIZACIÓN - Carga datos desde Google Sheets o localStorage
   */
  async init() {
    await this.loadInventory();
    this.setupEventListeners();
    this.renderTable();
    this.updateStats();
    
    console.log('🚀 Sistema de Inventario iniciado');
    console.log('💾 Los cambios se guardan en localStorage');
    console.log('📤 Usa "Exportar Excel" para descargar datos actualizados');
  }

  /**
   * CARGAR INVENTARIO - Estrategia híbrida
   */
  async loadInventory() {
    try {
      console.log('🔄 Cargando inventario...');
      this.showLoadingMessage('🔄 Cargando datos...');
      
      // PRIMERO: Intentar cargar desde localStorage (más rápido)
      const localData = this.loadFromLocalStorage();
      if (localData && localData.length > 0) {
        console.log('💾 Datos cargados desde localStorage:', localData.length, 'registros');
        this.inventoryData = localData;
        this.filteredData = [...this.inventoryData];
      }
      
      // LUEGO: Cargar desde Google Sheets en segundo plano (para obtener lo más reciente)
      const sheetData = await this.sheetsAPI.loadData();
      
      // SI HAY DATOS DE GOOGLE SHEETS, SOBRESCRIBIR Y ACTUALIZAR LOCALSTORAGE
      if (sheetData && sheetData.length > 0) {
        // Combinar datos locales con datos de la hoja de cálculo
        this.inventoryData = sheetData;
        this.saveToLocalStorage();
      }
      
      this.filteredData = [...this.inventoryData];

    } catch (error) {
      console.error('❌ Error general al cargar inventario:', error);
      this.showNotification('Error al cargar datos. Usando caché local.', 'error');
    } finally {
      this.hideLoadingMessage();
    }
  }

  /**
   * LÓGICA DE LOCALSTORAGE
   */
  loadFromLocalStorage() {
    const data = localStorage.getItem(this.localStorageKey);
    return data ? JSON.parse(data) : [];
  }

  saveToLocalStorage() {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.inventoryData));
  }

  /**
   * RENDERIZADO Y ESTADÍSTICAS
   */
  renderTable() {
    const tableBody = document.getElementById('inventoryTableBody');
    tableBody.innerHTML = '';

    if (this.filteredData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="13" class="no-results">No se encontraron equipos que coincidan con los filtros o la búsqueda.</td></tr>';
      return;
    }

    this.filteredData.forEach((item, index) => {
      const row = tableBody.insertRow();
      const statusClass = item.STATUS === 'OPERATIVO' ? 'operativo' : 'inoperativo';
      const isModifiedClass = item.isModified ? 'row-modified' : '';

      row.className = isModifiedClass;

      row.innerHTML = `
        <td>${item['N°']}</td>
        <td>${item.DESCRIPCION}</td>
        <td>${item.MARCA}</td>
        <td>${item.MODELO}</td>
        <td>${item.SERIAL}</td>
        <td>${item.ETIQUETA}</td>
        <td>${item.SECTOR}</td>
        <td><span class="status ${statusClass}">${item.STATUS}</span></td>
        <td>${item['CUSTODIO RESPONSABLE']}</td>
        <td>${item.CEDULA}</td>
        <td>${item.CARGO}</td>
        <td>
            ${item.OBSERVACIONES || ''}
            ${item.isModified ? '<span class="modified-badge">Modificado</span>' : ''}
        </td>
        <td>
          <button class="btn-action edit-btn" onclick="app.openEditModal(${item['N°']})">✏️ Editar</button>
          <button class="btn-action delete-btn" onclick="app.deleteItem(${item['N°']})">🗑️ Eliminar</button>
        </td>
      `;
    });
  }

  updateStats() {
    const total = this.inventoryData.length;
    const operativos = this.inventoryData.filter(item => item.STATUS === 'OPERATIVO').length;
    const inoperativos = total - operativos;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('operativoCount').textContent = operativos;
    document.getElementById('inoperativoCount').textContent = inoperativos;
  }

  /**
   * LÓGICA DE BÚSQUEDA Y FILTRADO
   */
  applyFilters() {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const depto = document.getElementById('deptoFilter').value;
    const status = document.getElementById('statusFilter').value;

    this.filteredData = this.inventoryData.filter(item => {
      // Filtrar por Sector
      if (depto && item.SECTOR !== depto) return false;
      // Filtrar por Status
      if (status && item.STATUS !== status) return false;
      
      // Filtrar por Búsqueda (busca en varios campos clave)
      if (search) {
        const searchableFields = [
          item.DESCRIPCION, item.SERIAL, item.ETIQUETA, item['CUSTODIO RESPONSABLE'], item.CEDULA, item.CARGO, item.OBSERVACIONES
        ].map(val => (val || '').toLowerCase());
        
        return searchableFields.some(field => field.includes(search));
      }
      
      return true;
    });

    this.renderTable();
  }

  /**
   * MANEJO DE EVENTOS
   */
  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
    document.getElementById('deptoFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('statusFilter').addEventListener('change', () => this.applyFilters());
    document.getElementById('addNewBtn').addEventListener('click', () => this.openAddModal());
    document.getElementById('clearLocalBtn').addEventListener('click', () => this.clearLocalStorage());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
    
    // Event listener para el formulario de agregar (CORRECCIÓN CLAVE)
    document.getElementById('addModalForm').addEventListener('submit', (e) => this.addNewItem(e));
    
    // Event listener para el formulario de edición
    document.getElementById('editModalForm').addEventListener('submit', (e) => this.saveEditItem(e));
  }

  /**
   * CRUD: AGREGAR NUEVO ITEM
   */
  addNewItem(e) {
    e.preventDefault(); // Detener el envío del formulario
    
    // 1. Capturar valores
    const newDescripcion = document.getElementById('addDescripcion').value.trim();
    const newStatus = document.getElementById('addSTATUS').value;
    const newSector = document.getElementById('addSECTOR').value;

    // 2. VALIDACIÓN (Lógica corregida)
    if (!newDescripcion || !newStatus || !newSector) {
      this.showNotification('⚠️ Faltan campos obligatorios: Descripción, Status y Sector.', 'warning');
      return;
    }

    // 3. Crear nuevo objeto
    const newItem = {
      'N°': this.getNextId(),
      'DESCRIPCION': newDescripcion,
      'MARCA': document.getElementById('addMarca').value.trim(),
      'MODELO': document.getElementById('addModelo').value.trim(),
      'SERIAL': document.getElementById('addSerial').value.trim(),
      'ETIQUETA': document.getElementById('addEtiqueta').value.trim(),
      'SECTOR': newSector,
      'STATUS': newStatus,
      'CUSTODIO RESPONSABLE': document.getElementById('addResponsable').value.trim(),
      'CEDULA': document.getElementById('addCedula').value.trim(),
      'CARGO': document.getElementById('addCargo').value.trim(),
      'OBSERVACIONES': document.getElementById('addObservaciones').value.trim(),
      'isModified': true // Marcar como modificado localmente
    };

    // 4. Agregar a los datos, guardar y actualizar UI
    this.inventoryData.unshift(newItem); // Añadir al inicio
    this.saveToLocalStorage();
    this.applyFilters();
    this.updateStats();
    this.closeAddModal();
    this.showNotification(`✅ Equipo N°${newItem['N°']} agregado correctamente.`, 'success');
  }
  
  getNextId() {
    // Genera el siguiente N° consecutivo
    const maxId = this.inventoryData.reduce((max, item) => Math.max(max, parseInt(item['N°']) || 0), 0);
    return (maxId + 1).toString();
  }

  /**
   * CRUD: ELIMINAR ITEM
   */
  deleteItem(id) {
    // Reemplazamos alert() con un modal/confirmación simulada o simplemente eliminamos
    if (!confirm(`¿Está seguro de eliminar el equipo N°${id}? Esta acción solo es local.`)) {
        return;
    }

    const initialLength = this.inventoryData.length;
    this.inventoryData = this.inventoryData.filter(item => parseInt(item['N°']) !== parseInt(id));

    if (this.inventoryData.length < initialLength) {
        this.saveToLocalStorage();
        this.applyFilters();
        this.updateStats();
        this.showNotification(`🗑️ Equipo N°${id} eliminado.`, 'info');
    } else {
        this.showNotification('Error al eliminar el equipo.', 'error');
    }
  }

  /**
   * CRUD: EDITAR ITEM
   */
  openEditModal(id) {
    const itemToEdit = this.inventoryData.find(item => parseInt(item['N°']) === parseInt(id));
    if (!itemToEdit) {
      this.showNotification('Error: Equipo no encontrado para edición.', 'error');
      return;
    }

    document.getElementById('editRowNumber').textContent = id;
    document.getElementById('editModalForm').setAttribute('data-row-index', id);

    // Llenar el formulario con los datos del equipo
    document.getElementById('editDescripcion').value = itemToEdit.DESCRIPCION || '';
    document.getElementById('editMarca').value = itemToEdit.MARCA || '';
    document.getElementById('editModelo').value = itemToEdit.MODELO || '';
    document.getElementById('editSerial').value = itemToEdit.SERIAL || '';
    document.getElementById('editEtiqueta').value = itemToEdit.ETIQUETA || '';
    document.getElementById('editSECTOR').value = itemToEdit.SECTOR || '';
    document.getElementById('editSTATUS').value = itemToEdit.STATUS || '';
    document.getElementById('editResponsable').value = itemToEdit['CUSTODIO RESPONSABLE'] || '';
    document.getElementById('editCedula').value = itemToEdit.CEDULA || '';
    document.getElementById('editCargo').value = itemToEdit.CARGO || '';
    document.getElementById('editObservaciones').value = itemToEdit.OBSERVACIONES || '';

    this.showModal('editModal');
  }

  saveEditItem(e) {
    e.preventDefault();
    
    const id = document.getElementById('editModalForm').getAttribute('data-row-index');
    const index = this.inventoryData.findIndex(item => parseInt(item['N°']) === parseInt(id));

    if (index === -1) {
      this.showNotification('Error: Equipo a editar no encontrado.', 'error');
      return;
    }
    
    // Capturar nuevos valores
    const newDescripcion = document.getElementById('editDescripcion').value.trim();
    const newStatus = document.getElementById('editSTATUS').value;
    const newSector = document.getElementById('editSECTOR').value;

    // Validación
    if (!newDescripcion || !newStatus || !newSector) {
      this.showNotification('⚠️ Faltan campos obligatorios: Descripción, Status y Sector.', 'warning');
      return;
    }

    // Actualizar el objeto en el array
    this.inventoryData[index] = {
      ...this.inventoryData[index], // Mantener campos originales si existen
      'DESCRIPCION': newDescripcion,
      'MARCA': document.getElementById('editMarca').value.trim(),
      'MODELO': document.getElementById('editModelo').value.trim(),
      'SERIAL': document.getElementById('editSerial').value.trim(),
      'ETIQUETA': document.getElementById('editEtiqueta').value.trim(),
      'SECTOR': newSector,
      'STATUS': newStatus,
      'CUSTODIO RESPONSABLE': document.getElementById('editResponsable').value.trim(),
      'CEDULA': document.getElementById('editCedula').value.trim(),
      'CARGO': document.getElementById('editCargo').value.trim(),
      'OBSERVACIONES': document.getElementById('editObservaciones').value.trim(),
      'isModified': true // Marcar como modificado
    };

    this.saveToLocalStorage();
    this.applyFilters();
    this.updateStats();
    this.closeEditModal();
    this.showNotification(`✅ Equipo N°${id} guardado correctamente.`, 'success');
  }

  /**
   * MANEJO DE MODALES
   */
  showModal(id) {
    document.getElementById(id).style.display = 'flex'; // Usamos flex para centrar
  }

  closeAddModal() {
    document.getElementById('addModalForm').reset();
    document.getElementById('addModal').style.display = 'none';
  }

  closeEditModal() {
    document.getElementById('editModalForm').reset();
    document.getElementById('editModal').style.display = 'none';
  }

  openAddModal() {
    this.showModal('addModal');
  }

  /**
   * HERRAMIENTAS
   */
  clearLocalStorage() {
    if (confirm('¿Está seguro de que desea limpiar la caché (datos guardados localmente)? Los datos se recargarán desde Google Sheets.')) {
        localStorage.removeItem(this.localStorageKey);
        this.inventoryData = [];
        this.filteredData = [];
        this.showNotification('🧹 Caché local limpiada. Actualizando datos...', 'info');
        this.loadInventory();
        this.renderTable();
        this.updateStats();
    }
  }

  async refreshData() {
    this.showNotification('🔄 Recargando datos de Google Sheets...', 'info');
    await this.loadInventory();
    this.applyFilters();
    this.updateStats();
    this.showNotification('✅ Datos actualizados.', 'success');
  }

  /**
   * MENSAJES DE ESTADO
   */
  showLoadingMessage(message) {
    // Implementar un indicador de carga visible
    let loading = document.getElementById('loadingIndicator');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loadingIndicator';
        loading.textContent = message;
        loading.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #007bff;
            color: white;
            padding: 20px;
            border-radius: 8px;
            z-index: 2000;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            font-weight: bold;
        `;
        document.body.appendChild(loading);
    } else {
        loading.textContent = message;
    }
  }

  hideLoadingMessage() {
    const loading = document.getElementById('loadingIndicator');
    if (loading) {
        loading.parentNode.removeChild(loading);
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      background: ${this.getNotificationColor(type)};
      color: ${this.getNotificationTextColor(type)};
      border: 1px solid ${this.getNotificationBorderColor(type)};
      border-radius: 5px;
      z-index: 10000;
      font-weight: bold;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      max-width: 400px;
      word-wrap: break-word;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  getNotificationColor(type) {
    const colors = {
      success: '#d4edda',
      error: '#f8d7da',
      warning: '#fff3cd',
      info: '#d1ecf1'
    };
    return colors[type] || colors.info;
  }

  getNotificationTextColor(type) {
    const colors = {
      success: '#155724',
      error: '#721c24',
      warning: '#856404',
      info: '#0c5460'
    };
    return colors[type] || colors.info;
  }

  getNotificationBorderColor(type) {
    const colors = {
      success: '#c3e6cb',
      error: '#f5c6cb',
      warning: '#ffeeba',
      info: '#bee5eb'
    };
    return colors[type] || colors.info;
  }
}

// Inicializar la aplicación
const app = new InventoryApp();
