class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
        this.sheetName = 'INVENTARIO';
    }

    async loadData() {
        try {
            console.log('📡 Intentando cargar datos...');
            
            // Método 1: Usar proxy diferente
            const data = await this.tryMethod1();
            console.log('✅ Datos cargados con método 1');
            return data;
            
        } catch (error1) {
            console.error('❌ Método 1 falló:', error1);
            
            try {
                // Método 2: Otro proxy
                const data = await this.tryMethod2();
                console.log('✅ Datos cargados con método 2');
                return data;
                
            } catch (error2) {
                console.error('❌ Método 2 falló:', error2);
                
                // Método 3: Datos de ejemplo mejorados
                console.log('📋 Usando datos de ejemplo...');
                return this.getSampleData();
            }
        }
    }

    async tryMethod1() {
        // Proxy 1: allOrigins con formato raw
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.sheetName}`;
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        return this.parseCSV(csvText);
    }

    async tryMethod2() {
        // Proxy 2: cors-anywhere alternativo
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${this.sheetName}`;
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`;
        
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        return this.parseCSV(csvText);
    }

    parseCSV(csvText) {
        console.log('📊 Parseando CSV...');
        
        const lines = csvText.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
            console.warn('⚠️ CSV vacío');
            return this.getSampleData();
        }
        
        const headers = this.parseCSVLine(lines[0]);
        console.log('📋 Headers:', headers);
        
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            
            if (values.length > 0 && values.some(val => val.trim() !== '')) {
                const item = {};
                
                headers.forEach((header, index) => {
                    item[header] = values[index] || '';
                });
                
                data.push(item);
            }
        }
        
        console.log(`✅ ${data.length} registros procesados`);
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
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
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
                'OBSERVACIONES': 'Sistema funcionando con datos de ejemplo'
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
                'OBSERVACIONES': 'Teclado funcional'
            }
        ];
    }
}
