const FOLDER_ID = "COLOCA_AQUI_EL_ID_DE_LA_CARPETA_EN_GOOGLE_DRIVE";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const driveUrls = {};

    if (data.action === "SYNC") {
      data.records.forEach(r => {
        let docUrl = r.docUrl || "";

        // Subir archivo a Google Drive si existe
        if (r.fileData && r.fileName) {
          docUrl = uploadFileToDrive(r.fileData, r.fileName, r.cedula);
          driveUrls[r.cedula] = docUrl;
        }

        // Estructura ordenada de las 33 Columnas
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
          // Campos Anexos
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
        urls: driveUrls
      })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function uploadFileToDrive(base64Data, fileName, cedula) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const contentType = base64Data.split(';')[0].split(':')[1];
  const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
  const blob = Utilities.newBlob(bytes, contentType, `${cedula}_${fileName}`);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function findRowByCedula(sheet, cedula) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] == cedula) return i + 1; // Columna 3 (CÉDULA)
  }
  return -1;
}
