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

// Función principal POST - Refactorizada para manejar múltiples acciones
function doPost(e) {
  let response;
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000); // Esperar hasta 15 segundos
    
    const data = JSON.parse(e.postData.contents);
    // La acción por defecto es 'submitReport' para mantener la compatibilidad
    const action = data.action || 'submitReport';

    console.log(`📥 POST recibido - Acción: ${action}`);

    switch(action) {
      case 'addDriver':
        response = addDriver(data);
        break;
      case 'deleteDriver':
        response = deleteDriver(data);
        break;
      case 'submitReport':
        response = submitReport(data);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }
    
  } catch(error) {
    console.error('❌ Error en doPost:', error.stack);
    response = {
      result: 'error', 
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  } finally {
    lock.releaseLock();
  }

  // Respuesta centralizada
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

// =======================================================
// FUNCIONES AUXILIARES PARA POST
// =======================================================

function submitReport(data) {
  // Validar datos requeridos
  if (!data.cedula || !data.placa || !data.estado) {
    throw new Error('Faltan campos requeridos para el reporte: cédula, placa o estado.');
  }

  const { reportSheet } = initializeSheets();

  // Preparar datos
  const rowData = CONFIG.HEADERS.map(header => {
    const value = data[header] || '';
    return header === 'timestamp' && !value ? new Date().toLocaleString('es-VE') : value;
  });

  reportSheet.appendRow(rowData);
  const lastRow = reportSheet.getLastRow();

  // Formatear la fila del estado
  const statusColumn = CONFIG.HEADERS.indexOf('estado') + 1;
  const statusRange = reportSheet.getRange(lastRow, statusColumn);
  if (data.estado === 'Operativa') {
    statusRange.setBackground('#d4edda').setFontColor('#155724');
  } else {
    statusRange.setBackground('#f8d7da').setFontColor('#721c24');
  }

  return { result: 'success', message: 'Reporte guardado exitosamente.', row: lastRow };
}

function addDriver(data) {
  const { dataSheet } = initializeSheets();

  if (!data.cedula || !data.nombre) {
    throw new Error('La cédula y el nombre son requeridos para agregar un chofer.');
  }

  const existingData = dataSheet.getDataRange().getValues();
  const cedulaColumnIndex = existingData[0].indexOf('cedula');

  // Verificar duplicados
  const isDuplicate = existingData.slice(1).some(row => row[cedulaColumnIndex] == data.cedula);
  if (isDuplicate) {
    throw new Error(`El chofer con la cédula ${data.cedula} ya existe.`);
  }

  // El orden en la hoja es: cedula, nombre, organizacion, gerencia
  const newRow = [data.cedula, data.nombre, data.organizacion || '', data.gerencia || ''];
  dataSheet.appendRow(newRow);

  return { result: 'success', message: 'Chofer agregado exitosamente.', driver: data };
}

function deleteDriver(data) {
  const { dataSheet } = initializeSheets();

  if (!data.cedula) {
    throw new Error('La cédula es requerida para eliminar un chofer.');
  }

  const existingData = dataSheet.getDataRange().getValues();
  const cedulaColumnIndex = existingData[0].indexOf('cedula');

  // Encontrar la fila a eliminar (las filas son 1-indexadas, saltamos la cabecera)
  let rowToDelete = -1;
  for (let i = 1; i < existingData.length; i++) {
    if (existingData[i][cedulaColumnIndex] == data.cedula) {
      rowToDelete = i + 1; // +1 porque las filas en Apps Script son 1-based
      break;
    }
  }

  if (rowToDelete === -1) {
    throw new Error(`No se encontró ningún chofer con la cédula ${data.cedula}.`);
  }

  dataSheet.deleteRow(rowToDelete);

  return { result: 'success', message: `Chofer con cédula ${data.cedula} eliminado.` };
}

// Las funciones auxiliares para GET se mantienen igual...
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
