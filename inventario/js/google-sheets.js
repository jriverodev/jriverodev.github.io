
class GoogleSheetsAPI {
  constructor() {
    // REEMPLAZA ESTA URL con la URL de tu implementación de Google Apps Script
    this.scriptURL = 'https://script.google.com/macros/s/AKfycbyCTLdRAPiX_7q01UIAQtZk3JtLjPUKdHTTlamNqOVSPiVtQ51T8lfsLOo5yhcKniw0/exec';
  }

  async loadData() {
    console.log('📡 Cargando datos desde Google Sheets...');
    try {
      const response = await fetch(this.scriptURL);
      if (!response.ok) {
        throw new Error(`Error en la respuesta de la red: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(`Error en el script de Google: ${result.error}`);
      }
      console.log(`✅ Datos de Google Sheets cargados: ${result.data.length} registros.`);
      return result.data;
    } catch (error) {
      console.error('❌ Error crítico al cargar desde Google Sheets:', error);
      this.useSampleData();
      throw error; // Propaga el error para que la app sepa que falló
    }
  }

  async sendAction(action, payload) {
    console.log(`📤 Enviando acción '${action}' a Google Sheets...`, payload);
    try {
      const response = await fetch(this.scriptURL, {
        method: 'POST',
        // ¡ESTA ES LA LÍNEA CLAVE QUE SOLUCIONA EL PROBLEMA!
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
      });
      
      // Con 'no-cors', no podemos leer la respuesta, así que asumimos que fue exitosa si no hay un error de red.
      console.log(`✅ Acción '${action}' enviada (respuesta opaca).`);
      return { success: true };

    } catch (error) {
      console.error(`❌ Fallo en la acción '${action}':`, error);
      return { success: false, error: error.message };
    }
  }

  // Métodos de conveniencia para las acciones CRUD
  addInventoryItem(newItem) {
    return this.sendAction('add', { newItem });
  }

  updateInventoryItem(itemId, updates) {
    return this.sendAction('update', { itemId, updates });
  }

  deleteInventoryItem(itemId) {
    return this.sendAction('delete', { itemId });
  }

  // --- Respaldo con Datos de Ejemplo ---
  useSampleData() {
    console.log('📋 Usando datos de ejemplo como respaldo...');
    // Esta función podría generar datos de ejemplo si la carga falla
  }
}
