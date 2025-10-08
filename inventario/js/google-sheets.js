// google-sheets.js
// Official Google Sheets API implementation for reading data

class GoogleSheetsAPI {
    constructor() {
        // --- CONFIGURATION: Replace with your values ---
        this.config = {
            // Your Google Sheets Spreadsheet ID (from the sheet's URL)
            spreadsheetId: '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c', // e.g., '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
            // Your API key from Google Cloud Console
            apiKey: 'https://script.google.com/macros/s/AKfycbwO7ge--VuiGRWV1ZkJAaXvcd11giM7lZ-cTgtyunKEChADHkA3N4uNlDXEh8OvkYc/exec',
            // The name of the specific sheet/tab within your spreadsheet
            sheetName: 'INVENTARIO'
        };

        // API discovery document and required permissions (read-only in this case)
        this.discoveryDoc = 'https://sheets.googleapis.com/$discovery/rest?version=v4';
        this.scopes = 'https://www.googleapis.com/auth/spreadsheets.readonly';
        
        this.gapiInited = false;
        this.gisInited = false;
    }

    /**
     * Initializes the Google API client. This must be called before any other operations.
     * Include the Google API script in your HTML: <script async defer src="https://apis.google.com/js/api.js"></script>
     */
    async initializeGapiClient() {
        console.log('🔄 Initializing Google API client...');
        try {
            await gapi.client.init({
                apiKey: this.config.apiKey,
                discoveryDocs: [this.discoveryDoc],
            });
            this.gapiInited = true;
            console.log('✅ Google API client initialized.');
        } catch (error) {
            console.error('❌ Error initializing Google API client:', error);
        }
    }

    /**
     * Main function to load data from the configured Google Sheet.
     * @returns {Promise<Array>} A promise that resolves with an array of inventory items.
     */
    async loadData() {
        console.log('📡 Loading data from Google Sheets via API...');
        
        // Ensure the API client is initialized
        if (!this.gapiInited) {
            console.log('Google API client not ready, initializing...');
            await this.initializeGapiClient();
        }

        try {
            // Use the spreadsheets.values.get method of the Sheets API
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: this.config.spreadsheetId,
                range: `${this.config.sheetName}!A:Z`, // Adjust range as needed (A:Z gets all columns)
            });

            const data = this.parseSheetData(response.result);
            console.log(`✅ Data loaded successfully: ${data.length} records processed.`);
            return data;

        } catch (error) {
            console.error('❌ Fatal error loading from Google Sheets API:', error);
            // Fallback to sample data if the API call fails
            console.log('📋 Falling back to sample data...');
            return this.getSampleData();
        }
    }

    /**
     * Parses the raw data from the Sheets API into a structured array of objects.
     * Assumes the first row contains the headers/column names.
     * @param {Object} result The result object from the Sheets API.
     * @returns {Array} An array of objects representing the sheet rows.
     */
    parseSheetData(result) {
        if (!result || !result.values || result.values.length === 0) {
            console.warn('⚠️ No data found in the sheet or range.');
            return [];
        }

        const rows = result.values;
        const headers = rows[0].map(header => this.normalizeHeader(header)); // Normalize the headers from the first row

        // Start from the second row (index 1) to skip the header row
        const data = rows.slice(1).map((row, rowIndex) => {
            const item = {};
            headers.forEach((header, colIndex) => {
                // Map each header to the corresponding cell value; use empty string if cell is undefined
                item[header] = row[colIndex] || '';
            });
            // Assign a unique ID for internal tracking
            item.uniqueId = `row_${rowIndex}_${Date.now()}`;
            return item;
        });

        // Filter out completely empty rows
        return data.filter(item => Object.values(item).some(value => value !== ''));
    }

    /**
     * Normalizes header names to ensure consistent keys in the data objects.
     * @param {string} header The original header string from the sheet.
     * @returns {string} The normalized header string.
     */
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

    /**
     * Provides sample data as a fallback in case the API request fails.
     * @returns {Array} An array of sample inventory items.
     */
    getSampleData() {
        console.log("📋 Generating sample data for demonstration.");
        return [
            { 'N°': '1', 'DESCRIPCION': 'LAPTOP DEMO', 'MARCA': 'HP', 'MODELO': 'ELITEBOOK', 'SERIAL': 'DEMO111', 'ETIQUETA': '1041594', 'SECTOR': 'SIGAL', 'STATUS': 'OPERATIVO', 'RESPONSABLE': 'JESÚS RIVERO', 'CEDULA': '18635848', 'CARGO': 'JEFE DE INFORMÁTICA', 'OBSERVACIONES': 'Este es un dato de ejemplo.', 'uniqueId': 'sample_1' },
            { 'N°': '2', 'DESCRIPCION': 'MONITOR DEMO', 'MARCA': 'SAMSUNG', 'MODELO': 'SYNCMASTER', 'SERIAL': 'DEMO222', 'ETIQUETA': '1041595', 'SECTOR': 'SALA DE OPERACIONES', 'STATUS': 'INOPERATIVO', 'RESPONSABLE': 'ANTONIO PEREZ', 'CEDULA': '15017121', 'CARGO': 'OPERADOR', 'OBSERVACIONES': 'Pantalla dañada.', 'uniqueId': 'sample_2' },
        ];
    }
}

// --- Load the Google API Client Library ---
/* 
 * This function is called automatically when the external 'api.js' script loads.
 * Add this script to your HTML: <script async defer src="https://apis.google.com/js/api.js" onload="gapiLoaded()"></script>
 */
function gapiLoaded() {
    gapi.load('client', () => {
        // The client is loaded, but we'll initialize it when the GoogleSheetsAPI class is instantiated.
        console.log('🎉 Google API client library loaded.');
    });
}

// Make the class available globally if needed
window.GoogleSheetsAPI = GoogleSheetsAPI;
