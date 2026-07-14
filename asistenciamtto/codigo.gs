// Backend para Nexus Asistencia con soporte para Sincronización Real-time, Upsert y Auditoría de Operadores
// =======================================================================================================

const SHEETS = {
  ASISTENCIA: 'Asistencia',
  TRABAJADORES: 'Trabajadores'
};

// Credenciales seguras del lado del servidor
const USUARIOS_AUTORIZADOS = {
  "JEAN PIRELA": "jp775",
  "DEIBI TUDARES": "dt137",
  "VANESSA ROMERO": "vr061",
  "EDGAR DELMORAL": "ed110"
};

const ADMIN_PASSWORD = "Raida1";

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(3000); // Esperar hasta 3 segundos por el bloqueo

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const payload = JSON.parse(e.postData.contents);

    // Soporte para autenticación y verificación de roles
    if (payload.action === 'login') {
      const op = (payload.operador || '').toUpperCase().trim();
      const pass = (payload.password || '').toLowerCase().trim();
      if (USUARIOS_AUTORIZADOS[op] && USUARIOS_AUTORIZADOS[op] === pass) {
        return response({ autorizado: true });
      } else {
        return response({ autorizado: false, message: 'Credenciales inválidas' });
      }
    }

    if (payload.action === 'verificarAdmin') {
      const pass = payload.password || '';
      if (pass === ADMIN_PASSWORD) {
        return response({ autorizado: true });
      } else {
        return response({ autorizado: false, message: 'Clave de administrador incorrecta' });
      }
    }

    const type = payload.type; // 'attendance' o 'workers'
    const data = payload.data;
    const timestamp = new Date();

    if (type === 'attendance') {
      // MODIFICADO: Se añade la columna 'Modificado Por' al inicializar la hoja (10 columnas en total)
      const sheet = getOrCreateSheet(ss, SHEETS.ASISTENCIA, [
        'Timestamp', 'Fecha Asistencia', 'Cédula', 'Nombre', 'Cargo', 'Área', 'Ubicación', 'Nómina', 'Estado', 'Modificado Por'
      ]);

      const existingData = sheet.getDataRange().getValues();
      const headers = existingData.shift();

      const recordsToProcess = Array.isArray(data) ? data : [data];

      recordsToProcess.forEach(record => {
        // Buscar por Fecha (Col B) y Cédula (Col C)
        let rowIndex = -1;
        for (let i = 0; i < existingData.length; i++) {
          const sheetDate = formatDate(existingData[i][1]);
          const recordDate = formatDate(record.fecha);
          if (sheetDate === recordDate && String(existingData[i][2]) === String(record.cedula)) {
            rowIndex = i + 2; // +2 por header y base 1
            break;
          }
        }

        // MODIFICADO: Se añade 'record.modificado_por' como el décimo elemento del arreglo
        const rowData = [
          timestamp,
          record.fecha,
          record.cedula,
          record.nombre,
          record.cargo,
          record.area,
          record.ubicacion,
          record.nomina,
          record.asistencia,
          record.modificado_por || 'SISTEMA'
        ];

        if (rowIndex > 0) {
          // MODIFICADO: Cambiado el parámetro de ancho de celda de 9 a 10 columnas
          sheet.getRange(rowIndex, 1, 1, 10).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
          // Actualizar existingData para evitar duplicados en el mismo lote
          existingData.push(rowData);
        }
      });

      return response({ result: 'success', message: 'Asistencia sincronizada' });
    }

    if (type === 'workers') {
      const sheet = getOrCreateSheet(ss, SHEETS.TRABAJADORES, [
        'Cédula', 'Nombre', 'Cargo', 'Área', 'Ubicación', 'Nómina', 'Ultima_Actualizacion'
      ]);

      const existingData = sheet.getDataRange().getValues();
      existingData.shift();

      const workers = Array.isArray(data) ? data : [data];

      workers.forEach(worker => {
        let rowIndex = -1;
        for (let i = 0; i < existingData.length; i++) {
          if (String(existingData[i][0]) === String(worker.cedula)) {
            rowIndex = i + 2;
            break;
          }
        }

        const rowData = [
          worker.cedula,
          worker.nombre,
          worker.cargo,
          worker.area,
          worker.ubicacion,
          worker.nomina,
          timestamp
        ];

        if (rowIndex > 0) {
          sheet.getRange(rowIndex, 1, 1, 7).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
          existingData.push(rowData);
        }
      });

      return response({ result: 'success', message: 'Trabajadores synchronized' });
    }

    return response({ result: 'error', message: 'Tipo de operación no válida' });

  } catch(error) {
    return response({ result: 'error', error: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e.parameter.action; // 'all', 'workers', 'attendance'

    if (action === 'workers' || action === 'all') {
      const sheet = ss.getSheetByName(SHEETS.TRABAJADORES);
      const workers = sheet ? sheetToObjects(sheet) : [];
      if (action === 'workers') return response(workers);

      const attendanceSheet = ss.getSheetByName(SHEETS.ASISTENCIA);
      const attendance = attendanceSheet ? sheetToObjects(attendanceSheet) : [];

      return response({ workers, attendance });
    }

    if (action === 'attendance') {
      const sheet = ss.getSheetByName(SHEETS.ASISTENCIA);
      return response(sheet ? sheetToObjects(sheet) : []);
    }

    return response({ message: 'Nexus Backend Activo' });
  } catch(error) {
    return response({ result: 'error', error: error.toString() });
  }
}

// --- Utilidades ---

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data.shift();

  // MODIFICADO: Se añade la traducción de la cabecera 'Modificado Por' a la clave 'modificado_por' de JS
  const headerMap = {
    'Cédula': 'cedula',
    'Nombre': 'nombre',
    'Cargo': 'cargo',
    'Área': 'area',
    'Ubicación': 'ubicacion',
    'Nómina': 'nomina',
    'Fecha Asistencia': 'fecha',
    'Estado': 'asistencia',
    'Ultima_Actualizacion': 'updated_at',
    'Timestamp': 'timestamp',
    'Modificado Por': 'modificado_por'
  };

  return data.map(row => {
    const obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      if (val instanceof Date) {
        val = formatDate(val);
      }
      const key = headerMap[header] || header.toLowerCase().replace(/ /g, '_');
      obj[key] = val;
    });
    return obj;
  });
}

function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string') return date.split('T')[0];
  const d = new Date(date);
  const month = '' + (d.getMonth() + 1);
  const day = '' + d.getDate();
  const year = d.getFullYear();
  return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
}

function response(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}


