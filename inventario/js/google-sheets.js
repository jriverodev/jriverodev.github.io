/**
 * GoogleSheetsAPI - Cliente para la API de Google Sheets
 *
 * Se comunica con el backend de Google Apps Script (Code.gs) para
 * realizar operaciones de lectura y escritura.
 */
class GoogleSheetsAPI {
    constructor() {
        this.config = {
            // IMPORTANTE: Reemplaza esta URL por la de tu Web App desplegada.
            webAppUrl: 'https://script.google.com/macros/s/AKfycbyCTLdRAPiX_7q01UIAQtZk3JtLjPUKdHTTlamNqOVSPiVtQ51T8lfsLOo5yhcKniw0/exec'
        };
    }

    /**
     * Carga todos los datos del inventario desde la Web App.
     * Realiza una petición GET al script.
     */
    async loadData() {
        console.log('📡 Cargando datos desde Google Sheets...');
        if (!this.config.webAppUrl || this.config.webAppUrl.includes('AKfycb...')) {
            const errorMsg = 'La URL de la Web App no está configurada en google-sheets.js.';
            console.error(`❌ ${errorMsg}`);
            return Promise.reject(new Error(errorMsg));
        }

        try {
            const response = await fetch(this.config.webAppUrl);
            if (!response.ok) {
                throw new Error(`Error en la respuesta de la red: ${response.statusText}`);
            }
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'La API de Google devolvió un error al cargar datos.');
            }

            console.log(`✅ Datos de Google Sheets cargados: ${result.data.length} registros.`);
            return result.data;

        } catch (error) {
            console.error('❌ Error crítico al cargar desde Google Sheets:', error);
            console.log('📋 Usando datos de ejemplo como respaldo...');
            return this.getSampleData(); // Devolver datos de ejemplo si todo lo demás falla
        }
    }

    /**
     * Envía una acción (add, update, delete) a la Web App.
     * Realiza una petición POST con los datos necesarios.
     */
    async sendAction(action, data) {
        if (!this.config.webAppUrl || this.config.webAppUrl.includes('AKfycb...')) {
            const errorMsg = 'La URL de la Web App no está configurada.';
            console.error(`❌ ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        
        console.log(`📤 Enviando acción '${action}' a Google Sheets...`, data);
        
        try {
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'La API de Google devolvió un error no especificado.');
            }

            console.log(`✅ Acción '${action}' exitosa:`, result);
            return result;

        } catch (error) {
            console.error(`❌ Fallo en la acción '${action}':`, error);
            return { success: false, error: error.message };
        }
    }

    // --- MÉTODOS DE INTERFAZ PÚBLICA ---

    addInventoryItem(newItem) {
        // El 'N°' lo asignará el script, así que lo podemos omitir.
        const { ['N°']: _, ...itemToSend } = newItem;
        return this.sendAction('add', { newItem: itemToSend });
    }

    updateInventoryItem(itemId, updates) {
        // El backend espera 'itemId' para identificar el registro.
        return this.sendAction('update', { itemId, updates });
    }
    
    deleteInventoryItem(itemId) {
        // El backend espera 'itemId' para la eliminación.
        return this.sendAction('delete', { itemId });
    }

    // --- DATOS DE EJEMPLO (FALLBACK) ---
    getSampleData() {
        console.log("📋 Generando datos de ejemplo para demostración.");
        return [
            { 'N°': '1', 'DESCRIPCION': 'LAPTOP DEMO', 'MARCA': 'HP', 'MODELO': 'ELITEBOOK', 'SERIAL': 'DEMO111', 'ETIQUETA': '1041594', 'SECTOR': 'SIGAL', 'STATUS': 'OPERATIVO', 'CUSTODIO RESPONSABLE': 'JESÚS RIVERO', 'CEDULA': '18635848', 'CARGO': 'JEFE DE INFORMÁTICA', 'OBSERVACIONES': 'Este es un dato de ejemplo.' },
            { 'N°': '2', 'DESCRIPCION': 'MONITOR DEMO', 'MARCA': 'SAMSUNG', 'MODELO': 'SYNCMASTER', 'SERIAL': 'DEMO222', 'ETIQUETA': '1041595', 'SECTOR': 'SALA DE OPERACIONES', 'STATUS': 'INOPERATIVO', 'CUSTODIO RESPONSABLE': 'ANTONIO PEREZ', 'CEDULA': '15017121', 'CARGO': 'OPERADOR', 'OBSERVACIONES': 'Pantalla dañada.' },
        ];
    }
}
