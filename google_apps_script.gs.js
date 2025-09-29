// =======================================================
// SISTEMA DE REPORTES - GOOGLE APPS SCRIPT MEJORADO
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

// Función para agregar nuevo chofer
function addNewDriver(driverData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    
    if (!dataSheet) {
      throw new Error('No se encontró la hoja de datos de choferes');
    }
    
    // Verificar si el chofer ya existe
    const existingData = dataSheet.getDataRange().getValues();
    const cedulas = existingData.map(row => row[0]); // La cédula está en la columna 0
    
    if (cedulas.includes(driverData.cedula)) {
      throw new Error('Ya existe un chofer con esta cédula');
    }
    
    // Agregar nueva fila
    dataSheet.appendRow([
      driverData.cedula,
      driverData.nombre,
      driverData.organizacion,
      driverData.gerencia
    ]);
    
    return { success: true, message: 'Chofer agregado correctamente' };
    
  } catch (error) {
    console.error('Error agregando chofer:', error);
    return { success: false, error: error.message };
  }
}

// Función para eliminar chofer
function deleteDriver(cedula) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const dataSheet = ss.getSheetByName(CONFIG.DATA_SHEET);
    
    if (!dataSheet) {
      throw new Error('No se encontró la hoja de datos de choferes');
    }
    
    const data = dataSheet.getDataRange().getValues();
    let rowToDelete = -1;
    
    // Buscar la fila con la cédula
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === cedula) {
        rowToDelete = i + 1; // +1 porque las filas empiezan en 1
        break;
      }
    }
    
    if (rowToDelete === -1) {
      throw new Error('No se encontró el chofer con la cédula especificada');
    }
    
    // Eliminar la fila
    dataSheet.deleteRow(rowToDelete);
    
    return { success: true, message: 'Chofer eliminado correctamente' };
    
  } catch (error) {
    console.error('Error eliminando chofer:', error);
    return { success: false, error: error.message };
  }
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
      case 'addDriver':
        return addDriver(e);
      case 'deleteDriver':
        return deleteDriverEndpoint(e);
      default:
        return createResponse({ 
          message: 'Sistema de Reportes API', 
          version: '2.1',
          endpoints: ['read', 'stats', 'search', 'drivers', 'dropdowns', 'addDriver', 'deleteDriver']
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

// Endpoint para agregar chofer
function addDriver(e) {
  try {
    const driverData = {
      cedula: e.parameter.cedula,
      nombre: e.parameter.nombre,
      organizacion: e.parameter.organizacion,
      gerencia: e.parameter.gerencia
    };
    
    // Validar datos requeridos
    if (!driverData.cedula || !driverData.nombre || !driverData.organizacion || !driverData.gerencia) {
      throw new Error('Faltan campos requeridos para agregar chofer');
    }
    
    const result = addNewDriver(driverData);
    
    if (result.success) {
      return createResponse({
        result: 'success',
        message: result.message
      });
    } else {
      return createResponse({
        result: 'error',
        error: result.error
      }, 400);
    }
    
  } catch (error) {
    console.error('Error en addDriver:', error);
    return createResponse({
      result: 'error',
      error: error.toString()
    }, 400);
  }
}

// Endpoint para eliminar chofer
function deleteDriverEndpoint(e) {
  try {
    const cedula = e.parameter.cedula;
    
    if (!cedula) {
      throw new Error('Se requiere la cédula para eliminar el chofer');
    }
    
    const result = deleteDriver(cedula);
    
    if (result.success) {
      return createResponse({
        result: 'success',
        message: result.message
      });
    } else {
      return createResponse({
        result: 'error',
        error: result.error
      }, 400);
    }
    
  } catch (error) {
    console.error('Error en deleteDriver:', error);
    return createResponse({
      result: 'error',
      error: error.toString()
    }, 400);
  }
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
  jsonData.sort((a, b) => {
    try {
      return new Date(b.timestamp) - new Date(a.timestamp);
    } catch (e) {
      return 0;
    }
  });
  
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
    
    if (gerencia) {
      stats.gerencias[gerencia] = (stats.gerencias[gerencia] || 0) + 1;
    }
    
    if (organizacion) {
      stats.organizaciones[organizacion] = (stats.organizaciones[organizacion] || 0) + 1;
    }
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

// Función para limpiar reportes antiguos (opcional)
function cleanOldReports(days = 30) {
  try {
    const { reportSheet } = initializeSheets();
    const data = reportSheet.getDataRange().getValues();
    
    if (data.length <= 1) return { deleted: 0 };
    
    const headers = data[0];
    const rows = data.slice(1);
    const timestampIndex = headers.indexOf('timestamp');
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    let deletedCount = 0;
    const rowsToKeep = [];
    
    rows.forEach((row, index) => {
      try {
        const rowDate = new Date(row[timestampIndex]);
        if (rowDate >= cutoffDate) {
          rowsToKeep.push(row);
        } else {
          deletedCount++;
        }
      } catch (e) {
        // Si hay error al parsear la fecha, mantener la fila
        rowsToKeep.push(row);
      }
    });
    
    // Reconstruir la hoja
    reportSheet.clear();
    reportSheet.appendRow(headers);
    
    if (rowsToKeep.length > 0) {
      reportSheet.getRange(2, 1, rowsToKeep.length, headers.length).setValues(rowsToKeep);
    }
    
    return { deleted: deletedCount };
    
  } catch (error) {
    console.error('Error limpiando reportes antiguos:', error);
    return { error: error.toString() };
  }
}

// Función de prueba para verificar que todo funciona
function testAPI() {
  const testData = {
    timestamp: new Date().toLocaleString('es-VE'),
    cedula: '99999999',
    nombre: 'Usuario Test',
    organizacion: 'Test',
    gerencia: 'Test',
    placa: 'TEST123',
    estado: 'Operativa',
    observaciones: 'Reporte de prueba'
  };
  
  const result = doPost({
    postData: {
      contents: JSON.stringify(testData)
    }
  });
  
  console.log('Resultado del test:', result.getContent());
}

// Función para obtener resumen ejecutivo
function getExecutiveSummary() {
  const stats = getStatistics();
  const driverData = getDriverData();
  
  return {
    fecha: new Date().toLocaleString('es-VE'),
    resumen: {
      totalReportes: stats.total,
      unidadesOperativas: stats.operativas,
      unidadesInoperativas: stats.inoperativas,
      totalChoferes: driverData.length,
      organizacionesActivas: Object.keys(stats.organizaciones).length,
      gerenciasActivas: Object.keys(stats.gerencias).length
    },
    distribucionOrganizaciones: stats.organizaciones,
    distribucionGerencias: stats.gerencias
  };
}
