// Backend para TTOCC NEXUS EPP - Sincronización Google Sheets
// ==========================================================

const SHEETS = {
  INVENTARIO: 'Inventario',
  MOVIMIENTOS: 'Movimientos',
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

    // 1. INVENTARIO: INGRESO DE NUEVO LOTE
    if (type === 'nuevo_lote') {
      const invSheet = getOrCreateSheet(ss, SHEETS.INVENTARIO, [
        'Equipo', 'Talla', 'Cantidad', 'Lote', 'Fecha Ingreso'
      ]);
      invSheet.appendRow([
        data.equipo,
        data.talla,
        data.cantidad,
        data.lote || 'S/L',
        data.fechaIngreso || timestamp
      ]);

      const movSheet = getOrCreateSheet(ss, SHEETS.MOVIMIENTOS, [
        'Timestamp', 'Tipo', 'Equipo', 'Talla', 'Cantidad', 'Motivo/Detalle', 'Fecha'
      ]);
      movSheet.appendRow([
        timestamp,
        'ENTRADA_LOTE',
        data.equipo,
        data.talla,
        data.cantidad,
        `Lote: ${data.lote || 'S/L'}`,
        data.fechaIngreso || timestamp
      ]);

      return response({ result: 'success', message: 'Lote registrado exitosamente' });
    }

    // 2. INVENTARIO: DESCUENTO DE EPP
    if (type === 'descuento_epp') {
      const movSheet = getOrCreateSheet(ss, SHEETS.MOVIMIENTOS, [
        'Timestamp', 'Tipo', 'Equipo', 'Talla', 'Cantidad', 'Motivo/Detalle', 'Fecha'
      ]);
      movSheet.appendRow([
        timestamp,
        'SALIDA_EPP',
        data.equipo,
        data.talla,
        data.cantidad,
        data.motivo || 'Retiro de inventario',
        data.fecha || timestamp
      ]);

      // Descontar en hoja de Inventario si existe registro
      const invSheet = getOrCreateSheet(ss, SHEETS.INVENTARIO, [
        'Equipo', 'Talla', 'Cantidad', 'Lote', 'Fecha Ingreso'
      ]);
      const rows = invSheet.getDataRange().getValues();
      let restante = Number(data.cantidad);

      for (let i = 1; i < rows.length; i++) {
        if (restante <= 0) break;
        const rowEquipo = String(rows[i][0]);
        const rowTalla = String(rows[i][1]);
        let rowCant = Number(rows[i][2]);

        if (rowEquipo === String(data.equipo) && rowTalla === String(data.talla) && rowCant > 0) {
          if (rowCant <= restante) {
            restante -= rowCant;
            invSheet.getRange(i + 1, 3).setValue(0);
          } else {
            invSheet.getRange(i + 1, 3).setValue(rowCant - restante);
            restante = 0;
          }
        }
      }

      return response({ result: 'success', message: 'Descuento registrado exitosamente' });
    }

    // 3. PERSONAL: REGISTRAR ENTREGA DE EPP
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

    // 4. PERSONAL: AÑADIR TRABAJADOR O PASANTE MANUALMENTE
    if (type === 'add_worker') {
      const sheet = getOrCreateSheet(ss, SHEETS.TRABAJADORES, ['Cédula', 'Nombre', 'Cargo', 'Área']);
      sheet.appendRow([data.cedula, data.nombre, data.cargo || data.puesto, data.area || data.unidad]);
      return response({ result: 'success' });
    }

    // 5. PERSONAL: SINCRONIZACIÓN MASIVA DE TRABAJADORES (Desde Excel)
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
    const invSheet = ss.getSheetByName(SHEETS.INVENTARIO);
    const movSheet = ss.getSheetByName(SHEETS.MOVIMIENTOS);
    const workersSheet = ss.getSheetByName(SHEETS.TRABAJADORES);
    const entregasSheet = ss.getSheetByName(SHEETS.ENTREGAS);

    const inventario = invSheet ? sheetToObjects(invSheet) : [];
    const movimientos = movSheet ? sheetToObjects(movSheet) : [];
    const trabajadores = workersSheet ? sheetToObjects(workersSheet) : [];
    const entregas = entregasSheet ? sheetToObjects(entregasSheet) : [];

    return response({ inventario, movimientos, trabajadores, entregas });
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
