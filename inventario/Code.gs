// =================================================================================================
// IMPORTANTE: CÓDIGO PARA GOOGLE APPS SCRIPT - SISTEMA DE INVENTARIO
// =================================================================================================
// INSTRUCCIONES DE IMPLEMENTACIÓN:
// 1. Abre tu hoja de cálculo de Google Sheets.
// 2. Ve a "Extensiones" -> "Apps Script".
// 3. Borra cualquier código existente en el editor.
// 4. Copia y pega TODO el contenido de este archivo en el editor.
// 5. Guarda el proyecto (icono de disquete).
// 6. Haz clic en "Implementar" -> "Nueva implementación".
// 7. Selecciona "Aplicación web" como tipo de implementación.
// 8. En "Quién tiene acceso", elige "Cualquier persona" (esto es crucial para que la API sea pública).
// 9. Haz clic en "Implementar".
// 10. Copia la URL de la aplicación web que se te proporciona y pégala en el archivo `google-sheets.js`.
//
// **CADA VEZ QUE HAGAS UN CAMBIO EN ESTE CÓDIGO, DEBES VOLVER A IMPLEMENTARLO**
// **(Implementar -> Gestionar implementaciones -> Selecciona tu implementación -> Editar -> Nueva versión)**
// =================================================================================================

// --- CONFIGURACIÓN GLOBAL ---
const SPREADSHEET_ID = '1tm1OKWzWB8K1y9i_CvBoI5xPLW7hjxDIqJ8qaowZa1c'; // ID de tu Google Sheet
const SHEET_NAME = 'INVENTARIOV2'; // Nombre de la hoja donde están los datos
const ID_COLUMN_NAME = 'N°'; // Nombre exacto de la columna que usas como ID único

/**
 * @description Maneja las solicitudes HTTP GET. Se utiliza principalmente para leer todos los datos del inventario.
 * @param {Object} e - Objeto de evento de Google Apps Script.
 * @returns {ContentService.TextOutput} - Una respuesta JSON con los datos o un error.
 */
function doGet(e) {
  let response;
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data.shift() || []; // Saca la fila de cabeceras y previene error si está vacía

    // Convierte las filas de datos en un array de objetos JSON
    const jsonData = data.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index];
      });
      return obj;
    });

    response = { success: true, data: jsonData };

  } catch (error) {
    // Captura cualquier error durante la lectura y lo formatea en la respuesta
    console.error('Error en doGet:', error);
    response = { success: false, error: `Error del servidor: ${error.message}` };
  }

  // Devuelve la respuesta como JSON, añadiendo las cabeceras CORS para permitir el acceso
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*');
}

/**
 * @description Maneja las solicitudes HTTP POST. Se utiliza para añadir, actualizar o eliminar registros.
 * @param {Object} e - Objeto de evento con los datos de la solicitud en `e.postData.contents`.
 * @returns {ContentService.TextOutput} - Una respuesta JSON indicando el éxito o fracaso de la operación.
 */
function doPost(e) {
  let response;
  try {
    const requestData = JSON.parse(e.postData.contents);
    const { action, newItem, itemId, updates } = requestData;
    let result;

    // Valida que se haya proporcionado una acción
    if (!action) {
      throw new Error("No se especificó ninguna acción (add, update, delete).");
    }

    // Enrutador de acciones
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

    response = { success: true, data: result };

  } catch (error) {
    // Captura cualquier error y lo formatea para la respuesta
    console.error('Error en doPost:', error);
    response = { success: false, error: `Error en la operación: ${error.message}` };
  }

  // Devuelve la respuesta como JSON con las cabeceras CORS
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON)
    .addHttpHeader('Access-Control-Allow-Origin', '*');
}

/**
 * @description Maneja las solicitudes HTTP OPTIONS (pre-vuelo).
 * Esta función es ESENCIAL para que las solicitudes POST con 'Content-Type: application/json'
 * funcionen desde un navegador, ya que gestiona los requisitos de CORS.
 * @param {Object} e - Objeto de evento.
 * @returns {ContentService.TextOutput} - Una respuesta vacía con las cabeceras CORS correctas.
 */
function doOptions(e) {
  return ContentService.createTextOutput()
    .addHttpHeader('Access-Control-Allow-Origin', '*')
    .addHttpHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .addHttpHeader('Access-Control-Allow-Headers', 'Content-Type');
}


// --- LÓGICA INTERNA DEL MANEJO DE LA HOJA DE CÁLCULO ---

/**
 * @description Obtiene la hoja de cálculo activa y la valida.
 * @returns {Sheet} - El objeto de la hoja de cálculo.
 */
function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(`No se encontró la hoja con el nombre "${SHEET_NAME}".`);
  }
  return sheet;
}

/**
 * @description Obtiene los encabezados (la primera fila) de la hoja.
 * @returns {Array<String>} - Un array con los nombres de las columnas.
 */
function getHeaders() {
  const sheet = getSheet();
  if (sheet.getLastRow() < 1) return []; // Devuelve array vacío si no hay encabezados
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * @description Añade un nuevo registro a la hoja de cálculo.
 * Calcula automáticamente el siguiente ID disponible.
 * @param {Object} newItem - El objeto con los datos del nuevo registro.
 * @returns {Object} - Un objeto confirmando el nuevo ID.
 */
function addRecord(newItem) {
  if (!newItem || typeof newItem !== 'object') {
    throw new Error("Los datos para añadir el nuevo item son inválidos.");
  }

  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);

  if (idColumnIndex === -1) {
    throw new Error(`La columna de ID "${ID_COLUMN_NAME}" no fue encontrada en los encabezados.`);
  }

  // Calcula el nuevo ID basándose en el valor máximo existente
  let maxId = 0;
  if (sheet.getLastRow() > 1) {
    const idValues = sheet.getRange(2, idColumnIndex + 1, sheet.getLastRow() - 1, 1).getValues();
    maxId = idValues.reduce((max, row) => Math.max(max, Number(row[0] || 0)), 0);
  }
  const newId = maxId + 1;
  newItem[ID_COLUMN_NAME] = newId;

  // Crea la fila en el orden correcto de las columnas
  const newRow = headers.map(header => (newItem[header] !== undefined ? newItem[header] : ''));
  sheet.appendRow(newRow);

  return { newId: newId };
}

/**
 * @description Actualiza un registro existente basado en su ID.
 * @param {String|Number} itemId - El ID del registro a actualizar.
 * @param {Object} updates - Un objeto con los campos y valores a actualizar.
 * @returns {Object} - Un objeto confirmando el ID actualizado.
 */
function updateRecord(itemId, updates) {
  if (!itemId) throw new Error("El ID del item es requerido para actualizar.");
  if (!updates || typeof updates !== 'object') throw new Error("Los datos para actualizar son inválidos.");

  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna de ID "${ID_COLUMN_NAME}" no encontrada.`);

  const data = sheet.getDataRange().getValues();
  const rowIndex = data.findIndex((row, i) => i > 0 && String(row[idColumnIndex]) === String(itemId));

  if (rowIndex === -1) {
    throw new Error(`Item con ID "${itemId}" no encontrado para actualizar.`);
  }

  // Actualiza solo las celdas necesarias para mayor eficiencia
  headers.forEach((header, colIndex) => {
    if (updates.hasOwnProperty(header)) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(updates[header]);
    }
  });

  return { updatedId: itemId };
}

/**
 * @description Elimina un registro de la hoja basado en su ID.
 * @param {String|Number} itemId - El ID del registro a eliminar.
 * @returns {Object} - Un objeto confirmando el ID eliminado.
 */
function deleteRecord(itemId) {
  if (!itemId) throw new Error("El ID del item es requerido para eliminar.");

  const sheet = getSheet();
  const headers = getHeaders();
  const idColumnIndex = headers.indexOf(ID_COLUMN_NAME);
  if (idColumnIndex === -1) throw new Error(`Columna de ID "${ID_COLUMN_NAME}" no encontrada.`);

  const data = sheet.getDataRange().getValues();
  // Iterar hacia atrás para eliminar filas de forma segura
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idColumnIndex]) === String(itemId)) {
      sheet.deleteRow(i + 1);
      return { deletedId: itemId };
    }
  }

  throw new Error(`Item con ID "${itemId}" no encontrado para eliminar.`);
}