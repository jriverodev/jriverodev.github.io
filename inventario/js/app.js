/**
 * SISTEMA DE INVENTARIO - VERSIÓN HÍBRIDA CON PERSISTENCIA REMOTA
 * Usa localStorage como caché y envía los cambios a Google Sheets (Apps Script)
 * * Requiere:
 * 1. js/google-sheets.js (con WEB_APP_URL configurada)
 * 2. js/export.js (para la exportación a Excel)
 */

class InventoryApp {
  constructor() {
    // La instancia de GoogleSheetsAPI debe estar definida en google-sheets.js
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
    console.log('💾 Los cambios se guardan en localStorage Y se intentan enviar a Google Sheets.');
  }

  // --- MÉTODOS DE CARGA Y ALMACENAMIENTO LOCAL ---

  /**
   * CARGAR INVENTARIO - Estrategia híbrida: Local cache + Remote Sync
   */
  async loadInventory() {
    try {
        console.log('🔄 Cargando inventario...');
        this.showLoadingMessage('🔄 Cargando datos, por favor espere...', 'info');

        // 1. Intentar cargar desde localStorage (cache)
        const localData = this.loadFromLocalStorage();
        if (localData && localData.length > 0) {
            console.log('💾 Datos cargados desde localStorage:', localData.length, 'registros');
            this.inventoryData = localData;
            this.filterData();
            this.renderTable();
            this.updateStats();
        }

        // 2. Cargar desde Google Sheets en segundo plano
        const remoteData = await this.sheetsAPI.loadData();

        // 3. Fusión de datos: Los datos locales modificados tienen prioridad
        this.inventoryData = this.mergeData(this.inventoryData, remoteData);
        this.saveToLocalStorage(this.inventoryData);

        this.filterData();
        this.renderTable();
        this.updateStats();
        this.showLoadingMessage('✅ Inventario actualizado.', 'success');

    } catch (error) {
        this.showLoadingMessage('❌ Error de carga inicial. Usando datos de caché.', 'error');
        console.error('Error al cargar y fusionar inventario:', error);
    }
  }

  loadFromLocalStorage() {
    const data = localStorage.getItem(this.localStorageKey);
    return data ? JSON.parse(data) : [];
  }

  saveToLocalStorage(data) {
    localStorage.setItem(this.localStorageKey, JSON.stringify(data));
  }

  /**
   * Combina datos locales (cache) y remotos (Sheets), priorizando los cambios locales.
   */
  mergeData(localData, remoteData) {
    if (!localData || localData.length === 0) return remoteData;

    // Crear un mapa de datos locales usando 'N°' como clave
    const localMap = new Map();
    localData.forEach(item => {
        if (item['N°']) {
            localMap.set(String(item['N°']), item);
        }
    });

    const merged = [];

    // Priorizar datos remotos si no hay conflicto local
    remoteData.forEach(remoteItem => {
        const id = String(remoteItem['N°']);
        const localItem = localMap.get(id);

        if (localItem && localItem._modified) {
            // El ítem existe y fue modificado localmente: usar la versión local
            merged.push(localItem);
            localMap.delete(id);
        } else {
            // Usar la versión remota (fresca)
            merged.push(remoteItem);
        }
    });

    // Agregar ítems completamente nuevos que se crearon localmente
    localMap.forEach(item => {
        if (item._new) {
            merged.push(item);
        }
    });

    // Limpiar las claves de estado temporales en la data final
    return merged.map(item => {
        const cleanItem = { ...item };
        delete cleanItem._modified;
        delete cleanItem._new;
        delete cleanItem._modifiedAt;
        return cleanItem;
    });
  }

  clearLocalData() {
    // Usamos una notificación modal custom en lugar de window.confirm()
    if (!window.confirm('¿Estás seguro de que quieres borrar todos los datos guardados localmente (caché)? Se recargarán los datos solo desde Google Sheets.')) {
        return;
    }

    localStorage.removeItem(this.localStorageKey);
    this.showLoadingMessage('🗑️ Caché local eliminada. Recargando inventario...', 'success');
    this.loadInventory();
  }


  // --- MÉTODOS DE ESCRITURA MODIFICADOS (CRUD Remoto) ---

  /**
   * Guarda los cambios en el inventario local y envía la actualización a Google Sheets.
   * @param {number} rowIndex - El índice de la fila en el array filteredData.
   */
  async saveChanges(rowIndex) {
    this.showLoadingMessage('⏳ Guardando cambios...', 'info');

    const form = document.getElementById('editModalForm');
    const originalItem = this.filteredData[rowIndex];
    const updatedData = {};
    
    // El índice de la hoja es el N° - 1 (para coincidir con el índice de la API de Apps Script)
    const sheetRowIndex = originalItem['N°'] && !String(originalItem['N°']).includes('NEW-')
        ? parseInt(originalItem['N°']) - 1
        : null;
    
    const headers = ['DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES'];

    // 1. Recoger datos del formulario
    headers.forEach(header => {
        const inputId = 'edit' + header.replace(/\s/g, '');
        const value = form.querySelector(`#${inputId}`).value.trim();
        updatedData[header] = value;
    });

    // Validar campo obligatorio
    if (!updatedData.DESCRIPCION) {
        this.showNotification('La Descripción es un campo obligatorio.', 'error');
        return;
    }

    // 2. Actualizar el inventario local y marcar
    let itemToUpdate = this.inventoryData.find(item => item['N°'] === originalItem['N°']);

    if (itemToUpdate) {
        Object.assign(itemToUpdate, updatedData);
        itemToUpdate._modified = true;
        itemToUpdate._modifiedAt = new Date().toISOString();
        this.saveToLocalStorage(this.inventoryData);

        let syncSuccess = false;

        // 3. Intentar actualizar Google Sheets (Apps Script)
        if (sheetRowIndex !== null && sheetRowIndex >= 0) {
            const result = await this.sheetsAPI.updateInventoryItem(sheetRowIndex, updatedData);

            if (result.success) {
                // Si la actualización remota es exitosa, se considera sincronizado
                delete itemToUpdate._modified;
                delete itemToUpdate._modifiedAt;
                this.saveToLocalStorage(this.inventoryData);
                this.showLoadingMessage('✅ Equipo editado y sincronizado con Google Sheets.', 'success');
                syncSuccess = true;
            }
        }

        if (!syncSuccess) {
            this.showLoadingMessage('⚠️ Equipo editado localmente. No se pudo sincronizar de inmediato.', 'warning');
        }
    }

    this.closeEditModal();
    this.filterData();
    this.renderTable();
    this.updateStats();
  }

  /**
   * Agrega un nuevo equipo al inventario local y lo envía a Google Sheets.
   */
  async addNewItem() {
    // 1. Recoger datos
    const newItem = this.collectAddFormData();
    if (!newItem.DESCRIPCION) {
      this.showNotification('La Descripción es un campo obligatorio.', 'error');
      return;
    }
    this.showLoadingMessage('⏳ Agregando equipo...', 'info');

    let syncSuccess = false;

    // 2. Intentar agregar a Google Sheets primero
    const result = await this.sheetsAPI.addInventoryItem(newItem);

    if (result.success) {
        // 3. Si es exitoso, agregar el nuevo ítem a la lista local con su N° remoto
        newItem['N°'] = result.newRowNumber; // Usar el número de fila real asignado por Apps Script
        syncSuccess = true;
        this.showLoadingMessage('✅ Equipo agregado y sincronizado con Google Sheets.', 'success');
    } else {
        // 4. Si falla, agregarlo solo localmente y marcarlo como nuevo/modificado
        const tempId = 'NEW-' + Date.now();
        newItem['N°'] = tempId;
        newItem._new = true;
        newItem._modifiedAt = new Date().toISOString();
        this.showLoadingMessage(`⚠️ Equipo agregado SÓLO localmente. Error remoto: ${result.error}.`, 'warning');
    }

    // 5. Guardar en local y actualizar UI
    this.inventoryData.push(newItem);
    this.saveToLocalStorage(this.inventoryData);

    this.closeAddModal();
    this.filterData();
    this.renderTable();
    this.updateStats();
  }

  /**
   * Elimina un equipo del inventario local y lo elimina físicamente en Google Sheets.
   * @param {number} rowIndex - El índice de la fila en el array filteredData.
   */
  async deleteItem(rowIndex) {
    // Sustituto de window.confirm()
    if (!window.confirm('¿Estás seguro de que quieres eliminar este equipo PERMANENTEMENTE? Esta acción borrará la fila en Google Sheets.')) {
        return;
    }

    this.showLoadingMessage('⏳ Eliminando equipo...', 'info');
    const originalItem = this.filteredData[rowIndex];

    // sheetRowIndex es el N° - 1
    const sheetRowIndex = originalItem['N°'] && !String(originalItem['N°']).includes('NEW-')
        ? parseInt(originalItem['N°']) - 1
        : null;

    let deletionSuccessful = false;

    if (originalItem['N°'].toString().includes('NEW-')) {
        // Caso 1: Ítem nuevo (NEW-...) que nunca se sincronizó
        this.showLoadingMessage('🗑️ Eliminado de la caché local (nunca fue sincronizado).', 'success');
        deletionSuccessful = true;

    } else if (sheetRowIndex !== null && sheetRowIndex >= 1) { // >= 1 porque 0 es la fila de headers
        // Caso 2: Ítem sincronizado: Intentar eliminar en Google Sheets
        const result = await this.sheetsAPI.deleteInventoryItem(sheetRowIndex);

        if (result.success) {
            this.showLoadingMessage('🗑️ Equipo eliminado permanentemente de Google Sheets.', 'success');
            deletionSuccessful = true;
        } else {
            this.showLoadingMessage(`⚠️ Error al eliminar remotamente: ${result.error}.`, 'error');
            return;
        }
    } else {
        this.showLoadingMessage('❌ No se puede eliminar: ID de registro inválido o no encontrado.', 'error');
        return;
    }

    // Si la eliminación fue exitosa (local o remota), actualizar la caché
    if (deletionSuccessful) {
        this.inventoryData = this.inventoryData.filter(item => item['N°'] !== originalItem['N°']);
        this.saveToLocalStorage(this.inventoryData);
        this.filterData();
        this.renderTable();
        this.updateStats();
    }
  }

  // --- MÉTODOS DE UI Y DE UTILIDAD ---

  /**
   * Filtra los datos del inventario basándose en la búsqueda y los selectores.
   */
  filterData() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const deptoFilter = document.getElementById('deptoFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = this.inventoryData.filter(item => {
        // Filtro de Búsqueda (busca en todos los valores)
        const searchMatch = Object.values(item).some(value =>
            String(value).toLowerCase().includes(searchTerm)
        );

        // Filtro de Departamento
        const deptoMatch = !deptoFilter || (item.SECTOR || '').toUpperCase() === deptoFilter.toUpperCase();

        // Filtro de Estado
        const statusMatch = !statusFilter || (item.STATUS || '').toUpperCase() === statusFilter.toUpperCase();

        return searchMatch && deptoMatch && statusMatch;
    });

    this.filteredData = filtered;
  }

  /**
   * Dibuja la tabla HTML con los datos filtrados.
   */
  renderTable() {
    const tableBody = document.getElementById('inventoryTableBody');
    tableBody.innerHTML = ''; // Limpia tabla

    if (this.filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" class="no-results">No se encontraron equipos que coincidan con los filtros.</td></tr>';
        return;
    }

    this.filteredData.forEach((item, index) => {
        const row = document.createElement('tr');
        // Clase para indicar ítem modificado localmente
        if (item._modified || item._new) {
            row.classList.add('row-modified');
        }

        const columns = ['N°', 'DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES'];

        columns.forEach(col => {
            const cell = document.createElement('td');
            cell.textContent = item[col] || '';

            if (col === 'STATUS') {
                const statusClass = (item.STATUS || '').toLowerCase() === 'operativo' ? 'operativo' : 'inoperativo';
                cell.innerHTML = `<span class="status ${statusClass}">${item.STATUS || 'N/A'}</span>`;
            }
            if (col === 'N°' && (item._modified || item._new)) {
                // Añadir badge para indicar modificaciones/nuevos locales
                const badge = `<span title="Guardado localmente, requiere sincronización" class="modified-badge">💾</span>`;
                cell.innerHTML = `${item['N°'] || ''} ${badge}`;
            }
            row.appendChild(cell);
        });

        // Columna de Acciones
        const actionsCell = document.createElement('td');
        actionsCell.classList.add('actions-cell');
        actionsCell.innerHTML = `
            <button class="btn-action edit-btn" onclick="app.showEditModal(${index})">✏️ Editar</button>
            <button class="btn-action delete-btn" onclick="app.deleteItem(${index})">🗑️ Eliminar</button>
        `;
        row.appendChild(actionsCell);

        tableBody.appendChild(row);
    });
  }

  /**
   * Actualiza los contadores de estadísticas.
   */
  updateStats() {
    const total = this.inventoryData.length;
    const operativo = this.inventoryData.filter(item => (item.STATUS || '').toUpperCase() === 'OPERATIVO').length;
    const inoperativo = this.inventoryData.filter(item => (item.STATUS || '').toUpperCase() === 'INOPERATIVO').length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('operativoCount').textContent = operativo;
    document.getElementById('inoperativoCount').textContent = inoperativo;
  }

  /**
   * Configura todos los listeners de eventos para inputs y botones.
   */
  setupEventListeners() {
    // Filtros de búsqueda
    document.getElementById('searchInput').addEventListener('input', () => {
        this.filterData();
        this.renderTable();
        this.updateStats();
    });

    document.getElementById('deptoFilter').addEventListener('change', () => {
        this.filterData();
        this.renderTable();
        this.updateStats();
    });

    document.getElementById('statusFilter').addEventListener('change', () => {
        this.filterData();
        this.renderTable();
        this.updateStats();
    });

    // Botones de acción principales
    document.getElementById('addNewBtn').addEventListener('click', () => this.showAddModal());
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadInventory());
    document.getElementById('clearLocalBtn').addEventListener('click', () => this.clearLocalData());

    // Event listeners para los botones de cerrar modales
    document.querySelector('.modal-add .btn-cancel').addEventListener('click', () => this.closeAddModal());
    document.querySelector('.modal-edit .btn-cancel').addEventListener('click', () => this.closeEditModal());

    // Manejo de submits de formularios (previene recarga y llama a la función de guardado)
    document.querySelector('.modal-add form').addEventListener('submit', (e) => {
        e.preventDefault();
        this.addNewItem();
    });

    document.querySelector('.modal-edit form').addEventListener('submit', (e) => {
        e.preventDefault();
        const rowIndex = parseInt(document.getElementById('editModalForm').dataset.rowIndex);
        this.saveChanges(rowIndex);
    });
  }

  /**
   * Recoge los datos del formulario de "Agregar Nuevo Equipo".
   */
  collectAddFormData() {
    const newItem = {};
    const headers = ['DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES'];
    headers.forEach(header => {
        const inputId = 'add' + header.replace(/\s/g, '');
        const input = document.getElementById(inputId);
        if (input) {
            newItem[header] = input.value.trim();
        }
    });
    // El N° se asigna después de la sincronización remota o como NEW-XXXX localmente
    newItem['N°'] = '';
    return newItem;
  }

  // --- MÉTODOS DE NOTIFICACIÓN Y MODALES ---

  showLoadingMessage(message, type = 'info') {
    this.showNotification(message, type);
  }

  /**
   * Muestra una notificación simple flotante (sustituto de alert()).
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
    const colors = { success: '#d4edda', error: '#f8d7da', warning: '#fff3cd', info: '#d1ecf1' };
    return colors[type] || colors.info;
  }

  getNotificationTextColor(type) {
    const colors = { success: '#155724', error: '#721c24', warning: '#856404', info: '#0c5460' };
    return colors[type] || colors.info;
  }

  getNotificationBorderColor(type) {
    const colors = { success: '#c3e6cb', error: '#f5c6cb', warning: '#ffeeba', info: '#bee5eb' };
    return colors[type] || colors.info;
  }

  showAddModal() {
    document.getElementById('addModal').style.display = 'flex';
  }

  closeAddModal() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('addModalForm').reset();
  }

  showEditModal(rowIndex) {
    const item = this.filteredData[rowIndex];
    document.getElementById('editModal').style.display = 'flex';
    document.getElementById('editModalForm').dataset.rowIndex = rowIndex;
    document.getElementById('editRowNumber').textContent = item['N°'] || 'Nuevo';

    const headers = ['DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES'];
    headers.forEach(header => {
        const inputId = 'edit' + header.replace(/\s/g, '');
        const input = document.getElementById(inputId);
        if (input) {
            // Asegurarse de que el sector y status se muestren correctamente en el select
            if (input.tagName === 'SELECT') {
                input.value = (item[header] || '').toUpperCase();
            } else {
                input.value = item[header] || '';
            }
        }
    });
  }

  closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
  }
}

// Inicialización de la aplicación al cargar el script
const app = new InventoryApp();