class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c'; // Reemplazar con tu ID
        this.API_KEY = 'TU_API_KEY_AQUI'; // Opcional para solo lectura
        this.sheetName = 'INVENTARIO';
    }

    async loadData() {
        try {
            // Método 1: Usando Google Sheets API (necesita API Key)
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.SPREADSHEET_ID}/values/${this.sheetName}?key=${this.API_KEY}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            return this.parseSheetData(data.values);
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            // Método 2: Fallback con CSV público
            return this.loadCSVFallback();
        }
    }

    parseSheetData(rows) {
        if (!rows || rows.length < 2) return [];
        
        const headers = rows[0];
        const data = [];
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const item = {};
            
            headers.forEach((header, index) => {
                item[header] = row[index] || '';
            });
            
            data.push(item);
        }
        
        return data;
    }

    async loadCSVFallback() {
        // Alternativa: Exportar Google Sheet como CSV público
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv`;
        
        const response = await fetch(csvUrl);
        const csvText = await response.text();
        
        return this.parseCSV(csvText);
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
            const item = {};
            
            headers.forEach((header, index) => {
                item[header] = values[index] || '';
            });
            
            data.push(item);
        }
        
        return data;
    }
}
