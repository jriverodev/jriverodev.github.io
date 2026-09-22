const SHEETS = {
  ENTREGAS: 'Entregas_EPP',
  TRABAJADORES: 'Trabajadores'
};

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);
    const { type, data } = payload;
    const timestamp = new Date();

    // REGISTRAR ENTREGA DE EPP
    if (type === 'entrega') {
      const sheet = getOrCreateSheet(ss, SHEETS.ENTREGAS, [
        'Timestamp', 'Fecha Entrega', 'Cédula', 'Nombre', 'Cargo', 'Unidad/Área', 'Equipo', 'Talla'
      ]);
      sheet.appendRow([
        timestamp,
        data.fecha || timestamp,
        data.cedula,
        data.nombre,
        data.puesto || data.cargo,
        data.unidad || data.area,
        data.equipo,
        data.talla
      ]);
      return response({ result: 'success' });
    }

    // AÑADIR TRABAJADOR O PASANTE MANUALMENTE
    if (type === 'add_worker') {
      const sheet = getOrCreateSheet(ss, SHEETS.TRABAJADORES, ['Cédula', 'Nombre', 'Cargo', 'Área']);
      sheet.appendRow([data.cedula, data.nombre, data.cargo || data.puesto, data.area || data.unidad]);
      return response({ result: 'success' });
    }

    // SINCRONIZACIÓN MASIVA (Desde Excel)
    if (type === 'workers') {
      const sheet = getOrCreateSheet(ss, SHEETS.TRABAJADORES, ['Cédula', 'Nombre', 'Cargo', 'Área']);
      sheet.clearContents();
      sheet.appendRow(['Cédula', 'Nombre', 'Cargo', 'Área']);
      data.forEach(w => sheet.appendRow([w.cedula, w.nombre, w.cargo || w.puesto, w.area || w.unidad]));
      return response({ result: 'success' });
    }

    return response({ result: 'error', error: 'Tipo de operación no reconocida' });

  } catch (f) {
    return response({ result: 'error', error: f.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const workersSheet = ss.getSheetByName(SHEETS.TRABAJADORES);
    const entregasSheet = ss.getSheetByName(SHEETS.ENTREGAS);

    const trabajadores = workersSheet ? sheetToObjects(workersSheet) : [];
    const entregas = entregasSheet ? sheetToObjects(entregasSheet) : [];

    return response({ trabajadores, entregas });
  } catch (error) {
    return response({ result: 'error', error: error.toString() });
  }
}

function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#ffe4e6');
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift();

  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      let key = header.toLowerCase().replace(/[\/ ]/g, '_');
      obj[key] = row[i];
    });
    return obj;
  });
}
