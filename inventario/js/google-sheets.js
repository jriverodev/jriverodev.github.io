class GoogleSheetsAPI {
    constructor() {
        // --- CONFIGURACIÓN ---
        // Mueve todos los valores configurables a este objeto para fácil acceso.
        this.config = {
            spreadsheetId: '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c',
            sheetName: 'INVENTARIO',
            // IMPORTANTE: Esta URL debe ser reemplazada por la URL de tu propia
            // Google Apps Script Web App desplegada. De lo contrario, las operaciones
            // de escritura (agregar, editar, eliminar) no funcionarán.
            webAppUrl: 'https://script.google.com/macros/s/AKfycbwO7ge--VuiGRWV1ZkJAaXvcd11giM7lZ-cTgtyunKEChADHkA3N4uNlDXEh8OvkYc/exec'
        };
    }

    // --- LECTURA DE DATOS (usando JSONP para evitar problemas de CORS) ---

    async loadData() {
        console.log('📡 Cargando datos desde Google Sheets...');
        try {
            // Se utiliza JSONP para leer datos de una hoja de cálculo pública de Google.
            // Esto es un truco común para eludir las restricciones de CORS del navegador
            // sin necesidad de un backend intermediario.
            const data = await this.loadWithJSONP();
            if (!data || data.length === 0) {
                console.warn('⚠️ No se recibieron datos de Google Sheets, se usarán datos de ejemplo.');
                return this.getSampleData();
            }
            console.log(`✅ Datos de Google Sheets cargados: ${data.length} registros.`);
            return data;
        } catch (error) {
            console.error('❌ Error crítico al cargar datos de Google Sheets:', error);
            console.log('📋 Usando datos de ejemplo como respaldo...');
            return this.getSampleData();
        }
    }

    loadWithJSONP() {
        return new Promise((resolve, reject) => {
            const callbackName = `googleSheetsCallback_${Date.now()}`;
            const scriptId = `jsonp_${callbackName}`;
            const url = `https://docs.google.com/spreadsheets/d/${this.config.spreadsheetId}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${this.config.sheetName}`;

            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout: La solicitud a Google Sheets ha tardado demasiado.'));
            }, 10000);

            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                document.getElementById(scriptId)?.remove();
            };

            window[callbackName] = (response) => {
                cleanup();
                if (response.status === 'error') {
                    const errorMessage = response.errors.map(e => e.detailed_message).join(', ');
                    reject(new Error(`Error de Google Sheets: ${errorMessage}`));
                    return;
                }
                const data = this.parseGoogleVisualization(response);
                resolve(data);
            };

            const script = document.createElement('script');
            script.id = scriptId;
            script.src = url;
            script.onerror = () => {
                cleanup();
                reject(new Error('Error de red al intentar cargar el script de Google Sheets.'));
            };
            document.head.appendChild(script);
        });
    }

    normalizeHeader(header) {
        const upperHeader = (header || '').toUpperCase().trim();
        const headerMap = {
            'CUSTODIO RESPONSABLE': 'RESPONSABLE',
            'Nº': 'N°',
            'NO.': 'N°',
            'NUMERO': 'N°',
            'SERIALES': 'SERIAL',
            'ETIQUETAS': 'ETIQUETA',
            'OBSERVACION': 'OBSERVACIONES',
            'ESTADO': 'STATUS'
        };
        return headerMap[upperHeader] || upperHeader;
    }

    parseGoogleVisualization(response) {
        if (!response || !response.table || !response.table.cols || !response.table.rows) {
            console.warn("La respuesta de Google Visualization API no tiene el formato esperado.");
            return [];
        }

        const headers = response.table.cols.map(col => this.normalizeHeader(col.label || col.id));

        const data = response.table.rows.map(row => {
            const item = {};
            headers.forEach((header, index) => {
                if (!header) return; // Ignorar columnas sin cabecera
                const cell = row.c[index];
                item[header] = cell ? (cell.f || cell.v) : ''; // Priorizar valor formateado 'f'
            });
            return item;
        });

        return data;
    }

    getSampleData() {
        console.log("📋 Generando datos de ejemplo para demostración.");
        return [
            { 'N°': '1', 'DESCRIPCION': 'LAPTOP DEMO', 'MARCA': 'HP', 'MODELO': 'ELITEBOOK', 'SERIAL': 'DEMO111', 'ETIQUETA': '1041594', 'SECTOR': 'SIGAL', 'STATUS': 'OPERATIVO', 'RESPONSABLE': 'JESÚS RIVERO', 'CEDULA': '18635848', 'CARGO': 'JEFE DE INFORMÁTICA', 'OBSERVACIONES': 'Este es un dato de ejemplo.' },
            { 'N°': '2', 'DESCRIPCION': 'MONITOR DEMO', 'MARCA': 'SAMSUNG', 'MODELO': 'SYNCMASTER', 'SERIAL': 'DEMO222', 'ETIQUETA': '1041595', 'SECTOR': 'SALA DE OPERACIONES', 'STATUS': 'INOPERATIVO', 'RESPONSABLE': 'ANTONIO PEREZ', 'CEDULA': '15017121', 'CARGO': 'OPERADOR', 'OBSERVACIONES': 'Pantalla dañada.' },
        ];
    }

    // --- ESCRITURA (a través de Google Apps Script Web App) ---

    async sendAction(action, data) {
        // Validar que la URL de la Web App ha sido configurada.
        if (!this.config.webAppUrl || this.config.webAppUrl.includes('AKfycb...')) {
            const errorMsg = 'La URL de la Web App de Google no está configurada. Las operaciones de escritura están deshabilitadas.';
            console.error(`❌ ${errorMsg}`);
            return { success: false, error: errorMsg };
        }
        
        console.log(`📤 Enviando acción '${action}' a Google Sheets...`, data);
        
        try {
            const response = await fetch(this.config.webAppUrl, {
                method: 'POST',
                mode: 'cors', // El script de Google debe permitirlo
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

    // --- Métodos de Interfaz Pública ---
    // Estos métodos simplifican las llamadas desde InventoryApp.

    addInventoryItem(newItem) {
        // El 'N°' lo asignará el script de Google para evitar duplicados.
        const { ['N°']: _, ...itemToSend } = newItem;
        return this.sendAction('add', { newItem: itemToSend });
    }

    updateInventoryItem(itemNumber, updates) {
        // Asegurarse de que el N° (identificador de fila) se envía.
        return this.sendAction('update', { itemNumber, updates });
    }
    
    deleteInventoryItem(itemNumber) {
        return this.sendAction('delete', { itemNumber });
    }
}
