/**
 * SISTEMA DE INVENTARIO - Google Apps Script Backend
 *
 * Funcionalidades:
 * 1.  Provee los datos del inventario en formato JSON.
 * 2.  Maneja operaciones CRUD (Crear, Leer, Actualizar, Borrar) a través de una API web.
 * 3.  Incluye manejo de CORS para permitir peticiones desde dominios externos (como GitHub Pages).
 */

// --- CONFIGURACIÓN GLOBAL ---
const SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c'; // ID de tu Google Sheet
const SHEET_NAME = 'INVENTARIO'; // Nombre de la hoja de cálculo
const ID_COLUMN_NAME = 'N°'; // Nombre de la columna que usaremos como ID único

/**
 * Función principal que se ejecuta cuando se hace una petición POST a la Web App.
 * Este es el endpoint de la API para todas las operaciones de escritura (add, update, delete).
 */
function doPost(e) {
  try {
    // Parsear el cuerpo de la petición, que viene como un string JSON.
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    let result;

    // Determinar qué acción realizar
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

    // Si todo va bien, devolvemos una respuesta exitosa.
    return createJsonResponse({ success: true, data: result });

  } catch (error) {
    // Si algo sale mal, devolvemos un error.
    Logger.log(`Error en doPost: ${error.message}`);
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * Función que se ejecuta cuando se hace una petición GET.
 * Se usa para obtener todos los datos del inventario.
 */
function doGet(e) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Saca la primera fila (cabeceras)

    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    return createJsonResponse({ success: true, data: jsonData });

  } catch (error) {
    Logger.log(`Error en doGet: ${error.message}`);
    return createJsonResponse({ success: false, error: error.message });
  }
}




/**


 * Función para manejar las peticiones OPTIONS (preflight de CORS).


 * Es necesaria para que los navegadores permitan las peticiones POST con Content-Type JSON.


 */


function doOptions(e) {


  return ContentService.createTextOutput()


    .setHeader('Access-Control-Allow-Origin', '*')


    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


    .setHeader('Access-Control-Allow-Headers', 'Content-Type');


}





// --- FUNCIONES CRUD (Create, Read, Update, Delete) ---

/**
 * Agrega un nuevo registro (fila) a la hoja de cálculo.
 */
function addRecord(newItem) {
  const sheet = getSheet();
  const headers = getHeaders();

  // Generar un nuevo N° basado en la última fila
  const newId = sheet.getLastRow();
  newItem[ID_COLUMN_NAME] = newId;

  const newRow = headers.map(header => newItem[header] || ''); // Construir la fila en el orden correcto

  sheet.appendRow(newRow);

  return { newId: newId }; // Devolver el ID del nuevo item
}

/**
 * Actualiza una fila existente, identificada por su 'N°'.
 */
function updateRecord(itemId, updates) {
  if (!itemId) {
    throw new Error("Se requiere un ID para actualizar el registro.");
  }

  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);

  if (idColumnIndex === -1) {
    throw new Error(`La columna ID '${ID_COLUMN_NAME}' no fue encontrada.`);
  }

  const data = sheet.getDataRange().getValues();
  // Buscamos la fila que coincide con el itemId. Empezamos en 1 para saltar las cabeceras.
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      const rowIndex = i + 1; // El índice de la fila en la hoja es i + 1

      // Actualizamos solo las celdas necesarias
      headers.forEach((header, colIndex) => {
        if (updates.hasOwnProperty(header)) {
          sheet.getRange(rowIndex, colIndex + 1).setValue(updates[header]);
        }
      });

      return { updatedId: itemId };
    }
  }

  throw new Error(`No se encontró ningún registro con el ID: ${itemId}`);
}


/**
 * Elimina una fila de la hoja de cálculo, identificada por su 'N°'.
 */
function deleteRecord(itemId) {
  if (!itemId) {
    throw new Error("Se requiere un ID para eliminar el registro.");
  }

  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);

  if (idColumnIndex === -1) {
    throw new Error(`La columna ID '${ID_COLUMN_NAME}' no fue encontrada.`);
  }

  const data = sheet.getDataRange().getValues();
  // Buscamos la fila que coincide con el itemId (de abajo hacia arriba para evitar problemas al borrar)
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 1); // El índice de la fila es i + 1
      return { deletedId: itemId };
    }
  }

  throw new Error(`No se encontró ningún registro con el ID: ${itemId} para eliminar.`);
}


// --- FUNCIONES DE UTILIDAD ---

/**
 * Crea una respuesta en formato JSON con las cabeceras CORS correctas.
 * Esto es CRUCIAL para que la aplicación web pueda comunicarse con el script.
 */
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*') // Permite peticiones desde cualquier origen
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Obtiene la hoja de cálculo activa.
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME);
}

/**
 * Obtiene las cabeceras (primera fila) de la hoja.
 */
function getHeaders() {
  const sheet = getSheet();
  // getRange(fila, columna, numFilas, numColumnas)
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}
