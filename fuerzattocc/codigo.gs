const FOLDER_ID = "1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg";

/**
 * Endpoint GET para obtener registros o verificar estado de la API.
 */
function doGet(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders(sheet);
    const records = fetchAllRecords(sheet);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      service: "Control de Fuerza Laboral API",
      timestamp: new Date().toISOString(),
      records: records
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Endpoint POST para recibir peticiones de sincronización desde la PWA.
 */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const driveUrls = {};

    // Asegurar encabezados si la hoja está vacía
    ensureHeaders(sheet);

    if (data.action === "PULL" || data.action === "READ" || data.accion === "leer") {
      const records = fetchAllRecords(sheet);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        records: records
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === "SYNC") {
      data.records.forEach(r => {
        let docUrl = r.docUrl || "";

        // Subir archivo a Google Drive si existe
        if (r.fileData && r.fileName) {
          docUrl = uploadFileToDrive(r.fileData, r.fileName, r.cedula);
          driveUrls[r.cedula] = docUrl;
        }

        // Estructura ordenada de las 37 Columnas (Campos completos + Vacaciones + Fecha actualización)
        const rowData = [
          r.item || "",
          r.nPersonal || "",
          r.cedula,
          r.nombreApellido,
          r.puestoFuncional || "",
          r.posicionSap || "",
          r.descripPosic || "",
          r.nomina || "",
          r.indicador || "",
          r.estatusCondicion || "",
          r.statusFl || "",
          r.diasPendientesVacaciones || 0,
          r.periodoVacacional || "",
          r.estatusVacaciones || "",
          r.dirAdjunta || "",
          r.gcia1raLinea || "",
          r.gcia2daLinea || "",
          r.gcia3eraLinea || "",
          r.instalacionEdif || "",
          r.localidadTrabajo || "",
          r.extensionOfic || "",
          r.celular || "",
          r.cedulaSupervisor || "",
          r.nombreSupervisor || "",
          r.indicadorSupervisor || "",
          r.telefonoSupervisor || "",
          r.flRrhhResponsable || "",
          r.ubicacionAsignacion || "",
          r.direccionHabitacion || "",
          r.municipioVivienda || "",
          // Campos Anexos y Alertas
          r.fechaNacimiento || "",
          r.fechaAniversario || "",
          r.vencLicencia || "",
          r.vencCedula || "",
          r.vencCartaMedica || "",
          docUrl,
          new Date() // Fecha de actualización
        ];

        const row = findRowByCedula(sheet, r.cedula);
        if (row > 0) {
          sheet.getRange(row, 1, 1, rowData.length).setValues([rowData]);
        } else {
          sheet.appendRow(rowData);
        }
      });

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        urls: driveUrls,
        processedCount: data.records.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Acción no reconocida"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Crea la fila de encabezados si la hoja está totalmente vacía.
 */
function ensureHeaders(sheet) {
  const targetSheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (!targetSheet) return;

  if (targetSheet.getLastRow() === 0) {
    const headers = [
      "ITEM", "N° PERSONAL", "CEDULA", "NOMBRE Y APELLIDO", "PUESTO FUNCIONAL",
      "POSICION SAP", "DESCRIP DE LA POSIC", "NOMINA DEL TRABAJADOR", "INDICADOR DEL TRABAJADOR",
      "ESTATUS DE CONDICION", "STATUS DE FL", "DÍAS PENDIENTES VACACIONES", "PERÍODO VACACIONAL", "ESTATUS VACACIONES",
      "DIRECCION ADJUNTA / HABILITADORA", "GERENCIA 1RA LINEA ORG", "GCIA 2DA LINEA ORG", "GCIA 3ERA LINEA ORG",
      "INSTALACION / EDIFICIO", "LOCALIDAD TRABAJO", "EXTENSION DE OFICINA", "CELULAR",
      "CÉDULA DEL SUPERVISOR", "NOMBRE DEL SUPERVISOR", "INDICADOR DEL SUPERVISOR", "TELÉFONO SUPERVISOR",
      "FL/RRHH RESPONSABLE", "UBICACIÓN DE ASIGNACIÓN", "DIRECCIÓN HABITACIÓN", "MUNICIPIO VIVIENDA",
      "FECHA NACIMIENTO", "FECHA ANIVERSARIO", "VENC. LICENCIA", "VENC. CÉDULA", "VENC. CARTA MÉDICA",
      "URL DOCUMENTO (DRIVE)", "FECHA ACTUALIZACIÓN"
    ];
    targetSheet.appendRow(headers);
    targetSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#003366").setFontColor("#FFFFFF");
  }
}

/**
 * Sube archivos codificados en Base64 a Google Drive.
 */
function uploadFileToDrive(base64Data, fileName, cedula) {
  if (!base64Data || typeof base64Data !== 'string') {
    return "";
  }
  if (!FOLDER_ID || FOLDER_ID.includes("COLOCA_AQUI")) {
    throw new Error("ID de carpeta de Google Drive no configurado en FOLDER_ID.");
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  let contentType = "application/octet-stream";
  let base64Body = base64Data;

  if (base64Data.indexOf(";") > -1 && base64Data.indexOf(",") > -1) {
    contentType = base64Data.split(';')[0].replace("data:", "") || contentType;
    base64Body = base64Data.split(',')[1];
  }

  const bytes = Utilities.base64Decode(base64Body);
  const blob = Utilities.newBlob(bytes, contentType, `${cedula || "DOC"}_${fileName || "anexo"}`);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * Obtiene todos los registros guardados en la hoja de cálculo de Google.
 */
function fetchAllRecords(sheet) {
  const targetSheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (!targetSheet) return [];

  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) return [];

  const data = targetSheet.getDataRange().getValues();
  const headers = data[0];
  const list = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cedula = String(row[2] || "").trim();
    if (!cedula) continue;

    list.push({
      item: String(row[0] || ""),
      nPersonal: String(row[1] || ""),
      cedula: cedula,
      nombreApellido: String(row[3] || ""),
      puestoFuncional: String(row[4] || ""),
      posicionSap: String(row[5] || ""),
      descripPosic: String(row[6] || ""),
      nomina: String(row[7] || ""),
      indicador: String(row[8] || ""),
      estatusCondicion: String(row[9] || ""),
      statusFl: String(row[10] || ""),
      diasPendientesVacaciones: row[11] || 0,
      periodoVacacional: String(row[12] || ""),
      estatusVacaciones: String(row[13] || "AL DIA"),
      dirAdjunta: String(row[14] || ""),
      gcia1raLinea: String(row[15] || ""),
      gcia2daLinea: String(row[16] || ""),
      gcia3eraLinea: String(row[17] || ""),
      instalacionEdif: String(row[18] || ""),
      localidadTrabajo: String(row[19] || ""),
      extensionOfic: String(row[20] || ""),
      celular: String(row[21] || ""),
      cedulaSupervisor: String(row[22] || ""),
      nombreSupervisor: String(row[23] || ""),
      indicadorSupervisor: String(row[24] || ""),
      telefonoSupervisor: String(row[25] || ""),
      flRrhhResponsable: String(row[26] || ""),
      ubicacionAsignacion: String(row[27] || ""),
      direccionHabitacion: String(row[28] || ""),
      municipioVivienda: String(row[29] || ""),
      fechaNacimiento: row[30] ? String(row[30]) : "",
      fechaAniversario: row[31] ? String(row[31]) : "",
      vencLicencia: row[32] ? String(row[32]) : "",
      vencCedula: row[33] ? String(row[33]) : "",
      vencCartaMedica: row[34] ? String(row[34]) : "",
      docUrl: String(row[35] || ""),
      syncStatus: 'EN_NUBE'
    });
  }

  return list;
}

/**
 * Busca el número de fila existente utilizando la columna 3 (CÉDULA).
 */
function findRowByCedula(sheet, cedula) {
  const targetSheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (!targetSheet || !cedula) return -1;

  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) return -1;

  const data = targetSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(cedula).trim()) return i + 1;
  }
  return -1;
}
