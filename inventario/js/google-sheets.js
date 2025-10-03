class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
        this.sheetName = 'INVENTARIO';
        // *** IMPORTANTE: DEBES REEMPLAZAR ESTA URL CON LA URL DE TU WEB APP DESPLEGADA ***
        this.WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwO7ge--VuiGRWV1ZkJAaXvcd11giM7lZ-cTgtyunKEChADHkA3N4uNlDXEh8OvkYc/exec'; 
    }

    // --- LECTURA (JSONP para evitar CORS) ---

    async loadData() {
        try {
            console.log('📡 Cargando datos desde Google Sheets...');
            const data = await this.loadWithJSONP();
            if (data && data.length > 0) {
                console.log('✅ Datos reales cargados:', data.length, 'registros');
                return data;
            } else {
                throw new Error('No se pudieron cargar datos reales');
            }
        } catch (error) {
            console.error('❌ Error cargando datos reales:', error);
            console.log('📋 Usando datos de ejemplo...');
            return this.getSampleData();
        }
    }

    loadWithJSONP() {
        return new Promise((resolve, reject) => {
            const callbackName = 'googleSheetsCallback_' + Date.now();
            const url = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${this.sheetName}`;
            
            const timeout = setTimeout(() => { cleanup(); reject(new Error('Timeout cargando datos')); }, 10000);
            
            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                document.getElementById(scriptId)?.remove();
            };
            
            window[callbackName] = (response) => {
                cleanup();
                const data = this.parseGoogleVisualization(response);
                resolve(data);
            };
            
            const script = document.createElement('script');
            const scriptId = 'jsonp_' + callbackName;
            script.id = scriptId;
            script.src = url;
            script.onerror = () => {
                cleanup();
                reject(new Error('Error al cargar el script JSONP.'));
            };
            document.head.appendChild(script);
        });
    }

    parseGoogleVisualization(response) {
        const headers = ['N°', 'DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES'];
        const data = [];
        if (response.table && response.table.rows) {
            response.table.rows.forEach((row) => {
                const item = {};
                headers.forEach((header, index) => {
                    // La propiedad 'v' contiene el valor
                    item[header] = row.c[index]?.v || '';
                    if (typeof item[header] === 'object' && item[header] !== null) {
                        // Manejo de fechas que a veces viene como objeto
                        item[header] = item[header].v; 
                    }
                    if (item[header] === null || item[header] === undefined) {
                        item[header] = '';
                    }
                });
                data.push(item);
            });
        }
        return data;
    }

    getSampleData() {
        return [
            { 'N°': '1', 'DESCRIPCION': 'LAPTOP', 'MARCA': 'HP', 'MODELO': 'ELITEBOOK', 'SERIAL': 'XXX111', 'ETIQUETA': '1041594', 'SECTOR': 'SIGAL', 'STATUS': 'OPERATIVO', 'CUSTODIO RESPONSABLE': 'JESÚS RIVERO', 'CEDULA': '18635848', 'CARGO': 'JEFE DE INFORMÁTICA', 'OBSERVACIONES': 'Equipo personal del jefe' },
            { 'N°': '2', 'DESCRIPCION': 'MONITOR', 'MARCA': 'SAMSUNG', 'MODELO': 'SYNCMASTER', 'SERIAL': 'AS9C7BA000346', 'ETIQUETA': '1041595', 'SECTOR': 'SALA DE OPERACIONES', 'STATUS': 'INOPERATIVO', 'CUSTODIO RESPONSABLE': 'ANTONIO PEREZ', 'CEDULA': '15017121', 'CARGO': 'OPERADOR', 'OBSERVACIONES': 'Pantalla dañada - requiere reemplazo' },
            { 'N°': '3', 'DESCRIPCION': 'UPS', 'MARCA': 'APC', 'MODELO': 'Back-UPS Pro', 'SERIAL': 'XYZ987', 'ETIQUETA': '20004565', 'SECTOR': 'MTTO', 'STATUS': 'OPERATIVO', 'CUSTODIO RESPONSABLE': 'MARIA GONZALEZ', 'CEDULA': '15017122', 'CARGO': 'TÉCNICO', 'OBSERVACIONES': 'Batería nueva' },
        ];
    }

    // --- ESCRITURA (Fetch/POST a Web App) ---

    async sendAction(action, data) {
        if (this.WEB_APP_URL.includes('AKfycb...')) {
             console.error('❌ ERROR: WEB_APP_URL no configurada. No se puede escribir.');
             return { success: false, error: 'WEB_APP_URL no configurada' };
        }
        
        console.log(`📤 Enviando acción ${action} a Google Sheets...`);
        
        const payload = {
            action: action,
            ...data
        };

        try {
            const response = await fetch(this.WEB_APP_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
            });

            // Apps Script siempre devuelve JSON en doPost, lo parseamos
            const result = await response.json();
            
            if (!response.ok || !result.success) {
                throw new Error(result.error || `Error HTTP: ${response.status}`);
            }

            console.log(`✅ Acción ${action} exitosa:`, result);
            return result;

        } catch (error) {
            console.error(`❌ Fallo en la acción ${action}:`, error);
            return { success: false, error: error.message || 'Error desconocido al comunicarse con el servidor.' };
        }
    }

    // Métodos específicos (para mejorar legibilidad en app.js)

    async addInventoryItem(newItem) {
        return this.sendAction('add', { newItem: newItem });
    }

    async updateInventoryItem(rowIndex, updates) {
        return this.sendAction('update', { rowIndex: rowIndex, updates: updates });
    }
    
    // El Apps Script realiza la eliminación física (hard-delete)
    async deleteInventoryItem(rowIndex) {
        return this.sendAction('delete', { rowIndex: rowIndex });
    }
}
