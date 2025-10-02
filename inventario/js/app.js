/**
 * CLASE PRINCIPAL DE LA APLICACIÓN DE INVENTARIO
 * Gestiona toda la lógica de la interfaz y comunicación con Google Sheets
 */
class InventoryApp {
  /**
   * CONSTRUCTOR - Inicializa la aplicación
   */
  constructor() {
    this.sheetsAPI = new GoogleSheetsAPI();
    this.inventoryData = [];
    this.filteredData = [];
    // URL de la Web App de Google Apps Script - REEMPLAZAR CON TU URL
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbwVuxATkz35w8W1kR-CkOzvRPFEzD7LG0H6regH3nsneo7ki9Mw3zwmyYO357cuh6kF/exec';
    this.init();
  }

  /**
   * INICIALIZACIÓN - Carga datos y configura la aplicación
   */
  async init() {
    await this.loadInventory();
    this.setupEventListeners();
    this.renderTable();
    this.updateStats();
  }

  /**
   * CARGAR INVENTARIO - Obtiene datos de Google Sheets o usa datos de ejemplo
   */
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

  /**
   * RENDERIZAR TABLA - Muestra los datos en la tabla HTML
   */
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

  /**
   * CONFIGURAR EVENTOS - Asigna listeners a botones y controles
   */
  setupEventListeners() {
    // Búsqueda en tiempo real
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.filterData(e.target.value);
    });

    // Filtros por departamento y estado
    document.getElementById('deptoFilter').addEventListener('change', (e) => {
      this.filterData();
    });

    document.getElementById('statusFilter').addEventListener('change', (e) => {
      this.filterData();
    });

    // Botones principales
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadInventory();
    });

    document.getElementById('addNewBtn').addEventListener('click', () => {
      this.openAddModal();
    });

    // Cerrar modales
    document.querySelector('.close').addEventListener('click', () => {
      this.closeEditModal();
    });

    document.querySelector('.close-add').addEventListener('click', () => {
      this.closeAddModal();
    });

    // Cerrar modales al hacer clic fuera
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

  /**
   * FILTRAR DATOS - Aplica búsqueda y filtros a los datos
   * @param {string} searchTerm - Término de búsqueda
   */
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

  /**
   * ACTUALIZAR ESTADÍSTICAS - Calcula y muestra contadores
   */
  updateStats() {
    const total = this.filteredData.length;
    const operativos = this.filteredData.filter(item => item.STATUS === 'OPERATIVO').length;
    const departamentos = new Set(this.filteredData.map(item => item.SECTOR)).size;
    
    // CONTADORES ESPECÍFICOS
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

    // ACTUALIZAR INTERFAZ
    document.getElementById('totalEquipos').textContent = total;
    document.getElementById('operativos').textContent = operativos;
    document.getElementById('totalDeptos').textContent = departamentos;
    document.getElementById('totalCPUs').textContent = cpus;
    document.getElementById('totalLaptops').textContent = laptops;
    document.getElementById('totalUsuarios').textContent = usuariosUnicos;
  }

  /**
   * ABRIR MODAL DE EDICIÓN - Prepara formulario con datos existentes
   * @param {number} index - Índice del elemento a editar
   */
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

  /**
   * ABRIR MODAL DE AGREGAR - Prepara formulario vacío
   */
  openAddModal() {
    const modal = document.getElementById('addModal');
    
    // Limpiar formulario para nuevo registro
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

  /**
   * CERRAR MODAL DE EDICIÓN
   */
  closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
  }

  /**
   * CERRAR MODAL DE AGREGAR
   */
  closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
  }

  /**
   * GUARDAR CAMBIOS EN GOOGLE SHEETS - Actualiza registro existente
   */
  async saveChanges() {
    const index = document.getElementById('editRowIndex').value;
    if (index === '') return;
    
    // OBTENER VALORES ACTUALIZADOS DEL FORMULARIO
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
    
    // ACTUALIZAR EN MEMORIA LOCAL
    this.filteredData[index] = { ...this.filteredData[index], ...updatedItem };
    this.inventoryData = [...this.filteredData];
    
    // INTENTAR GUARDAR EN GOOGLE SHEETS
    const success = await this.saveToGoogleSheets('update', {
      rowIndex: parseInt(index),
      updates: updatedItem
    });
    
    // ACTUALIZAR INTERFAZ
    this.renderTable();
    this.updateStats();
    this.closeEditModal();
    
    // MOSTRAR CONFIRMACIÓN
    if (success) {
      this.showNotification('✅ Cambios guardados en Google Sheets', 'success');
    } else {
      this.showNotification('⚠️ Cambios guardados solo localmente', 'warning');
    }
  }

  /**
   * AGREGAR NUEVO EQUIPO - Crea nuevo registro en Google Sheets
   */
  async addNewItem() {
    // OBTENER VALORES DEL FORMULARIO
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
    
    // VALIDAR CAMPOS REQUERIDOS
    if (!newItem.DESCRIPCION.trim()) {
      alert('❌ La descripción es obligatoria');
      return;
    }
    
    // AGREGAR A MEMORIA LOCAL
    this.inventoryData.push(newItem);
    this.filteredData = [...this.inventoryData];
    
    // INTENTAR GUARDAR EN GOOGLE SHEETS
    const success = await this.saveToGoogleSheets('add', {
      newItem: newItem
    });
    
    // ACTUALIZAR INTERFAZ
    this.renderTable();
    this.updateStats();
    this.closeAddModal();
    
    // MOSTRAR CONFIRMACIÓN
    if (success) {
      this.showNotification('✅ Nuevo equipo agregado a Google Sheets', 'success');
    } else {
      this.showNotification('⚠️ Equipo agregado solo localmente', 'warning');
    }
  }

  /**
   * ELIMINAR EQUIPO - Remueve registro de Google Sheets
   * @param {number} index - Índice del elemento a eliminar
   */
  async deleteItem(index) {
    if (!confirm('¿Estás seguro de que quieres eliminar este equipo?\n\nEsta acción no se puede deshacer.')) {
      return;
    }
    
    const deletedItem = this.filteredData[index];
    const serialToDelete = deletedItem.SERIAL;
    
    // ELIMINAR DE MEMORIA LOCAL
    this.filteredData.splice(index, 1);
    this.inventoryData = this.inventoryData.filter(item => 
      item !== deletedItem
    );
    
    // INTENTAR ELIMINAR DE GOOGLE SHEETS
    if (serialToDelete && serialToDelete !== 'S/I') {
      await this.saveToGoogleSheets('delete', {
        serial: serialToDelete,
        rowIndex: parseInt(index)
      });
    }
    
    // ACTUALIZAR INTERFAZ
    this.renderTable();
    this.updateStats();
    
    // MOSTRAR CONFIRMACIÓN
    this.showNotification('🗑️ Equipo eliminado', 'warning');
  }

  /**
   * COMUNICACIÓN CON GOOGLE SHEETS - Envía datos a Apps Script
   * @param {string} action - Tipo de acción (update/add/delete)
   * @param {Object} data - Datos a enviar
   * @returns {boolean} True si la operación fue exitosa
   */
  async saveToGoogleSheets(action, data) {
    try {
      const payload = {
        action: action,
        ...data
      };
      
      // ENVIAR PETICIÓN A GOOGLE APPS SCRIPT
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        mode: 'no-cors', // No-cors para evitar problemas CORS
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      console.log(`✅ ${action} enviado a Google Sheets`);
      return true;
      
    } catch (error) {
      console.error(`❌ Error en ${action}:`, error);
      return false;
    }
  }

  /**
   * VER DETALLES - Muestra información completa del equipo
   * @param {number} index - Índice del elemento a mostrar
   */
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

  /**
   * MOSTRAR NOTIFICACIÓN - Feedback visual para el usuario
   * @param {string} message - Mensaje a mostrar
   * @param {string} type - Tipo de notificación (success/warning/info)
   */
  showNotification(message, type = 'info') {
    // Crear elemento de notificación
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
    
    // Remover automáticamente después de 3 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// INICIALIZAR APLICACIÓN CUANDO SE CARGA LA PÁGINA
document.addEventListener('DOMContentLoaded', function() {
  window.app = new InventoryApp();
});
