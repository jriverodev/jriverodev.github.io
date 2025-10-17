// =================================================================================================
// IMPORTANTE: CÓDIGO PARA GOOGLE APPS SCRIPT - SISTEMA DE INVENTARIO (VERSIÓN CORREGIDA)
// =================================================================================================
// INSTRUCCIONES DE IMPLEMENTACIÓN:
// 1. Abre tu hoja de cálculo de Google Sheets.
// 2. Ve a "Extensiones" -> "Apps Script".
// 3. Borra cualquier código existente en el editor.
// 4. Copia y pega TODO el contenido de este archivo en el editor.
// 5. Guarda el proyecto (icono de disquete).
// 6. Haz clic en "Implementar" -> "Nueva implementación".
// 7. Selecciona "Aplicación web" como tipo de implementación.
// 8. En "Quién tiene acceso", elige "Cualquier persona".
// 9. Haz clic en "Implementar".
//
// **CADA VEZ QUE HAGAS UN CAMBIO, DEBES VOLVER A IMPLEMENTAR UNA NUEVA VERSIÓN**
// **(Implementar -> Gestionar implementaciones -> Editar -> Nueva versión)**
// =================================================================================================

// --- CONFIGURACIÓN GLOBAL ---
const SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
const SHEET_NAME = 'INVENTARIOV2';
const ID_COLUMN_NAME = 'N°';

/**
 * @description Maneja las solicitudes HTTP GET.
 */
function doGet(e) {
  let responseData;
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift() || [];
    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    responseData = { success: true, data: jsonData };
  } catch (error) {
    console.error('Error en doGet:', error);
    responseData = { success: false, error: `Error del servidor: ${error.message}` };
  }

  // Se crea la respuesta y se configuran las cabeceras por separado para evitar errores.
  const output = ContentService.createTextOutput(JSON.stringify(responseData));
  output.setMimeType(ContentService.MimeType.JSON);
  output.addHttpHeader('Access-Control-Allow-Origin', '*');
  return output;
}

/**
 * @description Maneja las solicitudes HTTP POST.
 */
function doPost(e) {
  let responseData;
  try {
    const requestData = JSON.parse(e.postData.contents);
    const { action, newItem, itemId, updates } = requestData;
    let result;
    if (!action) throw new Error("No se especificó ninguna acción.");
    switch (action) {
      case 'add':
        result = addRecord(newItem);
        break;
      case 'update':
        result = updateRecord(itemId, updates);
        break;
      case 'delete':
        result = deleteRecord(itemId);
        break;
      default:
        throw new Error(`La acción "${action}" no es válida.`);
    }
    responseData = { success: true, data: result };
  } catch (error) {
    console.error('Error en doPost:', error);
    responseData = { success: false, error: `Error en la operación: ${error.message}` };
  }

  const output = ContentService.createTextOutput(JSON.stringify(responseData));
  output.setMimeType(ContentService.MimeType.JSON);
  output.addHttpHeader('Access-Control-Allow-Origin', '*');
  return output;
}

/**
 * @description Maneja las solicitudes HTTP OPTIONS (pre-vuelo) para CORS.
 */
function doOptions(e) {
  const output = ContentService.createTextOutput();
  output.addHttpHeader('Access-Control-Allow-Origin', '*');
  output.addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  output.addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
  return output;
}

// --- LÓGICA INTERNA ---

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`No se encontró la hoja "${SHEET_NAME}".`);
  return sheet;
}

function getHeaders() {
  const sheet = getSheet();
  if (sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function addRecord(newItem) {
  if (!newItem || typeof newItem !== 'object') throw new Error("Datos inválidos para añadir.");
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna ID "${ID_COLUMN_NAME}" no encontrada.`);
  let maxId = 0;
  if (sheet.getLastRow() > 1) {
    const idValues = sheet.getRange(2, idColumnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    maxId = idValues.reduce((max, row) => Math.max(max, Number(row[0] || 0)), 0);
  }
  const newId = maxId + 1;
  newItem[ID_COLUMN_NAME] = newId;
  const newRow = headers.map(header => (newItem[header] !== undefined ? newItem[header] : ''));
  sheet.appendRow(newRow);
  return { newId: newId };
}

function updateRecord(itemId, updates) {
  if (!itemId) throw new Error("ID requerido para actualizar.");
  if (!updates || typeof updates !== 'object') throw new Error("Datos inválidos para actualizar.");
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna ID "${ID_COLUMN_NAME}" no encontrada.`);
  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex((row, i) => i > 0 && String(row[idColumnIndex]) === String(itemId));
  if (rowIndex === -1) throw new Error(`Item con ID "${itemId}" no encontrado.`);
  headers.forEach((header, colIndex) => {
    if (updates.hasOwnProperty(header)) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updates[header]);
    }
  });
  return { updatedId: itemId };
}

function deleteRecord(itemId) {
  if (!itemId) throw new Error("ID requerido para eliminar.");
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna ID "${ID_COLUMN_NAME}" no encontrada.`);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 1);
      return { deletedId: itemId };
    }
  }
  throw new Error(`Item con ID "${itemId}" no encontrado para eliminar.`);
}