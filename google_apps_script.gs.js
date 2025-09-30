// =======================================================
// SISTEMA DE REPORTES - VERSIÓN JSONP
// =======================================================

const CONFIG = {
  SHEET_NAME: 'Reportes',
  DATA_SHEET: 'Datos_Choferes',
  HEADERS: ['timestamp', 'cedula', 'nombre', 'organizacion', 'gerencia', 'placa', 'estado', 'observaciones']
};

// Función de inicialización
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Hoja de reportes
  let reportSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!reportSheet) {
    reportSheet = ss.insertSheet(CONFIG.SHEET_NAME);
    reportSheet.appendRow(CONFIG.HEADERS);
    reportSheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold');
    reportSheet.setFrozenRows(1);
  }
  
  // Hoja de datos de choferes
  let dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
  if (!dataSheet) {
    dataSheet = ss.insertSheet(CONFIG.DATA_SHEET);
    const initialData = [
      ['cedula', 'nombre', 'organizacion', 'gerencia'],
      ['12345678', 'Juan Perez', 'Contratista', 'Transporte'],
      ['87654321', 'Maria Rodriguez', 'PDVSA', 'Producción'],
      ['11223344', 'Carlos Gomez', 'Contratista', 'Mantenimiento'],
      ['44332211', 'Ana Fernandez', 'PDVSA', 'Transporte']
    ];
    dataSheet.getRange(1, 1, initialData.length, initialData[0].length).setValues(initialData);
    dataSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    dataSheet.setFrozenRows(1);
  }
  
  return { reportSheet, dataSheet };
}

// Función principal GET - Compatible con JSONP
function doGet(e) {
  const callback = e.parameter.callback;

  try {
    const action = e.parameter.action;
    let responseData;

    console.log('📥 GET recibido - Action:', action, 'Callback:', callback);

    // Enrutador de acciones
    switch(action) {
      case 'read':
        responseData = getReports(e);
        break;
      case 'stats':
        responseData = getStatistics();
        break;
      case 'search':
        responseData = searchReports(e);
        break;
      case 'drivers':
        responseData = getDriversData();
        break;
      case 'dropdowns':
        responseData = getDropdownOptions();
        break;
      case 'test':
        responseData = { 
          status: 'success', 
          message: '✅ API funcionando correctamente',
          timestamp: new Date().toISOString(),
          method: 'JSONP'
        };
        break;
      default:
        responseData = { 
          message: 'Sistema de Reportes API', 
          version: '2.2', // Versión actualizada
          status: 'info',
          endpoints: ['read', 'stats', 'search', 'drivers', 'dropdowns', 'test'],
          timestamp: new Date().toISOString()
        };
    }

    return createJsonResponse(responseData, callback);

  } catch(error) {
    console.error('❌ Error en doGet:', error.stack);

    // Crear una respuesta de error estandarizada
    const errorResponse = { 
      result: 'error', 
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    };
    
    // Devolver siempre una respuesta JSON/JSONP válida
    return createJsonResponse(errorResponse, callback);
  }
}

// Función centralizada para crear respuestas JSON/JSONP
function createJsonResponse(data, callback) {
  let output;
  let mimeType;

  if (callback) {
    // Respuesta JSONP
    output = `${callback}(${JSON.stringify(data)})`;
    mimeType = ContentService.MimeType.JAVASCRIPT;
  } else {
    // Respuesta JSON estándar
    output = JSON.stringify(data, null, 2); // pretty print
    mimeType = ContentService.MimeType.JSON;
  }

  return ContentService.createTextOutput(output)
    .setMimeType(mimeType)
    .setHeaders({
      'Access-Control-Allow-Origin': '*', // O un dominio específico
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// Función principal POST - Para enviar reportes
function doPost(e) {
  try {
    console.log('📥 POST recibido');
    
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(10000);
      
      const data = JSON.parse(e.postData.contents);
      
      // Validar datos requeridos
      if (!data.cedula || !data.placa || !data.estado) {
        throw new Error('Faltan campos requeridos: cédula, placa o estado');
      }
      
      const { reportSheet } = initializeSheets();
      
      // Preparar datos
      const rowData = CONFIG.HEADERS.map(header => {
        const value = data[header] || '';
        return header === 'timestamp' && !value ? new Date().toLocaleString('es-VE') : value;
      });
      
      // Insertar fila
      reportSheet.appendRow(rowData);
      
      const lastRow = reportSheet.getLastRow();
      
      // Formatear
      const statusColumn = CONFIG.HEADERS.indexOf('estado') + 1;
      const statusRange = reportSheet.getRange(lastRow, statusColumn);
      
      if (data.estado === 'Operativa') {
        statusRange.setBackground('#d4edda').setFontColor('#155724');
      } else {
        statusRange.setBackground('#f8d7da').setFontColor('#721c24');
      }
      
      const response = { 
        result: 'success', 
        message: 'Reporte guardado exitosamente',
        row: lastRow,
        timestamp: new Date().toISOString()
      };
      
      return ContentService.createTextOutput(JSON.stringify(response))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
      
    } finally {
      lock.releaseLock();
    }
    
  } catch(error) {
    console.error('❌ Error en doPost:', error);
    return ContentService.createTextOutput(JSON.stringify({ 
      result: 'error', 
      error: error.toString(),
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*'
    });
  }
}

// Las funciones auxiliares se mantienen igual...
function getDriversData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    
    if (!dataSheet) return [];
    
    const data = dataSheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const driverData = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    }).filter(driver => driver.cedula && driver.nombre);
    
    return driverData;
    
  } catch (error) {
    console.error('Error obteniendo choferes:', error);
    return [];
  }
}

function getDropdownOptions() {
  try {
    const driverData = getDriversData();
    
    const organizaciones = [...new Set(driverData.map(item => item.organizacion).filter(Boolean))];
    const gerencias = [...new Set(driverData.map(item => item.gerencia).filter(Boolean))];
    
    return {
      organizaciones: organizaciones,
      gerencias: gerencias
    };
    
  } catch (error) {
    console.error('Error obteniendo opciones:', error);
    return {
      organizaciones: [],
      gerencias: []
    };
  }
}

function getReports(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!reportSheet) {
      return {
        reports: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    }
    
    const data = reportSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        reports: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
      };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const jsonData = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
    // Ordenar por timestamp
    jsonData.sort((a, b) => {
      try {
        return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      } catch (e) {
        return 0;
      }
    });
    
    // Paginación
    const limit = parseInt(e.parameter.limit) || 10;
    const page = parseInt(e.parameter.page) || 1;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    
    const paginatedData = jsonData.slice(startIndex, endIndex);
    
    return {
      reports: paginatedData,
      pagination: {
        page: page,
        limit: limit,
        total: jsonData.length,
        totalPages: Math.ceil(jsonData.length / limit)
      }
    };
    
  } catch (error) {
    console.error('Error obteniendo reportes:', error);
    return {
      reports: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }
    };
  }
}

function getStatistics() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!reportSheet) {
      return {
        total: 0,
        operativas: 0,
        inoperativas: 0,
        gerencias: {},
        organizaciones: {}
      };
    }
    
    const data = reportSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return {
        total: 0,
        operativas: 0,
        inoperativas: 0,
        gerencias: {},
        organizaciones: {}
      };
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const estadoIndex = headers.indexOf('estado');
    const gerenciaIndex = headers.indexOf('gerencia');
    const organizacionIndex = headers.indexOf('organizacion');
    
    const stats = {
      total: rows.length,
      operativas: 0,
      inoperativas: 0,
      gerencias: {},
      organizaciones: {}
    };
    
    rows.forEach(row => {
      const estado = row[estadoIndex];
      const gerencia = row[gerenciaIndex] || 'Sin especificar';
      const organizacion = row[organizacionIndex] || 'Sin especificar';
      
      if (estado === 'Operativa') stats.operativas++;
      else if (estado === 'Inoperativa') stats.inoperativas++;
      
      stats.gerencias[gerencia] = (stats.gerencias[gerencia] || 0) + 1;
      stats.organizaciones[organizacion] = (stats.organizaciones[organizacion] || 0) + 1;
    });
    
    return stats;
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return {
      total: 0,
      operativas: 0,
      inoperativas: 0,
      gerencias: {},
      organizaciones: {}
    };
  }
}

function searchReports(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    if (!reportSheet) return [];
    
    const data = reportSheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const headers = data[0];
    const rows = data.slice(1);
    const query = (e.parameter.q || '').toLowerCase();
    
    if (!query) return [];
    
    const filteredData = rows.filter(row => {
      return row.some(cell => 
        cell && cell.toString().toLowerCase().includes(query)
      );
    });
    
    const jsonData = filteredData.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
    return jsonData;
    
  } catch (error) {
    console.error('Error buscando reportes:', error);
    return [];
  }
}
