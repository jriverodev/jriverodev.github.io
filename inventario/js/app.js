/**
 * =====================================================================================
 * SISTEMA DE INVENTARIO - LÓGICA PRINCIPAL DE LA APLICACIÓN (FRONTEND)
 * =====================================================================================
 * @description
 * Esta clase `InventoryApp` es el corazón de la interfaz de usuario. Se encarga de:
 * - Orquestar la carga inicial de datos.
 * - Manejar toda la interacción del usuario (clics en botones, filtros, búsquedas).
 * - Renderizar y actualizar la tabla de inventario y las estadísticas.
 * - Gestionar el modal para añadir y editar equipos.
 * - Comunicarse con la `GoogleSheetsAPI` para persistir los cambios en el backend.
 */
class InventoryApp {
  /**
   * @param {GoogleSheetsAPI} api - Una instancia de la clase GoogleSheetsAPI para la comunicación con el backend.
   */
  constructor(api) {
    this.api = api;
    this.inventoryData = []; // Contiene TODOS los datos del inventario (caché local).
    this.filteredData = []; // Contiene los datos que se muestran en la tabla después de aplicar filtros.
    this.currentModalMode = 'add'; // Puede ser 'add' o 'edit'.
    this.currentEditItemId = null; // Almacena el ID del item que se está editando.
    this.localStorageKey = 'inventoryData_v3'; // Clave para el almacenamiento local.

    this.init();
  }

  /**
   * @description Método de inicialización. Configura los listeners de eventos y carga los datos iniciales.
   */
  async init() {
    console.log('🚀 Inicializando la aplicación de inventario...');
    this.setupEventListeners();
    await this.loadInitialData();
    console.log('✅ Aplicación inicializada y lista.');
  }

  // --- MÉTODOS DE CARGA Y MANEJO DE DATOS ---

  /**
   * @description Carga los datos iniciales, priorizando el caché local para una carga rápida
   * y luego actualizando desde Google Sheets en segundo plano.
   */
  async loadInitialData() {
    this.showLoadingMessage('🔄 Cargando datos locales...');
    const localData = this.loadFromLocalStorage();
    if (localData && localData.length > 0) {
      console.log(`💾 Datos cargados desde caché local: ${localData.length} registros.`);
      this.inventoryData = localData;
      this.applyFiltersAndRender();
    }
    // Siempre intenta refrescar los datos desde la fuente autoritativa (Google Sheets).
    await this.refreshData();
  }

  /**
   * @description Fuerza la recarga de datos desde Google Sheets, actualiza el caché local
   * y re-renderiza la interfaz.
   */
  async refreshData() {
    this.showLoadingMessage('📡 Actualizando desde Google Sheets...');
    try {
      const data = await this.api.loadData();
      // Solo actualiza si la API devolvió datos válidos.
      if (data && Array.isArray(data)) {
        this.inventoryData = data;
        this.saveToLocalStorage();
        this.applyFiltersAndRender();
        this.showNotification('✅ Inventario actualizado correctamente.', 'success');
      } else {
        // Esto puede ocurrir si la API devuelve un error pero no lanza una excepción.
        throw new Error('No se recibieron datos válidos desde la API.');
      }
    } catch (error) {
      console.error('❌ Error al refrescar los datos:', error);
      this.showNotification('❌ No se pudieron actualizar los datos. Revisa la conexión o la configuración del script.', 'error');
      // Mantiene los datos locales si la actualización falla.
      this.applyFiltersAndRender();
    }
  }

  /**
   * @description Guarda el estado actual del inventario en el localStorage del navegador.
   */
  saveToLocalStorage() {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(this.inventoryData));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
      this.showNotification('No se pudo guardar el caché local.', 'warning');
    }
  }

  /**
   * @description Carga los datos del inventario desde el localStorage.
   * @returns {Array|null} - Los datos parseados o null si no hay nada.
   */
  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem(this.localStorageKey);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('Error al leer de localStorage:', e);
      return null;
    }
  }

  /**
   * @description Limpia el caché de datos del localStorage y fuerza una recarga desde el servidor.
   */
  clearLocalData() {
    if (confirm('¿Estás seguro de que quieres limpiar el caché local? Se forzará una recarga completa desde Google Sheets.')) {
      localStorage.removeItem(this.localStorageKey);
      this.inventoryData = [];
      this.filteredData = [];
      this.applyFiltersAndRender(); // Limpia la tabla visualmente.
      this.showNotification('🧹 Caché local limpiado.', 'info');
      this.refreshData();
    }
  }

  // --- MÉTODOS DE RENDERIZADO Y MANEJO DE LA INTERFAZ (UI) ---

  /**
   * @description Aplica todos los filtros actuales (búsqueda, departamento, estado)
   * a los datos del inventario y luego llama a `renderTable` y `updateStats`.
   */
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

  /**
   * @description Dibuja la tabla de inventario en el DOM con los datos filtrados.
   */
  renderTable() {
    const tableBody = document.getElementById('inventoryTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // Limpia la tabla antes de redibujar.

    if (this.filteredData.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="13" class="no-results">🚫 No se encontraron equipos con los filtros actuales.</td></tr>';
      return;
    }

    this.filteredData.forEach(item => {
      const row = document.createElement('tr');
      const itemId = item['N°']; // Usa el ID de la hoja de cálculo.
      row.dataset.itemId = itemId; // Añade el ID a la fila para referencia.
      row.innerHTML = `
        <td>${itemId || ''}</td>
        <td>${item.DESCRIPCION || ''}</td>
        <td>${item.MARCA || ''}</td>
        <td>${item.MODELO || ''}</td>
        <td>${item.SERIAL || ''}</td>
        <td>${item.ETIQUETA || ''}</td>
        <td>${item.SECTOR || ''}</td>
        <td><span class="status ${item.STATUS === 'OPERATIVO' ? 'operativo' : 'inoperativo'}">${item.STATUS || 'N/A'}</span></td>
        <td>${item.RESPONSABLE || ''}</td>
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

  /**
   * @description Actualiza las tarjetas de estadísticas (Total, Operativos, Inoperativos).
   */
  updateStats() {
    const total = this.inventoryData.length;
    const operativo = this.inventoryData.filter(item => item.STATUS === 'OPERATIVO').length;
    const inoperativo = total - operativo;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('operativoCount').textContent = operativo;
    document.getElementById('inoperativoCount').textContent = inoperativo;
  }

  // --- MANEJO DEL MODAL ---

  /**
   * @description Muestra el modal para añadir o editar un registro.
   * @param {string} mode - 'add' o 'edit'.
   * @param {string|number|null} itemId - El ID del item a editar (solo en modo 'edit').
   */
  showModal(mode = 'add', itemId = null) {
    this.currentModalMode = mode;
    this.currentEditItemId = itemId;

    const modal = document.getElementById('entryModal');
    const title = modal.querySelector('#modalTitle');
    const form = modal.querySelector('#entryForm');
    const saveButton = modal.querySelector('#saveButton');

    form.reset(); // Limpia el formulario de valores anteriores.

    if (mode === 'edit') {
      const item = this.inventoryData.find(d => String(d['N°']) === String(itemId));
      if (!item) {
        this.showNotification(`Error: No se encontró el equipo con ID: ${itemId}`, 'error');
        return;
      }
      title.innerHTML = `✏️ Editando Equipo (ID: <span class="row-number">${item['N°']}</span>)`;
      saveButton.innerHTML = '💾 Guardar Cambios';

      // Rellena el formulario con los datos del item.
      for (const key in item) {
        if (form.elements[key]) {
          form.elements[key].value = item[key];
        }
      }
    } else {
      title.innerHTML = '➕ Agregar Nuevo Equipo';
      saveButton.innerHTML = '💾 Agregar Equipo';
    }

    modal.style.display = 'flex';
  }

  /**
   * @description Cierra el modal de entrada.
   */
  closeModal() {
    document.getElementById('entryModal').style.display = 'none';
    this.currentEditItemId = null;
  }

  // --- MANEJO DE EVENTOS Y ACCIONES CRUD ---

  /**
   * @description Configura todos los event listeners de la aplicación para evitar अव्यवस्था en el HTML.
   */
  setupEventListeners() {
    // Usa delegación de eventos en la tabla para manejar los botones de acción.
    // Esto es más eficiente que añadir un listener a cada botón.
    document.getElementById('inventoryTableBody').addEventListener('click', (e) => {
        const button = e.target.closest('button.btn-action');
        if (button) {
            const action = button.dataset.action;
            const id = button.dataset.id;
            if (action === 'edit') this.showModal('edit', id);
            if (action === 'delete') this.handleDeleteItem(id);
        }
    });

    // Filtros y búsqueda
    document.getElementById('searchInput').addEventListener('input', () => this.applyFiltersAndRender());
    document.getElementById('deptoFilter').addEventListener('change', () => this.applyFiltersAndRender());
    document.getElementById('statusFilter').addEventListener('change', () => this.applyFiltersAndRender());

    // Botones de la cabecera
    document.getElementById('addNewBtn').addEventListener('click', () => this.showModal('add'));
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshData());
    document.getElementById('clearLocalBtn').addEventListener('click', () => this.clearLocalData());
    document.getElementById('exportBtn').addEventListener('click', () => {
        if (this.filteredData.length === 0) {
            this.showNotification('No hay datos filtrados para exportar.', 'warning');
            return;
        }
        const date = new Date().toISOString().split('T')[0];
        const filename = `inventario_equipos_${date}.xlsx`;
        exportToExcel(this.filteredData, filename);
        this.showNotification(`✅ Exportación completada: ${filename}`, 'success');
    });

    // Eventos del modal
    const entryModal = document.getElementById('entryModal');
    entryModal.querySelector('.close').addEventListener('click', () => this.closeModal());
    entryModal.querySelector('.btn-cancel').addEventListener('click', () => this.closeModal());
    entryModal.querySelector('#entryForm').addEventListener('submit', (e) => this.handleFormSubmit(e));
  }

  /**
   * @description Maneja el envío del formulario del modal (tanto para añadir como para editar).
   */
  async handleFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const itemData = Object.fromEntries(formData.entries());

    // Validación básica
    if (!itemData.DESCRIPCION || !itemData.SECTOR) {
      this.showNotification('Los campos "Descripción" y "Sector" son obligatorios.', 'error');
      return;
    }

    const actionText = this.currentModalMode === 'add' ? 'agregando' : 'actualizando';
    this.showLoadingMessage(`⏳ ${actionText} equipo...`);

    let result;
    if (this.currentModalMode === 'add') {
      result = await this.api.addInventoryItem(itemData);
    } else {
      result = await this.api.updateInventoryItem(this.currentEditItemId, itemData);
    }

    if (result.success) {
      this.showNotification(`✅ Equipo ${actionText.slice(0, -2)}ado correctamente.`, 'success');
      this.closeModal();
      await this.refreshData(); // Recarga los datos para mostrar el cambio.
    } else {
      this.showNotification(`❌ Error al ${actionText.slice(0, -2)}ar: ${result.error}`, 'error');
    }
  }

  /**
   * @description Maneja la lógica para eliminar un item.
   * @param {string|number} itemId - El ID del item a eliminar.
   */
  async handleDeleteItem(itemId) {
    if (!confirm(`¿Estás seguro de que quieres eliminar el equipo N° ${itemId}? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.showLoadingMessage('⏳ Eliminando equipo...');
    const result = await this.api.deleteInventoryItem(itemId);

    if (result.success) {
      this.showNotification('🗑️ Equipo eliminado permanentemente.', 'success');
      await this.refreshData(); // Recarga los datos para que el item desaparezca.
    } else {
      this.showNotification(`❌ Error al eliminar: ${result.error}`, 'error');
    }
  }

  // --- MÉTODOS DE NOTIFICACIÓN Y UTILIDADES ---

  /**
   * @description Muestra una notificación temporal de carga.
   * @param {string} message - El mensaje a mostrar.
   */
  showLoadingMessage(message = 'Cargando...') {
    this.showNotification(message, 'info', 2500);
  }

  /**
   * @description Muestra una notificación flotante en la esquina de la pantalla.
   * @param {string} message - El texto de la notificación.
   * @param {string} type - 'info', 'success', 'warning', o 'error'.
   * @param {number} duration - Duración en milisegundos.
   */
  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    // Elimina la notificación después de la duración especificada.
    setTimeout(() => notification.remove(), duration);
  }
}

// --- PUNTO DE ENTRADA DE LA APLICACIÓN ---
// Se asegura de que el DOM esté completamente cargado antes de inicializar la app.
document.addEventListener('DOMContentLoaded', () => {
  const api = new GoogleSheetsAPI();
  window.app = new InventoryApp(api); // Expone la app globalmente para depuración.
});