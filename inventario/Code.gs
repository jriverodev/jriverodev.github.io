// CÓDIGO FINAL REFORZADO

const SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
const SHEET_NAME = 'INVENTARIOV2';
const ID_COLUMN_NAME = 'N°';

/**
 * Punto de entrada para peticiones POST.
 * Centraliza el manejo de errores para garantizar que siempre se devuelva una respuesta JSON
 * con las cabeceras CORS correctas.
 */
function doPost(e) {
  let response;
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    let result;

    switch (action) {
      case 'add':
        result = addRecord(requestData.newItem);
        break;
      case 'update':
        result = updateRecord(requestData.itemId, requestData.updates);
        break;
      case 'delete':
        result = deleteRecord(requestData.itemId);
        break;
      default:
        throw new Error(`Acción desconocida: ${action}`);
    }
    response = { success: true, data: result };
  } catch (error) {
    // Si cualquier cosa falla, se captura el error aquí.
    response = { success: false, error: error.toString() };
  }

  // Se crea la respuesta JSON final, asegurando que las cabeceras CORS siempre se añadan.
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Punto de entrada para peticiones GET.
 * Centraliza el manejo de errores para garantizar que siempre se devuelva una respuesta JSON
 * con las cabeceras CORS correctas.
 */
function doGet(e) {
  let response;
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Saca la fila de cabeceras
    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    response = { success: true, data: jsonData };
  } catch (error) {
    // Si la lectura de datos falla, se captura aquí.
    response = { success: false, error: error.toString() };
  }

  // Se crea la respuesta JSON final, asegurando que las cabeceras CORS siempre se añadan.
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Maneja las peticiones OPTIONS (pre-vuelo) para CORS.
 * Es una buena práctica tenerla explícitamente.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHttpHeader('Access-Control-Allow-Origin', '*')
    .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// --- FUNCIONES INTERNAS (LÓGICA DE NEGOCIO) ---
// Estas funciones ahora solo lanzan errores, y la captura se hace en doGet/doPost.

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`No se encontró la hoja con el nombre "${SHEET_NAME}"`);
  }
  return sheet;
}

function getHeaders() {
  const sheet = getSheet();
  // Se asegura de no fallar si la hoja está vacía.
  if (sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function addRecord(newItem) {
  const sheet = getSheet();
  const headers = getHeaders();
  
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) {
    throw new Error(`La columna de ID "${ID_COLUMN_NAME}" no fue encontrada.`);
  }

  let maxId = 0;
  if (sheet.getLastRow() > 1) {
    const idRange = sheet.getRange(2, idColumnIndex + 1, sheet.getLastRow() - 1, 1);
    const idValues = idRange.getValues();
    maxId = idValues.reduce((max, row) => {
      const id = Number(row[0]);
      return id > max ? id : max;
    }, 0);
  }

  const newId = maxId + 1;
  newItem[ID_COLUMN_NAME] = newId;

  const newRow = headers.map(header => (newItem[header] !== undefined ? newItem[header] : ''));
  sheet.appendRow(newRow);
  return { newId: newId };
}

function updateRecord(itemId, updates) {
  if (!itemId) throw new Error("El ID del item es requerido para actualizar.");
  
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna de ID "${ID_COLUMN_NAME}" no encontrada.`);
  
  const data = sheet.getDataRange().getValues();
  // Empezar desde 1 para saltar la cabecera
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      headers.forEach((header, colIndex) => {
        if (updates.hasOwnProperty(header)) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[header]);
        }
      });
      return { updatedId: itemId };
    }
  }
  throw new Error(`Item con ID "${itemId}" no encontrado para actualizar.`);
}

function deleteRecord(itemId) {
  if (!itemId) throw new Error("El ID del item es requerido para eliminar.");
  
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna de ID "${ID_COLUMN_NAME}" no encontrada.`);
  
  const data = sheet.getDataRange().getValues();
  // Iterar hacia atrás para evitar problemas al eliminar filas
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 1);
      return { deletedId: itemId };
    }
  }
  throw new Error(`Item con ID "${itemId}" no encontrado para eliminar.`);
}
