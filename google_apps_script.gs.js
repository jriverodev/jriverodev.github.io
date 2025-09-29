// =======================================================
// SISTEMA DE REPORTES - CON DATOS EXTERNOS
// =======================================================

const CONFIG = {
  SHEET_NAME: 'Reportes',
  DATA_SHEET: 'Datos_Choferes',
  HEADERS: ['timestamp', 'cedula', 'nombre', 'organizacion', 'gerencia', 'placa', 'estado', 'observaciones']
};

// Inicialización de las hojas
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
    // Crear estructura inicial de datos
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

// Obtener datos de choferes desde la hoja
function getDriverData() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    
    if (!dataSheet) {
      console.warn('No se encontró la hoja de datos de choferes');
      return [];
    }
    
    const data = dataSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    const driverData = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    }).filter(driver => driver.cedula && driver.nombre); // Filtrar filas vacías
    
    return driverData;
    
  } catch (error) {
    console.error('Error obteniendo datos de choferes:', error);
    return [];
  }
}

// Obtener opciones únicas para dropdowns
function getDropdownOptions() {
  const driverData = getDriverData();
  
  const organizaciones = [...new Set(driverData.map(item => item.organizacion).filter(Boolean))];
  const gerencias = [...new Set(driverData.map(item => item.gerencia).filter(Boolean))];
  
  return {
    organizaciones,
    gerencias
  };
}

// Función principal POST
function doPost(e) {
  try {
    const { reportSheet } = initializeSheets();
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(30000);
      
      const data = JSON.parse(e.postData.contents);
      
      // Validar datos requeridos
      if (!data.cedula || !data.placa || !data.estado) {
        throw new Error('Faltan campos requeridos: cédula, placa o estado');
      }
      
      // Preparar datos para insertar
      const rowData = CONFIG.HEADERS.map(header => {
        const value = data[header] || '';
        return header === 'timestamp' && !value ? new Date().toLocaleString('es-VE') : value;
      });
      
      // Insertar fila
      reportSheet.appendRow(rowData);
      
      // Formatear la nueva fila
      const lastRow = reportSheet.getLastRow();
      const statusColumn = CONFIG.HEADERS.indexOf('estado') + 1;
      const statusRange = reportSheet.getRange(lastRow, statusColumn);
      
      if (data.estado === 'Operativa') {
        statusRange.setBackground('#d4edda').setFontColor('#155724');
      } else {
        statusRange.setBackground('#f8d7da').setFontColor('#721c24');
      }
      
      // Autoajustar columnas
      reportSheet.autoResizeColumns(1, CONFIG.HEADERS.length);
      
      return createResponse({ 
        result: 'success', 
        row: lastRow,
        message: 'Reporte guardado exitosamente'
      });
      
    } finally {
      lock.releaseLock();
    }
    
  } catch(error) {
    console.error('Error en doPost:', error);
    return createResponse({ 
      result: 'error', 
      error: error.toString() 
    }, 400);
  }
}

// Función principal GET
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    switch(action) {
      case 'read':
        return getReports(e);
      case 'stats':
        return getStatistics();
      case 'search':
        return searchReports(e);
      case 'drivers':
        return getDriversData(e);
      case 'dropdowns':
        return getDropdownOptionsData();
      default:
        return createResponse({ 
          message: 'Sistema de Reportes API', 
          version: '2.1',
          endpoints: ['read', 'stats', 'search', 'drivers', 'dropdowns']
        });
    }
    
  } catch(error) {
    return createResponse({ 
      result: 'error', 
      error: error.toString() 
    }, 500);
  }
}

// Endpoint para datos de choferes
function getDriversData(e) {
  const driverData = getDriverData();
  return createResponse(driverData);
}

// Endpoint para opciones de dropdowns
function getDropdownOptionsData() {
  const options = getDropdownOptions();
  return createResponse(options);
}

// Obtener reportes con paginación
function getReports(e) {
  const { reportSheet } = initializeSheets();
  const data = reportSheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return createResponse([]);
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  
  const jsonData = rows.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  // Ordenar por timestamp (más recientes primero)
  jsonData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  // Paginación
  const limit = parseInt(e.parameter.limit) || 50;
  const page = parseInt(e.parameter.page) || 1;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  const paginatedData = jsonData.slice(startIndex, endIndex);
  
  return createResponse({
    reports: paginatedData,
    pagination: {
      page: page,
      limit: limit,
      total: jsonData.length,
      totalPages: Math.ceil(jsonData.length / limit)
    }
  });
}

// Obtener estadísticas
function getStatistics() {
  const { reportSheet } = initializeSheets();
  const data = reportSheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return createResponse({
      total: 0,
      operativas: 0,
      inoperativas: 0,
      gerencias: {},
      organizaciones: {}
    });
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
    const gerencia = row[gerenciaIndex];
    const organizacion = row[organizacionIndex];
    
    if (estado === 'Operativa') {
      stats.operativas++;
    } else if (estado === 'Inoperativa') {
      stats.inoperativas++;
    }
    
    stats.gerencias[gerencia] = (stats.gerencias[gerencia] || 0) + 1;
    stats.organizaciones[organizacion] = (stats.organizaciones[organizacion] || 0) + 1;
  });
  
  return createResponse(stats);
}

// Buscar reportes
function searchReports(e) {
  const { reportSheet } = initializeSheets();
  const data = reportSheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    return createResponse([]);
  }
  
  const headers = data[0];
  const rows = data.slice(1);
  const query = (e.parameter.q || '').toLowerCase();
  
  const filteredData = rows.filter(row => {
    return row.some(cell => 
      cell && cell.toString().toLowerCase().includes(query)
    );
  });
  
  const jsonData = filteredData.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
  
  return createResponse(jsonData);
}

// Función auxiliar para respuestas
function createResponse(data, statusCode = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
    .setStatusCode(statusCode);
}
