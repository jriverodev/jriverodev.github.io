const FOLDER_ID = "1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg";

/**
 * Endpoint GET para verificar el estado de la API desde el navegador o pruebas HTTP.
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Control de Fuerza Laboral API",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
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
  if (sheet.getLastRow() === 0) {
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
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#003366").setFontColor("#FFFFFF");
  }
}

/**
 * Sube archivos codificados en Base64 a Google Drive.
 */
function uploadFileToDrive(base64Data, fileName, cedula) {
  if (!FOLDER_ID || FOLDER_ID.includes("COLOCA_AQUI")) {
    throw new Error("ID de carpeta de Google Drive no configurado en FOLDER_ID.");
  }
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const contentType = base64Data.split(';')[0].split(':')[1];
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, `${cedula}_${fileName}`);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * Busca el número de fila existente utilizando la columna 3 (CÉDULA).
 */
function findRowByCedula(sheet, cedula) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim() === String(cedula).trim()) return i + 1;
  }
  return -1;
}
