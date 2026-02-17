// Contenido para el archivo Code.gs en Google Apps Script para el proyecto de Asistencia
// ====================================================================================
// INSTRUCCIONES:
// 1. En tu hoja de Google, ve a Extensiones > Apps Script.
// 2. Borra el código que aparezca.
// 3. Copia y pega TODO el contenido de este archivo en el editor.
// 4. Guarda el proyecto (ej. "Nexus Asistencia Backend").
// 5. Haz clic en "Implementar" > "Nueva implementación".
// 6. Elige tipo "Aplicación web".
// 7. En "Quién tiene acceso", selecciona "Cualquiera" (esto es importante para que la App pueda enviar datos).
// 8. Haz clic en "Implementar" y copia la "URL de la aplicación web".
// 9. Pega esa URL en la configuración de la App de Asistencia.

const sheetName = 'Asistencia';

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);

    // Si la hoja no existe, la crea con encabezados
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow([
        'Timestamp',
        'Fecha Asistencia',
        'Cédula',
        'Nombre',
        'Cargo',
        'Área',
        'Ubicación',
        'Nómina',
        'Estado'
      ]);
      sheet.getRange(1, 1, 1, 9).setFontWeight('bold').setBackground('#f3f3f3');
    }

    const data = JSON.parse(e.postData.contents);
    const timestamp = new Date();

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return ContentService
          .createTextOutput(JSON.stringify({ 'result': 'success', 'message': 'No hay datos para enviar' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      // Si recibimos un array, añadimos múltiples filas
      const rows = data.map(r => [
        timestamp,
        r.fecha,
        r.cedula,
        r.nombre,
        r.cargo,
        r.area,
        r.ubicacion,
        r.nomina,
        r.asistencia
      ]);

      sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);

      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'success', 'message': `${rows.length} registros añadidos` }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Si recibimos un solo objeto
      sheet.appendRow([
        timestamp,
        data.fecha,
        data.cedula,
        data.nombre,
        data.cargo,
        data.area,
        data.ubicacion,
        data.nomina,
        data.asistencia
      ]);

      return ContentService
        .createTextOutput(JSON.stringify({ 'result': 'success', 'row': sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch(error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Backend de Asistencia funcionando correctamente.");
}
