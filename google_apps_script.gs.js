// =======================================================
// SISTEMA DE REPORTES - GOOGLE APPS SCRIPT MEJORADO
// =======================================================

const CONFIG = {
  SHEET_NAME: 'Reportes',
  HEADERS: ['timestamp', 'cedula', 'nombre', 'organizacion', 'gerencia', 'placa', 'estado', 'observaciones'],
  BACKUP_SHEET: 'Respaldo_Reportes'
};

// Inicialización de la hoja
function initializeSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(CONFIG.HEADERS);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  
  // Verificar y agregar encabezados si faltan
  const lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(CONFIG.HEADERS);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setFontWeight('bold');
  }
  
  return sheet;
}

// Función principal POST
function doPost(e) {
  try {
    const sheet = initializeSheet();
    const lock = LockService.getScriptLock();
    
    try {
      lock.waitLock(30000); // Esperar máximo 30 segundos
      
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
      sheet.appendRow(rowData);
      
      // Formatear la nueva fila
      const lastRow = sheet.getLastRow();
      const statusColumn = CONFIG.HEADERS.indexOf('estado') + 1;
      const statusRange = sheet.getRange(lastRow, statusColumn);
      
      if (data.estado === 'Operativa') {
        statusRange.setBackground('#d4edda').setFontColor('#155724');
      } else {
        statusRange.setBackground('#f8d7da').setFontColor('#721c24');
      }
      
      // Autoajustar columnas
      sheet.autoResizeColumns(1, CONFIG.HEADERS.length);
      
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
      default:
        return createResponse({ 
          message: 'Sistema de Reportes API', 
          version: '2.0',
          endpoints: ['read', 'stats', 'search']
        });
    }
    
  } catch(error) {
    return createResponse({ 
      result: 'error', 
      error: error.toString() 
    }, 500);
  }
}

// Obtener reportes con paginación
function getReports(e) {
  const sheet = initializeSheet();
  const data = sheet.getDataRange().getValues();
  
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
  const sheet = initializeSheet();
  const data = sheet.getDataRange().getValues();
  
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
  const sheet = initializeSheet();
  const data = sheet.getDataRange().getValues();
  
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
