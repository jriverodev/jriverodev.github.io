// =========================================================================
// TTOCC SYSTEM - BACKEND CENTRAL (Google Apps Script)
// API Endpoint para Gestión de Flota e Historial de Mantenimiento
// =========================================================================

// ⚠️ CONFIGURACIÓN INICIAL:
const CONFIG_DRIVE_FOLDER_ID = "1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg";

// =========================================================================
// INTERCEPTOR PARA SOLICITUDES GET (Evita el error 'Script function not found: doGet')
// =========================================================================
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ONLINE",
    message: "TTOCC SYSTEM API - Endpoint operativo. Las peticiones de datos deben enviarse por método POST.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// PROCESADOR DE ACCIONES (POST)
// =========================================================================
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Historial_Mantenimiento");

    if (!sheet) {
      return retornarJSON({ status: "ERROR", message: "La pestaña 'Historial_Mantenimiento' no fue encontrada." });
    }

    // MAPEO DE COLUMNAS (Estructura expandida a 17 columnas)
    var COL_ID_REGISTRO = 1;   // A
    var COL_UNIDAD = 2;        // B
    var COL_FLOTA = 3;         // C
    var COL_FOSA = 4;          // D
    var COL_AVANCE = 5;        // E
    var COL_ESTATUS = 6;       // F
    var COL_OBSERVA = 7;       // G
    var COL_FECHA_INGR = 8;    // H
    var COL_FECHA_SALIDA = 9;  // I
    var COL_MARCA = 10;        // J
    var COL_FOTO_ANTES = 11;   // K
    var COL_FOTO_DESPUES = 12; // L
    var COL_TALLER_EXT = 13;   // M
    var COL_GERENCIA = 14;     // N
    var COL_USUARIO = 15;      // O
    var COL_TAREAS = 16;       // P
    var COL_MODIFICADO_POR = 17; // Q

    // ------------------------------------------
    // ACCIÓN 1: LEER DATOS [POST]
    // ------------------------------------------
    if (payload.accion === "leer") {
      var rango = sheet.getDataRange();
      var valores = rango.getValues();
      var encabezados = valores[0];
      var listaObjetos = [];

      for (var i = 1; i < valores.length; i++) {
        var fila = valores[i];
        var item = {};
        for (var j = 0; j < encabezados.length; j++) {
          if (fila[j] instanceof Date) {
            item[encabezados[j]] = Utilities.formatDate(fila[j], Session.getScriptTimeZone(), "dd-MM-yyyy");
          } else {
            item[encabezados[j]] = fila[j];
          }
        }
        listaObjetos.push(item);
      }
      return retornarJSON({ status: "SUCCESS", datos: listaObjetos });
    }

    // ------------------------------------------
    // ACCIÓN 2: EDITAR REGISTRO [POST]
    // ------------------------------------------
    if (payload.accion === "editar") {
      var datos = sheet.getDataRange().getValues();
      var idBuscado = String(payload.id_registro);

      for (var k = 1; k < datos.length; k++) {
        if (String(datos[k][COL_ID_REGISTRO - 1]) === idBuscado) {
          var numeroFila = k + 1;

          // Procesar Foto Después en Google Drive si viene en Base64 desde el panel
          var urlFotoDespuesFinal = payload.foto_despues || "";
          if (payload.foto_despues_base64 && payload.foto_despues_base64 !== "") {
            urlFotoDespuesFinal = guardarFotoEnDrive(
              payload.foto_despues_base64,
              "DESPUES_" + idBuscado + "_" + (payload.unidad || "unidad") + ".jpg"
            );
          }

          sheet.getRange(numeroFila, COL_MARCA).setValue(payload.marca);
          sheet.getRange(numeroFila, COL_ESTATUS).setValue(payload.estatus);
          sheet.getRange(numeroFila, COL_OBSERVA).setValue(payload.observaciones);
          sheet.getRange(numeroFila, COL_FOTO_ANTES).setValue(payload.foto_antes);
          sheet.getRange(numeroFila, COL_FOTO_DESPUES).setValue(urlFotoDespuesFinal);
          sheet.getRange(numeroFila, COL_AVANCE).setValue(payload.avance);
          sheet.getRange(numeroFila, COL_GERENCIA).setValue(payload.gerencia);
          sheet.getRange(numeroFila, COL_USUARIO).setValue(payload.usuario);
          sheet.getRange(numeroFila, COL_MODIFICADO_POR).setValue(payload.modificado_por || "");

          if (payload.tareas) {
            sheet.getRange(numeroFila, COL_TAREAS).setValue(payload.tareas);
          }

          if (payload.fecha_salida !== "") {
            sheet.getRange(numeroFila, COL_FECHA_SALIDA).setValue(payload.fecha_salida);
          } else if (payload.estatus !== "Listo") {
            sheet.getRange(numeroFila, COL_FECHA_SALIDA).setValue("");
          }

          SpreadsheetApp.flush();
          return retornarJSON({ status: "SUCCESS", message: "Sincronizado correctamente." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID no encontrado." });
    }

    // ------------------------------------------
    // ACCIÓN 3: CREAR NUEVO REGISTRO [POST]
    // ------------------------------------------
    if (payload.accion === "crear") {
      var ultimaFila = sheet.getLastRow();
      var nuevoId = 1;

      if (ultimaFila > 1) {
        var ultimoIdGuardado = sheet.getRange(ultimaFila, COL_ID_REGISTRO).getValue();
        if (!isNaN(ultimoIdGuardado) && ultimoIdGuardado !== "") {
          nuevoId = parseInt(ultimoIdGuardado, 10) + 1;
        } else {
          nuevoId = ultimaFila;
        }
      }

      var fechaIngresoFinal = payload.fecha_ingreso || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy");

      // Procesar Foto Antes en Google Drive si viene en Base64
      var urlFotoDrive = "";
      if (payload.foto_antes_base64 && payload.foto_antes_base64 !== "") {
        urlFotoDrive = guardarFotoEnDrive(
          payload.foto_antes_base64,
          "ANTES_" + nuevoId + "_" + (payload.unidad || "unidad") + ".jpg"
        );
      }

      var nuevaFila = [];
      nuevaFila[COL_ID_REGISTRO - 1] = nuevoId;
      nuevaFila[COL_UNIDAD - 1] = payload.unidad || "S/I";
      nuevaFila[COL_FLOTA - 1] = payload.flota || "";
      nuevaFila[COL_FOSA - 1] = payload.nombre_taller || "";
      nuevaFila[COL_AVANCE - 1] = 0;
      nuevaFila[COL_ESTATUS - 1] = "Por Atender";
      nuevaFila[COL_OBSERVA - 1] = payload.observaciones || "";
      nuevaFila[COL_FECHA_INGR - 1] = fechaIngresoFinal;
      nuevaFila[COL_FECHA_SALIDA - 1] = "";
      nuevaFila[COL_MARCA - 1] = payload.marca || "";
      nuevaFila[COL_FOTO_ANTES - 1] = urlFotoDrive;
      nuevaFila[COL_FOTO_DESPUES - 1] = "";
      nuevaFila[COL_TALLER_EXT - 1] = payload.nombre_taller_ext || "";
      nuevaFila[COL_GERENCIA - 1] = payload.gerencia || "";
      nuevaFila[COL_USUARIO - 1] = payload.usuario || "";
      nuevaFila[COL_TAREAS - 1] = "[]";
      nuevaFila[COL_MODIFICADO_POR - 1] = payload.modificado_por || "";

      sheet.appendRow(nuevaFila);
      SpreadsheetApp.flush();

      return retornarJSON({ status: "SUCCESS", message: "Registrado con éxito.", id_asignado: nuevoId });
    }

    return retornarJSON({ status: "ERROR", message: "Operación no reconocida." });

  } catch (error) {
    return retornarJSON({ status: "ERROR", message: "Error crítico backend: " + error.toString() });
  }
}

/**
 * Recibe los datos binarios en Base64 de la PWA, genera el archivo físico en Google Drive,
 * le otorga permisos públicos de lectura y retorna la URL directa.
 */
function guardarFotoEnDrive(base64Data, nombreArchivo) {
  try {
    if (CONFIG_DRIVE_FOLDER_ID === "TU_ID_DE_CARPETA_DE_GOOGLE_DRIVE_AQUI" || !CONFIG_DRIVE_FOLDER_ID) {
      return "Error: ID de carpeta de Drive no configurado en Código.gs";
    }

    var partes = base64Data.split(",");
    var rawData = partes.length > 1 ? partes[1] : partes[0];

    var blob = Utilities.newBlob(Utilities.base64Decode(rawData), "image/jpeg", nombreArchivo);
    var carpeta = DriveApp.getFolderById(CONFIG_DRIVE_FOLDER_ID);
    var archivo = carpeta.createFile(blob);

    // ⚠️ CAMBIO DE PRIVACIDAD: Otorga acceso público inmediato de lectura para PhotoSwipe
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://google.com" + archivo.getId();

  } catch (error) {
    return "Error al subir archivo: " + error.toString();
  }
}

function retornarJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
