class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
        this.sheetName = 'INVENTARIO';
    }

    async loadData() {
        try {
            console.log('📡 Cargando datos desde Google Sheets...');
            
            // Método MEJORADO: Usar JSONP approach
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
            
            // Configurar timeout
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Timeout cargando datos'));
            }, 10000);
            
            const cleanup = () => {
                clearTimeout(timeout);
                if (window[callbackName]) {
                    delete window[callbackName];
                }
                if (script.parentNode) {
                    document.head.removeChild(script);
                }
            };
            
            // Configurar callback global
            window[callbackName] = (response) => {
                cleanup();
                if (response && response.table) {
                    const data = this.parseGoogleVisualization(response);
                    resolve(data);
                } else {
                    reject(new Error('Respuesta inválida de Google Sheets'));
                }
            };
            
            // Crear y agregar script
            const script = document.createElement('script');
            script.src = url;
            script.onerror = () => {
                cleanup();
                reject(new Error('Error de red'));
            };
            
            document.head.appendChild(script);
        });
    }

    parseGoogleVisualization(response) {
        if (!response.table || !response.table.rows) return [];
        
        const rows = response.table.rows;
        const data = [];
        
        // Headers predefinidos según tu estructura
        const headers = [
            'N°', 'DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 
            'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 
            'CEDULA', 'CARGO', 'OBSERVACIONES'
        ];
        
        rows.forEach((row, rowIndex) => {
            const item = {};
            
            headers.forEach((header, colIndex) => {
                if (row.c && row.c[colIndex]) {
                    item[header] = row.c[colIndex].v || '';
                } else {
                    item[header] = '';
                }
            });
            
            // Solo agregar si tiene al menos algún dato
            if (Object.values(item).some(value => value !== '')) {
                data.push(item);
            }
        });
        
        return data;
    }

    getSampleData() {
        console.log('🎭 Generando datos de ejemplo...');
        return [
            {
                'N°': '1',
                'DESCRIPCION': 'CPU',
                'MARCA': 'VIT',
                'MODELO': 'E2350-02',
                'SERIAL': 'A001339402',
                'ETIQUETA': '28017392',
                'SECTOR': 'SIGAL',
                'STATUS': 'OPERATIVO',
                'CUSTODIO RESPONSABLE': 'JUAN ESCALONA',
                'CEDULA': '15158639',
                'CARGO': 'SUPERVISOR',
                'OBSERVACIONES': 'Sistema funcionando - esperando conexión con Google Sheets'
            },
            {
                'N°': '2',
                'DESCRIPCION': 'LAPTOP',
                'MARCA': 'VIT',
                'MODELO': 'P3400',
                'SERIAL': 'S/I',
                'ETIQUETA': '1079390',
                'SECTOR': 'SIGAL',
                'STATUS': 'INOPERATIVO',
                'CUSTODIO RESPONSABLE': 'JUAN ESCALONA',
                'CEDULA': '15158639',
                'CARGO': 'SUPERVISOR',
                'OBSERVACIONES': 'En reparación - datos de ejemplo'
            },
            {
                'N°': '3',
                'DESCRIPCION': 'CPU',
                'MARCA': 'VIT',
                'MODELO': 'M21000101',
                'SERIAL': 'A001242529',
                'ETIQUETA': '1054941',
                'SECTOR': 'SIGAL',
                'STATUS': 'OPERATIVO',
                'CUSTODIO RESPONSABLE': 'MAROLOBIS',
                'CEDULA': 'S/I',
                'CARGO': 'S/I',
                'OBSERVACIONES': 'Datos de demostración'
            },
            {
                'N°': '4',
                'DESCRIPCION': 'MONITOR',
                'MARCA': 'VIT',
                'MODELO': 'TFT19W80PS',
                'SERIAL': 'AS9C7BA000345',
                'ETIQUETA': '1041598',
                'SECTOR': 'SALA DE OPERACIONES',
                'STATUS': 'OPERATIVO',
                'CUSTODIO RESPONSABLE': 'GUSTAVO ACOSTA',
                'CEDULA': '15017120',
                'CARGO': 'CAPATAZ TRANSPORTE DE PERSONAL LL',
                'OBSERVACIONES': 'Ejemplo de monitor'
            },
            {
                'N°': '5',
                'DESCRIPCION': 'TECLADO',
                'MARCA': 'IBM',
                'MODELO': 'SK-811',
                'SERIAL': '1061581',
                'ETIQUETA': 'S/E',
                'SECTOR': 'SALA DE OPERACIONES',
                'STATUS': 'OPERATIVO',
                'CUSTODIO RESPONSABLE': 'GUSTAVO ACOSTA',
                'CEDULA': '15017120',
                'CARGO': 'CAPATAZ TRANSPORTE DE PERSONAL LL',
                'OBSERVACIONES': 'Teclado funcional - datos de ejemplo'
            },
            {
                'N°': '6',
                'DESCRIPCION': 'IMPRESORA',
                'MARCA': 'HP',
                'MODELO': 'LaserJet Pro',
                'SERIAL': 'ABC123456',
                'ETIQUETA': '20004567',
                'SECTOR': 'TLA',
                'STATUS': 'OPERATIVO',
                'CUSTODIO RESPONSABLE': 'CARLOS URDANETA',
                'CEDULA': '14496254',
                'CARGO': 'INSPECTOR OPERACIONAL',
                'OBSERVACIONES': 'Impresora láser - datos de demostración'
            }
        ];
    }
}
