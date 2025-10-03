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
        this.renderTable();
        this.updateStats();
      }
      
      // LUEGO: Cargar desde Google Sheets en segundo plano
      await this.loadFromGoogleSheets();
      
    } catch (error) {
      console.error('❌ Error en loadInventory:', error);
      this.handleLoadError(error);
    }
  }

  /**
   * CARGAR DESDE GOOGLE SHEETS - Actualizar datos base
   */
  async loadFromGoogleSheets() {
    try {
      console.log('🌐 Actualizando desde Google Sheets...');
      const googleData = await this.sheetsAPI.loadData();
      
      if (googleData && googleData.length > 0) {
        // Combinar datos: mantener cambios locales, agregar nuevos de Google Sheets
        this.mergeData(googleData);
        console.log('✅ Datos actualizados desde Google Sheets:', googleData.length, 'registros');
      }
      
    } catch (error) {
      console.warn('⚠️ No se pudo actualizar desde Google Sheets:', error.message);
      // No mostramos error al usuario, usamos datos locales
    }
  }

  /**
   * COMBINAR DATOS - Fusiona datos locales con datos de Google Sheets
   */
  mergeData(googleData) {
    const localData = this.inventoryData;
    
    // Si no hay datos locales, usar datos de Google Sheets
    if (localData.length === 0) {
      this.inventoryData = googleData;
      this.filteredData = [...googleData];
      this.saveToLocalStorage();
      return;
    }
    
    // Estrategia de fusión inteligente
    const mergedData = [...googleData];
    
    // Buscar registros modificados localmente y mantener los cambios
    localData.forEach(localItem => {
      if (localItem._modified) { // Marcar items modificados localmente
        const existingIndex = mergedData.findIndex(gItem => 
          gItem.SERIAL === localItem.SERIAL && gItem.SERIAL !== ''
        );
        
        if (existingIndex !== -1) {
          // Reemplazar con versión local modificada
          mergedData[existingIndex] = { ...localItem };
        } else {
          // Agregar nuevo item local
          mergedData.push({ ...localItem });
        }
      }
    });
    
    this.inventoryData = mergedData;
    this.filteredData = [...mergedData];
    this.saveToLocalStorage();
  }

  /**
   * CARGAR DESDE LOCALSTORAGE
   */
  loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.localStorageKey);
      if (saved) {
        const data = JSON.parse(saved);
        console.log('📁 Datos locales cargados:', data.length, 'registros');
        return data;
      }
    } catch (error) {
      console.error('❌ Error cargando de localStorage:', error);
    }
    return null;
  }

  /**
   * GUARDAR EN LOCALSTORAGE
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.inventoryData));
      localStorage.setItem(`${this.localStorageKey}_timestamp`, new Date().toISOString());
      console.log('💾 Datos guardados en localStorage');
    } catch (error) {
      console.error('❌ Error guardando en localStorage:', error);
    }
  }

  /**
   * MANEJAR ERROR DE CARGA
   */
  handleLoadError(error) {
    this.showErrorMessage(`❌ Error cargando datos: ${error.message}`);
    
    // Intentar cargar datos de ejemplo
    try {
      this.inventoryData = this.sheetsAPI.getSampleData();
      this.filteredData = [...this.inventoryData];
      this.renderTable();
      this.updateStats();
      this.showNotification('📋 Usando datos de ejemplo', 'warning');
    } catch (fallbackError) {
      console.error('❌ Error incluso con datos de ejemplo:', fallbackError);
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
            <br><small>Los cambios se guardarán localmente</small>
          </div>
        </td>
      </tr>
    `;
  }

  /**
   * RENDERIZAR TABLA
   */
  renderTable() {
    const tbody = document.getElementById('tableBody');
    
    if (this.filteredData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12"><div class="no-data">📭 No se encontraron equipos</div></td></tr>';
      return;
    }

    tbody.innerHTML = this.filteredData.map((item, index) => `
      <tr class="${item._modified ? 'modified-row' : ''}">
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
          ${item._modified ? '<span class="modified-badge" title="Modificado localmente">🔄</span>' : ''}
        </td>
      </tr>
    `).join('');
  }

  /**
   * ESCAPAR HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * CONFIGURAR EVENTOS
   */
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

    // Nuevo botón: Limpiar datos locales
    document.getElementById('clearLocalBtn').addEventListener('click', () => {
      this.clearLocalData();
    });

    // Modales
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
  }

  /**
   * FILTRAR DATOS
   */
  filterData(searchTerm = '') {
    const deptoFilter = document.getElementById('deptoFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    
    this.filteredData = this.inventoryData.filter(item => {
      const matchesSearch = !searchTerm || 
        Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesDepto = !deptoFilter || item.SECTOR === deptoFilter;
      const matchesStatus = !statusFilter || item.STATUS === statusFilter;
      
      return matchesSearch && matchesDepto && matchesStatus;
    });
    
    this.renderTable();
    this.updateStats();
  }

  /**
   * ACTUALIZAR ESTADÍSTICAS
   */
  updateStats() {
    const total = this.filteredData.length;
    const operativos = this.filteredData.filter(item => item.STATUS === 'OPERATIVO').length;
    const departamentos = new Set(this.filteredData.map(item => item.SECTOR)).size;
    
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

    const modificados = this.filteredData.filter(item => item._modified).length;

    document.getElementById('totalEquipos').textContent = total;
    document.getElementById('operativos').textContent = operativos;
    document.getElementById('totalDeptos').textContent = departamentos;
    document.getElementById('totalCPUs').textContent = cpus;
    document.getElementById('totalLaptops').textContent = laptops;
    document.getElementById('totalUsuarios').textContent = usuariosUnicos;
    document.getElementById('modificados').textContent = modificados;
  }

  /**
   * MODALES DE EDICIÓN
   */
  openEditModal(index) {
    const item = this.filteredData[index];
    const modal = document.getElementById('editModal');
    
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

  /**
   * GUARDAR CAMBIOS - Solo en localStorage
   */
  async saveChanges() {
    const index = document.getElementById('editRowIndex').value;
    if (index === '') return;
    
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
      'OBSERVACIONES': document.getElementById('editObservaciones').value,
      '_modified': true, // Marcar como modificado localmente
      '_modifiedAt': new Date().toISOString()
    };
    
    if (!updatedItem.DESCRIPCION.trim()) {
      this.showNotification('❌ La descripción es obligatoria', 'error');
      return;
    }
    
    // Actualizar en memoria
    this.filteredData[index] = { ...this.filteredData[index], ...updatedItem };
    this.inventoryData = [...this.filteredData];
    
    // Guardar en localStorage
    this.saveToLocalStorage();
    
    // Actualizar interfaz
    this.renderTable();
    this.updateStats();
    this.closeEditModal();
    
    this.showNotification('✅ Cambios guardados localmente', 'success');
  }

  /**
   * AGREGAR NUEVO EQUIPO
   */
  async addNewItem() {
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
      'OBSERVACIONES': document.getElementById('addObservaciones').value,
      '_modified': true,
      '_modifiedAt': new Date().toISOString(),
      '_new': true // Marcar como nuevo
    };
    
    if (!newItem.DESCRIPCION.trim()) {
      this.showNotification('❌ La descripción es obligatoria', 'error');
      return;
    }
    
    // Agregar a memoria
    this.inventoryData.push(newItem);
    this.filteredData = [...this.inventoryData];
    
    // Guardar en localStorage
    this.saveToLocalStorage();
    
    // Actualizar interfaz
    this.renderTable();
    this.updateStats();
    this.closeAddModal();
    
    this.showNotification('✅ Equipo agregado localmente', 'success');
  }

  /**
   * ELIMINAR EQUIPO
   */
  async deleteItem(index) {
    if (!confirm('¿Estás seguro de que quieres eliminar este equipo?\n\nEsta acción no se puede deshacer.')) {
      return;
    }
    
    const deletedItem = this.filteredData[index];
    
    // Marcar como eliminado en lugar de borrar completamente
    this.filteredData[index].STATUS = 'ELIMINADO';
    this.filteredData[index]._modified = true;
    this.filteredData[index]._modifiedAt = new Date().toISOString();
    
    this.inventoryData = [...this.filteredData];
    this.saveToLocalStorage();
    
    this.renderTable();
    this.updateStats();
    
    this.showNotification('🗑️ Equipo marcado como eliminado', 'warning');
  }

  /**
   * EXPORTAR A EXCEL - Incluye todos los datos locales
   */
  exportToExcel() {
    try {
      const data = this.inventoryData.map(item => {
        const exportItem = { ...item };
        // Remover campos internos
        delete exportItem._modified;
        delete exportItem._modifiedAt;
        delete exportItem._new;
        return exportItem;
      });
      
      if (data.length === 0) {
        this.showNotification('📭 No hay datos para exportar', 'warning');
        return;
      }
      
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inventario");
      
      const date = new Date().toISOString().split('T')[0];
      const filename = `inventario_actualizado_${date}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      this.showNotification(`📥 ${filename} descargado`, 'success');
      
      console.log('💾 Excel exportado con', data.length, 'registros');
      
    } catch (error) {
      console.error('❌ Error exportando Excel:', error);
      this.showNotification('❌ Error al exportar Excel', 'error');
    }
  }

  /**
   * LIMPIAR DATOS LOCALES - Volver a datos originales
   */
  clearLocalData() {
    if (!confirm('¿Estás seguro de que quieres limpiar todos los cambios locales?\n\nSe perderán todas las modificaciones y se recargarán los datos originales.')) {
      return;
    }
    
    try {
      localStorage.removeItem(this.localStorageKey);
      localStorage.removeItem(`${this.localStorageKey}_timestamp`);
      
      this.showNotification('🧹 Datos locales limpiados', 'info');
      
      // Recargar desde Google Sheets
      this.loadInventory();
      
    } catch (error) {
      console.error('❌ Error limpiando datos locales:', error);
      this.showNotification('❌ Error limpiando datos locales', 'error');
    }
  }

  /**
   * VER DETALLES
   */
  viewDetails(index) {
    const item = this.filteredData[index];
    let detalles = `
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
    
    if (item._modified) {
      detalles += `\n🔄 **Modificado localmente:** ${new Date(item._modifiedAt).toLocaleString()}`;
    }
    
    alert(detalles);
  }

  /**
   * MOSTRAR NOTIFICACIÓN
   */
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
