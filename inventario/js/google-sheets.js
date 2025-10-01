class GoogleSheetsAPI {
    constructor() {
        this.SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
        this.sheetName = 'INVENTARIO';
    }

    async loadData() {
        return new Promise((resolve, reject) => {
            // Usar JSONP para evitar CORS
            const callbackName = 'jsonpCallback_' + Date.now();
            const url = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=responseHandler:${callbackName}&sheet=${this.sheetName}`;
            
            // Crear script para JSONP
            const script = document.createElement('script');
            script.src = url;
            
            // Definir la función callback global
            window[callbackName] = (data) => {
                document.head.removeChild(script);
                delete window[callbackName];
                resolve(this.parseGoogleData(data));
            };
            
            script.onerror = () => {
                document.head.removeChild(script);
                delete window[callbackName];
                reject(new Error('Error cargando datos'));
            };
            
            document.head.appendChild(script);
        });
    }

    parseGoogleData(data) {
        if (!data || !data.table || !data.table.rows) return [];
        
        const rows = data.table.rows;
        const result = [];
        
        rows.forEach((row, rowIndex) => {
            const item = {};
            row.c.forEach((cell, colIndex) => {
                // Mapear columnas según tu estructura
                const headers = [
                    'N°', 'DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 
                    'ETIQUETA', 'SECTOR', 'STATUS', 'CUSTODIO RESPONSABLE', 
                    'CEDULA', 'CARGO', 'OBSERVACIONES'
                ];
                
                if (headers[colIndex]) {
                    item[headers[colIndex]] = cell ? cell.v : '';
                }
            });
            result.push(item);
        });
        
        return result;
    }
}
