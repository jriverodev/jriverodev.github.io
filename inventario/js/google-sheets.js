class GoogleSheetsAPI {
  constructor() {
    // Este valor DEBE SER REEMPLAZADO en el Paso 3.
    this.scriptURL = 'PEGA_AQUÍ_LA_NUEVA_URL_DE_IMPLEMENTACIÓN';
  }

  async loadData() {
    console.log('📡 Cargando datos desde Google Sheets...');
    if (this.scriptURL === 'PEGA_AQUÍ_LA_NUEVA_URL_DE_IMPLEMENTACIÓN') {
      console.error('URL del script no configurada en google-sheets.js');
      return this.useSampleData();
    }
    try {
      const response = await fetch(this.scriptURL);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      console.log(`✅ Datos cargados: ${result.data.length} registros.`);
      return result.data;
    } catch (error) {
      console.error('❌ Error crítico al cargar desde Google Sheets:', error);
      return this.useSampleData(); // Devuelve datos de ejemplo en caso de fallo
    }
  }

  async sendAction(action, payload) {
    try {
      const response = await fetch(this.scriptURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      return result;
    } catch (error) {
      console.error(`❌ Fallo en la acción '${action}':`, error);
      return { success: false, error: error.message };
    }
  }

  addInventoryItem(newItem) { return this.sendAction('add', { newItem }); }
  updateInventoryItem(itemId, updates) { return this.sendAction('update', { itemId, updates }); }
  deleteInventoryItem(itemId) { return this.sendAction('delete', { itemId }); }
  
  useSampleData() {
    console.log('📋 Usando datos de ejemplo como respaldo.');
    return []; // Devuelve un array vacío para que la app no se bloquee
  }
}
