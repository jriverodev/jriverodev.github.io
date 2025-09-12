// Contenido para el archivo Code.gs en Google Apps Script
// =======================================================
// INSTRUCCIONES:
// 1. En tu hoja de Google, ve a Extensiones > Apps Script.
// 2. Borra el código que aparezca.
// 3. Copia y pega TODO el contenido de este archivo en el editor.
// 4. Guarda el proyecto.
// 5. Sigue las instrucciones para Implementar > Nueva Implementación.

const sheetName = 'Reportes';
const scriptProp = PropertiesService.getScriptProperties();

// Función que se ejecuta cuando la página web envía datos (POST)
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    // Los datos vienen en formato JSON
    const data = JSON.parse(e.postData.contents);

    // Añade una nueva fila con los datos del reporte
    sheet.appendRow([
      data.timestamp,
      data.cedula,
      data.nombre,
      data.organizacion,
      data.gerencia,
      data.placa,
      data.estado,
      data.observaciones
    ]);

    // Responde con éxito
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'success', 'row': sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch(error) {
    // Responde con error
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Función que se ejecuta cuando la página web pide datos (GET)
function doGet(e) {
  try {
    // Si la petición es para leer los reportes
    if (e.parameter.action === 'read') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
      const data = sheet.getDataRange().getValues();

      // La primera fila son los encabezados
      const headers = data.shift();

      const jsonArray = data.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });

      return ContentService
        .createTextOutput(JSON.stringify(jsonArray))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Si no es una acción reconocida, devuelve un mensaje simple
    return ContentService.createTextOutput("Script funcionando.");

  } catch(error) {
     return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
