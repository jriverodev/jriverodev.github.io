// =========================================================================
// TTOCC SYSTEM - BACKEND CENTRAL (Google Apps Script)
// API Endpoint para Gestión de Flota e Historial de Mantenimiento
// =========================================================================

// ⚠️ CONFIGURACIÓN INICIAL:
// Crea una carpeta en tu Google Drive, copia su ID de la URL y pégalo aquí abajo.
const CONFIG_DRIVE_FOLDER_ID = "1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg";

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Historial_Mantenimiento");

    if (!sheet) {
      return retornarJSON({ status: "ERROR", message: "La pestaña 'Historial_Mantenimiento' no fue encontrada." });
    }

    // MAPEO DE COLUMNAS (Estructura fija de 14 columnas)
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
    var COL_TAREAS = 14;       // N (Columna para el JSON del Checklist)

    // ==========================================
    // ACCIÓN 1: LEER DATOS
    // ==========================================
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

    // ==========================================
    // ACCIÓN 2: EDITAR REGISTRO (Modal y Checklists)
    // ==========================================
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

          // Inyección de campos en la fila correspondiente
          sheet.getRange(numeroFila, COL_MARCA).setValue(payload.marca);
          sheet.getRange(numeroFila, COL_ESTATUS).setValue(payload.estatus);
          sheet.getRange(numeroFila, COL_OBSERVA).setValue(payload.observaciones);
          sheet.getRange(numeroFila, COL_FOTO_ANTES).setValue(payload.foto_antes);
          sheet.getRange(numeroFila, COL_FOTO_DESPUES).setValue(urlFotoDespuesFinal);
          sheet.getRange(numeroFila, COL_AVANCE).setValue(payload.avance);

          // Sincronizar el estado del string JSON de las tareas del checklist
          if (payload.tareas) {
            sheet.getRange(numeroFila, COL_TAREAS).setValue(payload.tareas);
          }

          // Control automatizado de fechas de salida
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

    // ==========================================
    // ACCIÓN 3: CREAR NUEVO REGISTRO
    // ==========================================
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

      // Estructuración de la nueva fila mapeada perfectamente
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
      nuevaFila[COL_TAREAS - 1] = "[]"; // Inicializa el checklist vacío

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
 * Recibe los datos binarios en Base64 de la PWA, genera el archivo físico en Google Drive
  * y retorna un enlace directo (direct stream link) compatible con etiquetas <img>
   */
function guardarFotoEnDrive(base64Data, nombreArchivo) {
  try {
    if (CONFIG_DRIVE_FOLDER_ID === "TU_ID_DE_CARPETA_DE_GOOGLE_DRIVE_AQUI" || !CONFIG_DRIVE_FOLDER_ID) {
      return "Error: ID de carpeta de Drive no configurado en Código.gs";
    }

    // Aislar la cadena pura de Base64 omitiendo el prefijo 'data:image/jpeg;base64,'
    var partes = base64Data.split(",");
    var rawData = partes.length > 1 ? partes[1] : partes[0];

    // Convertir el string base64 en un archivo binario (Blob)
    var blob = Utilities.newBlob(Utilities.base64Decode(rawData), "image/jpeg", nombreArchivo);

    // Acceder a la carpeta destino e instanciar el archivo
    var carpeta = DriveApp.getFolderById(CONFIG_DRIVE_FOLDER_ID);
    var archivo = carpeta.createFile(blob);

    // Conceder permisos de lectura pública mediante enlace para que la PWA dibuje la imagen sin loguearse
    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Retornar la estructura URL de renderizado directo
    return "https://drive.google.com/uc?export=view&id=" + archivo.getId();

  } catch (e) {
    return "Error al guardar en Drive: " + e.toString();
  }
}

function retornarJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
function probarPermisos() {
  var carpeta = DriveApp.getFolderById("1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg");

  // 1. Forzamos el permiso de ESCRITURA creando un archivo de texto de prueba
  var archivoPrueba = carpeta.createFile("prueba_permisos.txt", "Verificación de escritura para PWA", "text/plain");
  Logger.log("¡Permisos de ESCRITURA aprobados! Archivo creado: " + archivoPrueba.getName());

  // 2. Limpiamos la carpeta enviando el archivo de prueba a la papelera
  archivoPrueba.setTrashed(true);
}
