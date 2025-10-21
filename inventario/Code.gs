// =======================================================
// SISTEMA DE INVENTARIO - INVENTARIOV2 (MEJORADO)
// =======================================================

/*
  Notas:
  - Protege doPost usando API_KEY almacenada en Script Properties (ver instrucciones).
  - Comparte la hoja con la cuenta que ejecuta el Apps Script (propietario del proyecto de script).
*/

const CONFIG = {
  SPREADSHEET_ID: '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c', // Asegúrate que sea correcto
  SHEET_NAME: 'INVENTARIOV2',
  ID_COLUMN_NAME: 'N°'
};

function getSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error(`Hoja "${CONFIG.SHEET_NAME}" no encontrada en el spreadsheet ${CONFIG.SPREADSHEET_ID}`);
  return sheet;
}

function createJsonResponse(data, statusCode) {
  const output = JSON.stringify(data, null, 2);
  const response = ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*')
    .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

function doOptions(e) {
  return createJsonResponse({ success: true, message: 'ok' });
}

/**
 * doGet: devuelve { success: true, headers: [...], rows: [{...}], meta: {...} }
 */
function doGet(e) {
  try {
    const sheet = getSheet();
    const values = sheet.getDataRange().getValues();
    if (!values || values.length === 0) {
      return createJsonResponse({ success: true, headers: [], rows: [], meta: { total: 0 } });
    }
    const headers = values[0];
    const dataRows = values.slice(1);
    const rows = dataRows.map((r, i) => {
      const obj = { _rowIndex: i + 2 }; // fila real en la hoja
      headers.forEach((h, c) => {
        obj[h] = r[c] !== undefined ? r[c] : '';
      });
      return obj;
    });
    return createJsonResponse({ success: true, headers, rows, meta: { total: rows.length } });
  } catch (err) {
    console.error('doGet error', err);
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * doPost: body JSON con { apiKey, action: 'add'|'update'|'delete', newItem?, itemId?, updates? }
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const payload = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : '{}');

    // Verificar API_KEY
    const configuredKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
    if (!configuredKey) {
      throw new Error('API_KEY no configurada en Script Properties. Configure API_KEY para mayor seguridad.');
    }
    if (String(payload.apiKey || '') !== String(configuredKey)) {
      return createJsonResponse({ success: false, error: 'API key inválida' });
    }

    const action = payload.action;
    if (!action) throw new Error('No se indicó action en el body.');

    switch (action) {
      case 'add':
        return createJsonResponse(addRecord(payload.newItem));
      case 'update':
        return createJsonResponse(updateRecord(payload.itemId, payload.updates));
      case 'delete':
        return createJsonResponse(deleteRecord(payload.itemId));
      default:
        throw new Error('Acción desconocida: ' + action);
    }
  } catch (err) {
    console.error('doPost error', err);
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/* --- CRUD helpers --- */

function readAll() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (!values || values.length === 0) return { headers: [], rows: [] };
  const headers = values[0];
  const rows = values.slice(1).map((r, i) => {
    const obj = { _rowIndex: i + 2 };
    headers.forEach((h, c) => obj[h] = r[c] !== undefined ? r[c] : '');
    return obj;
  });
  return { headers, rows };
}

function addRecord(newItem) {
  if (!newItem || typeof newItem !== 'object') throw new Error('newItem inválido');
  const sheet = getSheet();
  const headersRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const headers = headersRange.getValues()[0];
  // ID columna
  const idColIdx = headers.indexOf(CONFIG.ID_COLUMN_NAME);
  if (idColIdx === -1) throw new Error(`Columna ID "${CONFIG.ID_COLUMN_NAME}" no encontrada en headers.`);

  // Calcular nuevo ID
  let maxId = 0;
  if (sheet.getLastRow() > 1) {
    const idValues = sheet.getRange(2, idColIdx + 1, sheet.getLastRow() - 1, 1).getValues();
    maxId = idValues.reduce((m, row) => Math.max(m, Number(row[0] || 0)), 0);
  }
  const newId = maxId + 1;
  newItem[CONFIG.ID_COLUMN_NAME] = newId;

  // Construir fila con orden de headers actuales
  const row = headers.map(h => newItem[h] !== undefined ? newItem[h] : '');
  sheet.appendRow(row);
  return { success: true, newId };
}

function updateRecord(itemId, updates) {
  if (!itemId) throw new Error('itemId requerido para update');
  if (!updates || typeof updates !== 'object') throw new Error('updates inválidos');
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) throw new Error('No hay registros en la hoja.');
  const headers = data[0];
  const idColIdx = headers.indexOf(CONFIG.ID_COLUMN_NAME);
  if (idColIdx === -1) throw new Error(`Columna ID "${CONFIG.ID_COLUMN_NAME}" no encontrada.`);

  // localizar fila por ID en el conjunto de datos (data.slice(1))
  const rows = data.slice(1);
  const foundIndex = rows.findIndex(r => String(r[idColIdx]) === String(itemId));
  if (foundIndex === -1) throw new Error(`Item con ID "${itemId}" no encontrado.`);

  const sheetRowNumber = foundIndex + 2; // +2 porque saltamos header y la indexación de hoja comienza en 1
  // Actualizar solo las columnas incluidas en updates
  headers.forEach((h, colIdx) => {
    if (updates.hasOwnProperty(h)) {
      sheet.getRange(sheetRowNumber, colIdx + 1).setValue(updates[h]);
    }
  });
  return { success: true, updatedId: itemId };
}

function deleteRecord(itemId) {
  if (!itemId) throw new Error('itemId requerido para delete');
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) throw new Error('No hay registros en la hoja.');
  const headers = data[0];
  const idColIdx = headers.indexOf(CONFIG.ID_COLUMN_NAME);
  if (idColIdx === -1) throw new Error(`Columna ID "${CONFIG.ID_COLUMN_NAME}" no encontrada.`);

  // Buscar desde abajo hacia arriba para eliminar correctamente filas duplicadas si las hubiese
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    if (String(row[idColIdx]) === String(itemId)) {
      sheet.deleteRow(i + 1); // i is 0-based; +1 to convert to 1-based, +1 extra porque data includes header row
      return { success: true, deletedId: itemId };
    }
  }
  throw new Error(`Item con ID "${itemId}" no encontrado para eliminar.`);
}
