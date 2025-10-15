class GoogleSheetsAPI {
  constructor() {
    // URL de tu implementación. ¡Está correcta!
    this.scriptURL = 'https://script.google.com/macros/s/AKfycbyCTLdRAPiX_7q01UIAQtZk3JtLjPUKdHTTlamNqOVSPiVtQ51T8lfsLOo5yhcKniw0/exec';
  }

  async loadData() {
    console.log('📡 Cargando datos desde Google Sheets...');
    try {
      // Se intenta la carga de datos directamente.
      const response = await fetch(this.scriptURL);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      console.log(`✅ Datos cargados: ${result.data.length} registros.`);
      return result.data;

    } catch (error) {
      console.error('❌ Error crítico al cargar desde Google Sheets:', error);
      return this.useSampleData(); // Devuelve datos de ejemplo solo si hay un error real.
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
    return []; // Devuelve un array vacío para que la app no se bloquee.
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
