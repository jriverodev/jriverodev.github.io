class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
        this.sheetName = 'INVENTARIO';
    }

    async loadData() {
        try {
            console.log('📡 Cargando datos desde Google Sheets...');
            
            // Método 1: Usar CORS proxy público
            const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.sheetName}`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(csvUrl)}`;
            
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            
            const data = await response.json();
            const csvText = data.contents;
            
            console.log('✅ Datos cargados exitosamente');
            return this.parseCSV(csvText);
            
        } catch (error) {
            console.error('❌ Error con proxy:', error);
            
            // Método 2: Intentar sin proxy (puede fallar por CORS)
            try {
                console.log('🔄 Intentando método alternativo...');
                return await this.loadWithoutProxy();
            } catch (fallbackError) {
                console.error('❌ Todos los métodos fallaron:', fallbackError);
                // Método 3: Datos de ejemplo
                console.log('📋 Cargando datos de ejemplo...');
                return this.getSampleData();
            }
        }
    }

    async loadWithoutProxy() {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.sheetName}`;
        const response = await fetch(csvUrl);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        return this.parseCSV(csvText);
    }

    parseCSV(csvText) {
        console.log('📊 Parseando datos CSV...');
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            console.warn('⚠️ CSV vacío o con pocas líneas');
            return this.getSampleData();
        }
        
        // Parsear headers
        const headers = this.parseCSVLine(lines[0]);
        console.log('📋 Headers encontrados:', headers);
        
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            
            // Solo procesar filas con datos
            if (values.some(value => value.trim() !== '')) {
                const item = {};
                
                headers.forEach((header, index) => {
                    item[header] = values[index] || '';
                });
                
                data.push(item);
            }
        }
        
        console.log(`✅ ${data.length} registros parseados`);
        return data;
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result.map(field => field.replace(/^"|"$/g, ''));
    }

    getSampleData() {
        console.log('🎭 Cargando datos de ejemplo...');
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
                'OBSERVACIONES': 'Ejemplo de datos'
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
                'OBSERVACIONES': 'En reparación'
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
                'OBSERVACIONES': ''
            }
        ];
    }
}
