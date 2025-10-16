// CÓDIGO CORREGIDO

const SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c';
const SHEET_NAME = 'INVENTARIOV2';
const ID_COLUMN_NAME = 'N°';

function doPost(e) {
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
    return createJsonResponse({ success: true, data: result });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function doGet(e) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });
    return createJsonResponse({ success: true, data: jsonData });
  } catch (error) {
    return createJsonResponse({ success: false, error: error.toString() });
  }
}

function doOptions(e) {
  return ContentService.createTextOutput()
    .addHttpHeader('Access-Control-Allow-Origin', '*')
    .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function createJsonResponse(responseObject) {
  const jsonString = JSON.stringify(responseObject);
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*');
}

// --- El resto de las funciones ---
function getSheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
}

function getHeaders() {
  return getSheet().getRange(1, 1, 1, getSheet().getLastColumn()).getValues()[0];
}

function addRecord(newItem) {
  const sheet = getSheet();
  const headers = getHeaders();
  const newId = sheet.getLastRow(); // Corregido para evitar saltos de ID
  newItem[ID_COLUMN_NAME] = newId;
  const newRow = headers.map(header => newItem[header] || '');
  sheet.appendRow(newRow);
  return { newId: newId };
}

function updateRecord(itemId, updates) {
  if (!itemId) throw new Error("ID es requerido.");
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  const data = sheet.getDataRange().getValues();
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
  throw new Error(`ID no encontrado: ${itemId}`);
}

function deleteRecord(itemId) {
  if (!itemId) throw new Error("ID es requerido.");
  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 1);
      return { deletedId: itemId };
    }
  }
  throw new Error(`ID no encontrado: ${itemId}`);
}