class GoogleSheetsAPI {
  constructor() {
    // IMPORTANTE: Debes reemplazar esta URL por la URL de tu propia implementación de Google Apps Script.
    // Sigue las instrucciones en el archivo DEPLOYMENT_GUIDE.md para obtener tu URL.
    this.scriptURL = 'REEMPLAZA_ESTA_URL_CON_LA_TUYA';
  }

  async loadData() {
    console.log('📡 Cargando datos desde Google Sheets...');
    try {
      const response = await fetch(this.scriptURL);
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      console.log(`✅ Datos cargados: ${result.data.length} registros.`);
      return result.data;
    } catch (error) {
      console.error('❌ Error crítico al cargar desde Google Sheets:', error);
      return this.useSampleData();
    }
  }

  async sendAction(action, payload) {
    try {
      const response = await fetch(this.scriptURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    } catch (error) {
      console.error(`❌ Fallo en la acción '${action}':`, error);
      return { success: false, error: error.message };
    }
  }

  addInventoryItem(newItem) {
    return this.sendAction('add', { newItem });
  }

  updateInventoryItem(itemId, updates) {
    return this.sendAction('update', { itemId, updates });
  }

  deleteInventoryItem(itemId) {
    return this.sendAction('delete', { itemId });
  }
  
  useSampleData() {
    console.log('📋 Usando datos de ejemplo como respaldo.');
    return [];
  }
}
