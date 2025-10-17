// =======================================================
// SISTEMA DE INVENTARIO - Adaptado para INVENTARIOV2
// =======================================================

const CONFIG = {
  SHEET_NAME: 'INVENTARIOV2',
  ID_COLUMN_NAME: 'N°',
  HEADERS: ['N°', 'DESCRIPCION', 'MARCA', 'MODELO', 'SERIAL', 'ETIQUETA', 'SECTOR', 'STATUS', 'RESPONSABLE', 'CEDULA', 'CARGO', 'OBSERVACIONES']
};

/**
 * @description Maneja las solicitudes GET para leer todos los datos del inventario.
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) throw new Error(`La hoja "${CONFIG.SHEET_NAME}" no fue encontrada.`);

    const data = sheet.getDataRange().getValues();
    const headers = data.shift() || [];

    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    const response = { success: true, data: jsonData };
    return createJsonResponse(response);

  } catch (error) {
    console.error('❌ Error en doGet:', error.stack);
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

/**
 * @description Maneja las solicitudes POST para añadir, editar o eliminar registros.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let response;

  try {
    lock.waitLock(15000); // Esperar hasta 15 segundos para evitar escrituras simultáneas

    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    if (!action) {
      throw new Error("No se especificó una acción (add, update, delete).");
    }

    switch (action) {
      case 'add':
        response = addRecord(requestData.newItem);
        break;
      case 'update':
        response = updateRecord(requestData.itemId, requestData.updates);
        break;
      case 'delete':
        response = deleteRecord(requestData.itemId);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

  } catch (error) {
    console.error('❌ Error en doPost:', error.stack);
    response = { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }

  return createJsonResponse(response);
}

/**
 * @description Crea una respuesta JSON estándar con las cabeceras CORS correctas.
 */
function createJsonResponse(data) {
  const output = JSON.stringify(data, null, 2);
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*')
    .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * @description Maneja las solicitudes OPTIONS (pre-vuelo) para CORS.
 */
function doOptions(e) {
    return ContentService.createTextOutput()
      .addHttpHeader('Access-Control-Allow-Origin', '*')
      .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- FUNCIONES CRUD ---

/**
 * @description Añade un nuevo registro al inventario.
 */
function addRecord(newItem) {
  if (!newItem || typeof newItem !== 'object') {
    throw new Error("Los datos para añadir el nuevo item son inválidos.");
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idColumnIndex = headers.indexOf(CONFIG.ID_COLUMN_NAME);

  if (idColumnIndex === -1) {
    throw new Error(`La columna de ID "${CONFIG.ID_COLUMN_NAME}" no fue encontrada.`);
  }

  let maxId = 0;
  if (sheet.getLastRow() > 1) {
    const idValues = sheet.getRange(2, idColumnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    maxId = idValues.reduce((max, row) => Math.max(max, Number(row[0] || 0)), 0);
  }
  const newId = maxId + 1;
  newItem[CONFIG.ID_COLUMN_NAME] = newId;

  const newRow = CONFIG.HEADERS.map(header => (newItem[header] !== undefined ? newItem[header] : ''));
  sheet.appendRow(newRow);

  return { success: true, newId: newId };
}

/**
 * @description Actualiza un registro existente basado en su ID.
 */
function updateRecord(itemId, updates) {
  if (!itemId) throw new Error("El ID del item es requerido para actualizar.");
  if (!updates || typeof updates !== 'object') throw new Error("Los datos para actualizar son inválidos.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idColumnIndex = headers.indexOf(CONFIG.ID_COLUMN_NAME);

  if (idColumnIndex === -1) throw new Error(`Columna de ID "${CONFIG.ID_COLUMN_NAME}" no encontrada.`);

  const rowIndex = data.findIndex(row => String(row[idColumnIndex]) === String(itemId));

  if (rowIndex === -1) {
    throw new Error(`Item con ID "${itemId}" no encontrado para actualizar.`);
  }

  headers.forEach((header, colIndex) => {
    if (updates.hasOwnProperty(header)) {
      sheet.getRange(rowIndex + 2, colIndex + 1).setValue(updates[header]);
    }
  });

  return { success: true, updatedId: itemId };
}

/**
 * @description Elimina un registro de la hoja basado en su ID.
 */
function deleteRecord(itemId) {
  if (!itemId) throw new Error("El ID del item es requerido para eliminar.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const idColumnIndex = headers.indexOf(CONFIG.ID_COLUMN_NAME);

  if (idColumnIndex === -1) throw new Error(`Columna de ID "${CONFIG.ID_COLUMN_NAME}" no encontrada.`);

  for (let i = data.length - 1; i >= 0; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 2);
      return { success: true, deletedId: itemId };
    }
  }

  throw new Error(`Item con ID "${itemId}" no encontrado para eliminar.`);
}