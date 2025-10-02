/**
 * CLASE PRINCIPAL DE LA APLICACIÓN DE INVENTARIO
 * Sistema completo de gestión con persistencia en Google Sheets
 * Usa JSONP para evitar problemas CORS
 */

class InventoryApp {
  /**
   * CONSTRUCTOR - Inicializa la aplicación con configuración
   */
  constructor() {
    this.sheetsAPI = new GoogleSheetsAPI();
    this.inventoryData = [];
    this.filteredData = [];
    // URL de la Web App de Google Apps Script - ACTUALIZAR CON TU URL
    this.webAppUrl = 'https://script.google.com/macros/s/AKfycbwVuxATkz35w8W1kR-CkOzvRPFEzD7LG0H6regH3nsneo7ki9Mw3zwmyYO357cuh6kF/exec';
    this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
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
    
    // Probar conexión con Google Apps Script
    this.testConnection();
  }

  /**
   * PROBAR CONEXIÓN CON GOOGLE APPS SCRIPT
   */
  async testConnection() {
    try {
      const result = await this.makeJSONPRequest('test', {});
      if (result && result.success) {
        console.log('✅ Conexión con Google Apps Script: OK', result.message);
      } else {
        console.warn('⚠️ Conexión con Google Apps Script: Limitada', result?.error);
      }
    } catch (error) {
      console.warn('⚠️ No se pudo conectar con Google Apps Script:', error.message);
    }
  }

  /**
   * CARGAR INVENTARIO - Obtiene datos de Google Sheets
   */
  async loadInventory() {
    try {
      console.log('🔄 Iniciando carga de inventario...');
      this.showLoadingMessage('🔄 Cargando datos desde Google Sheets...');
      
      this.inventoryData = await this.sheetsAPI.loadData();
      this.filteredData = [...this.inventoryData];
      
      console.log('✅ Inventario cargado:', this.inventoryData.length, 'registros');
      this.renderTable();
      this.updateStats();
      
    } catch (error) {
      console.error('❌ Error en loadInventory:', error);
      this.showErrorMessage(`❌ Error cargando datos: ${error.message}`);
      
      // Usar datos de ejemplo como fallback
      this.inventoryData = this.sheetsAPI.getSampleData();
      this.filteredData = [...this.inventoryData];
      this.renderTable();
      this.updateStats();
    }
  }

  /**
   * MOSTRAR MENSAJE DE CARGA
   */
  showLoadingMessage(message) {
    document.getElementById('tableBody').innerHTML = `
      <tr>
        <td colspan="12">
          <div class="loading">${message}</div>
        </td>
      </tr>
    `;
  }

  /**
   * MOSTRAR MENSAJE DE ERROR
   */
  showErrorMessage(message) {
    document.getElementById('tableBody').innerHTML = `
      <tr>
        <td colspan="12">
          <div class="error-message">
            ${message}
            <br><small>Mostrando datos de ejemplo</small>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * RENDERIZAR TABLA - Muestra los datos en la interfaz
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
        <td>${this.escapeHtml(item.DESCRIPCION || '')}</td>
        <td>${this.escapeHtml(item.MARCA || '')}</td>
        <td>${this.escapeHtml(item.MODELO || '')}</td>
        <td>${this.escapeHtml(item.SERIAL || '')}</td>
        <td>${this.escapeHtml(item.ETIQUETA || '')}</td>
        <td>${this.escapeHtml(item.SECTOR || '')}</td>
        <td><span class="status ${item.STATUS === 'OPERATIVO' ? 'operativo' : 'inoperativo'}">${item.STATUS || ''}</span></td>
        <td>${this.escapeHtml(item['CUSTODIO RESPONSABLE'] || '')}</td>
        <td>${this.escapeHtml(item.CEDULA || '')}</td>
        <td>${this.escapeHtml(item.CARGO || '')}</td>
        <td class="actions">
          <button class="btn-edit" onclick="app.openEditModal(${index})" title="Editar">✏️</button>
          <button class="btn-view" onclick="app.viewDetails(${index})" title="Ver detalles">👁️</button>
          <button class="btn-delete" onclick="app.deleteItem(${index})" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * ESCAPAR HTML - Prevenir inyección XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * CONFIGURAR EVENTOS - Controladores para la interfaz
   */
  setupEventListeners() {
    // Búsqueda en tiempo real
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

    // Botones principales
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadInventory();
    });

    document.getElementById('addNewBtn').addEventListener('click', () => {
      this.openAddModal();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportToExcel();
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
      if (e.target === editModal) this.closeEditModal();
      if (e.target === addModal) this.closeAddModal();
    });

    // Enter en búsqueda
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.filterData(e.target.value);
      }
    });
  }

  /**
   * FILTRAR DATOS - Aplica búsqueda y filtros
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
    
    // Contadores específicos
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

    // Actualizar interfaz
    document.getElementById('totalEquipos').textContent = total;
    document.getElementById('operativos').textContent = operativos;
    document.getElementById('totalDeptos').textContent = departamentos;
    document.getElementById('totalCPUs').textContent = cpus;
    document.getElementById('totalLaptops').textContent = laptops;
    document.getElementById('totalUsuarios').textContent = usuariosUnicos;
  }

  /**
   * ABRIR MODAL DE EDICIÓN
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
   * ABRIR MODAL DE AGREGAR
   */
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

  /**
   * CERRAR MODALES
   */
  closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
  }

  closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
  }

  /**
   * GUARDAR CAMBIOS - Actualiza registro en Google Sheets
   */
  async saveChanges() {
    const index = document.getElementById('editRowIndex').value;
    if (index === '') return;
    
    // Obtener valores actualizados
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
    
    // Validar campos requeridos
    if (!updatedItem.DESCRIPCION.trim()) {
      this.showNotification('❌ La descripción es obligatoria', 'error');
      return;
    }
    
    // Mostrar carga
    this.showNotification('🔄 Guardando cambios en Google Sheets...', 'info');
    
    // Actualizar en memoria local inmediatamente
    this.filteredData[index] = { ...this.filteredData[index], ...updatedItem };
    this.inventoryData = [...this.filteredData];
    
    // Intentar guardar en Google Sheets via JSONP
    const success = await this.makeJSONPRequest('update', {
      rowIndex: parseInt(index),
      ...updatedItem
    });
    
    // Actualizar interfaz
    this.renderTable();
    this.updateStats();
    this.closeEditModal();
    
    if (success) {
      this.showNotification('✅ Cambios guardados en Google Sheets', 'success');
    } else {
      this.showNotification('⚠️ Cambios guardados solo localmente', 'warning');
    }
  }

  /**
   * AGREGAR NUEVO EQUIPO
   */
  async addNewItem() {
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
      this.showNotification('❌ La descripción es obligatoria', 'error');
      return;
    }
    
    // Mostrar carga
    this.showNotification('🔄 Agregando nuevo equipo...', 'info');
    
    // Agregar a memoria local
    this.inventoryData.push(newItem);
    this.filteredData = [...this.inventoryData];
    
    // Por ahora, guardamos solo localmente (para agregar en Sheets necesitaríamos POST)
    this.renderTable();
    this.updateStats();
    this.closeAddModal();
    
    this.showNotification('✅ Equipo agregado localmente', 'success');
    console.log('➕ Nuevo equipo agregado (local):', newItem);
  }

  /**
   * ELIMINAR EQUIPO
   */
  async deleteItem(index) {
    if (!confirm('¿Estás seguro de que quieres eliminar este equipo?\n\nEsta acción no se puede deshacer.')) {
      return;
    }
    
    const deletedItem = this.filteredData[index];
    
    // Mostrar carga
    this.showNotification('🔄 Eliminando equipo...', 'info');
    
    // Eliminar de memoria local
    this.filteredData.splice(index, 1);
    this.inventoryData = this.inventoryData.filter(item => item !== deletedItem);
    
    // Intentar eliminar de Google Sheets via JSONP
    const success = await this.makeJSONPRequest('update', {
      rowIndex: parseInt(index),
      DESCRIPCION: '', // Marcar como vacío para "eliminar"
      STATUS: 'ELIMINADO'
    });
    
    // Actualizar interfaz
    this.renderTable();
    this.updateStats();
    
    if (success) {
      this.showNotification('🗑️ Equipo eliminado de Google Sheets', 'warning');
    } else {
      this.showNotification('🗑️ Equipo eliminado solo localmente', 'warning');
    }
  }

  /**
   * REALIZAR PETICIÓN JSONP - Para evitar problemas CORS
   */
  makeJSONPRequest(action, data) {
    return new Promise((resolve) => {
      const callbackName = 'jsonpCallback_' + Date.now();
      let url = `${this.webAppUrl}?callback=${callbackName}&action=${action}`;
      
      // Agregar parámetros según la acción
      if (action === 'update') {
        url += `&rowIndex=${data.rowIndex}`;
        // Agregar todos los campos a actualizar
        Object.keys(data).forEach(key => {
          if (key !== 'rowIndex' && data[key] !== undefined) {
            url += `&${key}=${encodeURIComponent(data[key])}`;
          }
        });
      } else if (action === 'test') {
        // No necesita parámetros adicionales
      }
      
      // Configurar timeout
      const timeout = setTimeout(() => {
        cleanup();
        console.warn(`⏰ Timeout en petición ${action}`);
        resolve(false);
      }, 10000);
      
      const cleanup = () => {
        clearTimeout(timeout);
        if (window[callbackName]) {
          delete window[callbackName];
        }
        if (script.parentNode) {
          document.head.removeChild(script);
        }
      };
      
      // Configurar callback global
      window[callbackName] = (response) => {
        cleanup();
        
        if (response && response.success) {
          console.log(`✅ ${action} exitoso:`, response);
          resolve(true);
        } else {
          console.error(`❌ ${action} falló:`, response);
          resolve(false);
        }
      };
      
      // Crear script para JSONP
      const script = document.createElement('script');
      script.src = url;
      script.onerror = () => {
        cleanup();
        console.error(`❌ Error de red en ${action}`);
        resolve(false);
      };
      
      document.head.appendChild(script);
      
    });
  }

  /**
   * VER DETALLES DEL EQUIPO
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
   * EXPORTAR A EXCEL
   */
  exportToExcel() {
    try {
      const data = this.filteredData;
      
      if (data.length === 0) {
        this.showNotification('📭 No hay datos para exportar', 'warning');
        return;
      }
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventario");
      
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `inventario_equipos_${date}.xlsx`);
      
      this.showNotification('📥 Excel exportado correctamente', 'success');
      
    } catch (error) {
      console.error('❌ Error exportando Excel:', error);
      this.showNotification('❌ Error al exportar Excel', 'error');
    }
  }

  /**
   * MOSTRAR NOTIFICACIÓN
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
    
    // Remover después de 4 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 4000);
  }

  /**
   * OBTENER COLOR DE NOTIFICACIÓN
   */
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
      warning: '#ffeaa7',
      info: '#bee5eb'
    };
    return colors[type] || colors.info;
  }
}

// INICIALIZAR APLICACIÓN
document.addEventListener('DOMContentLoaded', function() {
  window.app = new InventoryApp();
});
