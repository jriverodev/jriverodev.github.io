// =========================================================================
// TTOCC SYSTEM - BACKEND CENTRAL (Google Apps Script)
// API Endpoint Seguro para Gestión de Flota e Historial de Mantenimiento
// =========================================================================

// ⚠️ CONFIGURACIÓN INICIAL:
const CONFIG_DRIVE_FOLDER_ID = "1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg";

// Formato de fecha y hora unificado
const FORMATO_FECHA_HORA = "dd-MM-yyyy HH:mm:ss";

// Duración de la sesión en milisegundos (12 horas = 12 * 60 * 60 * 1000)
const DURACION_SESION_MS = 12 * 60 * 60 * 1000;

// =========================================================================
// MÓDULO DE SEGURIDAD, SANITIZACIÓN Y HASHING DE CONTRASEÑAS
// =========================================================================

function sanitizeInput(data) {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") {
    return data
      .replace(/<[^>]*>?/gm, "") 
      .replace(/[\r\n\t]/g, " ") 
      .trim();
  } else if (Array.isArray(data)) {
    return data.map(function(item) { return sanitizeInput(item); });
  } else if (typeof data === "object") {
    var sanitized = {};
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        sanitized[key] = sanitizeInput(data[key]);
      }
    }
    return sanitized;
  }
  return data;
}

function calcularHashPassword(password, salt) {
  var textoCombinado = String(password).trim().toLowerCase() + String(salt);
  var rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    textoCombinado,
    Utilities.Charset.UTF_8
  );
  var hashHex = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    var byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = "0" + byteHex;
    hashHex += byteHex;
  }
  return hashHex;
}

function generarSaltAleatorio() {
  var chars = "abcdef0123456789";
  var salt = "";
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

function inicializarUsuarios() {
  var userProperties = PropertiesService.getScriptProperties();
  var usuariosExistentes = userProperties.getProperty("TTOCC_USUARIOS_DB");

  var dbUsuarios = {};
  if (usuariosExistentes) {
    try {
      dbUsuarios = JSON.parse(usuariosExistentes);
    } catch (e) {
      dbUsuarios = {};
    }
  }

  var usuariosSemilla = [
    { usuario: "WILLIAM RIOS", pass: "wr123" },
    { usuario: "VANNESA ROMERO", pass: "vr456" },
    { usuario: "PEDRO POLANCO", pass: "pp789" },
    { usuario: "DEXCYBEL SALAZAR", pass: "ds123" },
    { usuario: "JUAN ESCALONA", pass: "je456" },
    { usuario: "IVANA SAEZ", pass: "is789" },
    { usuario: "DELVIN MARRERO", pass: "dm012" }
  ];

  var actualizado = false;
  usuariosSemilla.forEach(function(item) {
    var key = item.usuario.toUpperCase().trim();
    if (!dbUsuarios[key]) {
      var salt = generarSaltAleatorio();
      var hash = calcularHashPassword(item.pass, salt);
      dbUsuarios[key] = { salt: salt, hash: hash };
      actualizado = true;
    }
  });

  if (actualizado || !usuariosExistentes) {
    userProperties.setProperty("TTOCC_USUARIOS_DB", JSON.stringify(dbUsuarios));
  }

  return dbUsuarios;
}

function autenticarUsuario(usuarioInput, passwordInput) {
  var dbUsuarios = inicializarUsuarios();
  var usuarioUpper = String(usuarioInput || "").toUpperCase().trim();
  var userRecord = dbUsuarios[usuarioUpper];

  if (!userRecord) return false;

  var hashCalculado = calcularHashPassword(passwordInput, userRecord.salt);
  return hashCalculado === userRecord.hash;
}

function generarTokenSesion(usuario) {
  var userProperties = PropertiesService.getScriptProperties();
  var token = "TTOCC_SEC_" + Utilities.getUuid().replace(/-/g, "");
  var ahora = new Date().getTime();
  var expiracion = ahora + DURACION_SESION_MS;

  var sesionesStr = userProperties.getProperty("TTOCC_SESIONES_DB") || "{}";
  var sesiones = {};
  try { sesiones = JSON.parse(sesionesStr); } catch (e) { sesiones = {}; }

  var sesionesLimpias = {};
  for (var k in sesiones) {
    if (sesiones[k] && sesiones[k].expiracion > ahora) {
      sesionesLimpias[k] = sesiones[k];
    }
  }

  sesionesLimpias[token] = {
    usuario: usuario.toUpperCase().trim(),
    expiracion: expiracion,
    creado: ahora
  };

  userProperties.setProperty("TTOCC_SESIONES_DB", JSON.stringify(sesionesLimpias));

  return { token: token, usuario: usuario.toUpperCase().trim(), expiracion: expiracion };
}

function validarTokenSesion(token) {
  if (!token) return { valido: false, usuario: null };

  var userProperties = PropertiesService.getScriptProperties();
  var sesionesStr = userProperties.getProperty("TTOCC_SESIONES_DB") || "{}";
  var sesiones = {};
  try { sesiones = JSON.parse(sesionesStr); } catch (e) { return { valido: false, usuario: null }; }

  var sesion = sesiones[token];
  if (!sesion) return { valido: false, usuario: null };

  var ahora = new Date().getTime();
  if (ahora > sesion.expiracion) {
    return { valido: false, usuario: null };
  }

  return { valido: true, usuario: sesion.usuario };
}

// =========================================================================
// DISPATCHER PRINCIPAL (doPost)
// =========================================================================

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return retornarJSON({ status: "ERROR", message: "Petición vacía o malformada." });
    }

    var payloadRaw = JSON.parse(e.postData.contents);
    var payload = sanitizeInput(payloadRaw);

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Obtener o crear 'Historial_Mantenimiento' respetando exactamente el esquema provisto
    var sheet = ss.getSheetByName("Historial_Mantenimiento");
    if (!sheet) {
      sheet = ss.insertSheet("Historial_Mantenimiento");
      sheet.appendRow([
        "ID_Registro", "ID_Unidad", "Tipo_Flota", "Nombre_Taller", "Taller_Ext", 
        "Estatus", "Observaciones", "Marca", "Modelo", "Color", 
        "Anio", "Serial", "Tipo_Vehiculo", "Avance", "Foto_Antes", 
        "Foto_Despues", "Fecha_Ingreso", "Fecha_Salida", "Gerencia", "Usuario", 
        "Cargo_Usuario", "Tareas", "Modificado_Por"
      ]);
    }

    // Obtener o crear 'Maestro_Activos'
    var sheetActivos = ss.getSheetByName("Maestro_Activos");
    if (!sheetActivos) {
      sheetActivos = ss.insertSheet("Maestro_Activos");
      sheetActivos.appendRow(["ID_Unidad", "Placa", "Serial", "Marca", "Modelo", "Color", "Tipo_Vehiculo", "Tipo_Flota", "Estatus_Final", "Situacion_Actual", "Gerencia", "Responsable_Usuario", "Cargo_Usuario", "Ubicacion_Taller", "Documento_Url"]);
    }

    // MAPEO EXACTO DE LAS 23 COLUMNAS EN HISTORIAL_MANTENIMIENTO
    var COL_ID_REGISTRO    = 1;  // A
    var COL_UNIDAD         = 2;  // B
    var COL_TIPO_FLOTA     = 3;  // C
    var COL_NOMBRE_TALLER  = 4;  // D
    var COL_TALLER_EXT     = 5;  // E
    var COL_ESTATUS        = 6;  // F
    var COL_OBSERVA        = 7;  // G
    var COL_MARCA          = 8;  // H
    var COL_MODELO         = 9;  // I
    var COL_COLOR          = 10; // J
    var COL_ANIO           = 11; // K
    var COL_SERIAL         = 12; // L
    var COL_TIPO_VEHICULO  = 13; // M
    var COL_AVANCE         = 14; // N
    var COL_FOTO_ANTES     = 15; // O
    var COL_FOTO_DESPUES    = 16; // P
    var COL_FECHA_INGR     = 17; // Q
    var COL_FECHA_SALIDA   = 18; // R
    var COL_GERENCIA       = 19; // S
    var COL_USUARIO        = 20; // T
    var COL_CARGO_USUARIO  = 21; // U
    var COL_TAREAS         = 22; // V
    var COL_MODIFICADO_POR = 23; // W

    // =========================================================================
    // ACCIONES DE AUTENTICACIÓN Y SESIÓN
    // =========================================================================

    if (payload.accion === "login") {
      var usuarioReq = String(payload.usuario || "").toUpperCase().trim();
      var passReq = String(payload.password || "").trim();

      if (!usuarioReq || !passReq) {
        return retornarJSON({ status: "ERROR", message: "Debe proveer usuario y contraseña." });
      }

      if (autenticarUsuario(usuarioReq, passReq)) {
        var sesionObj = generarTokenSesion(usuarioReq);
        return retornarJSON({
          status: "SUCCESS",
          token: sesionObj.token,
          usuario: sesionObj.usuario,
          expiracion: sesionObj.expiracion,
          message: "Autenticación exitosa."
        });
      } else {
        return retornarJSON({ status: "ERROR", message: "Credenciales de acceso inválidas." });
      }
    }

    if (payload.accion === "validar_token") {
      var valRes = validarTokenSesion(payload.token);
      return retornarJSON({
        status: "SUCCESS",
        valido: valRes.valido,
        usuario: valRes.usuario
      });
    }

    // =========================================================================
    // MÓDULO: MAESTRO DE ACTIVOS
    // =========================================================================

    if (payload.accion === "leer_activos") {
      var rango = sheetActivos.getDataRange();
      var valores = rango.getValues();
      var encabezados = valores[0];
      var listaObjetos = [];

      for (var i = 1; i < valores.length; i++) {
        var fila = valores[i];
        var item = {};
        for (var j = 0; j < encabezados.length; j++) {
          item[encabezados[j]] = fila[j];
        }
        listaObjetos.push(item);
      }
      return retornarJSON({ status: "SUCCESS", datos: listaObjetos });
    }

    if (["crear_activo", "editar_activo", "eliminar_activo"].indexOf(payload.accion) !== -1) {
      var authCheckActivos = validarTokenSesion(payload.token);
      if (!authCheckActivos.valido) {
        return retornarJSON({ status: "ERROR", message: "Sesión no autorizada o token expirado." });
      }
    }

    if (payload.accion === "crear_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();
      var datosActivos = sheetActivos.getDataRange().getValues();

      for (var i = 1; i < datosActivos.length; i++) {
        if (String(datosActivos[i][0]).toUpperCase().trim() === idUnidad) {
          return retornarJSON({ status: "ERROR", message: "La unidad '" + idUnidad + "' ya está registrada en el Maestro de Activos." });
        }
      }

      var urlDocumento = "";
      if (payload.documento_base64 && payload.documento_base64 !== "") {
        urlDocumento = guardarDocumentoEnDrive(
          payload.documento_base64,
          "DOC_" + idUnidad + "_" + (payload.documento_nombre || "documento")
        );
      }

      var nuevaFilaActivo = [
        idUnidad,
        payload.placa || "",
        payload.serial || "",
        payload.marca || "",
        payload.modelo || "",
        payload.color || "",
        payload.tipo_vehiculo || "",
        payload.flota || "Liviana",
        payload.estatus_final || "",
        payload.situacion_actual || "",
        payload.gerencia || "",
        payload.responsable_usuario || "",
        payload.cargo_usuario || "",
        payload.ubicacion_taller || "",
        urlDocumento
      ];

      sheetActivos.appendRow(nuevaFilaActivo);
      SpreadsheetApp.flush();

      return retornarJSON({ status: "SUCCESS", message: "Vehículo registrado con éxito en el Maestro de Activos." });
    }

    if (payload.accion === "editar_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();
      var datosActivos = sheetActivos.getDataRange().getValues();

      for (var k = 1; k < datosActivos.length; k++) {
        if (String(datosActivos[k][0]).toUpperCase().trim() === idUnidad) {
          var numeroFila = k + 1;
          var urlDocumentoFinal = datosActivos[k][14] || "";

          if (payload.documento_eliminar) {
            eliminarArchivoDrive(urlDocumentoFinal);
            urlDocumentoFinal = "";
          }

          if (payload.documento_base64 && payload.documento_base64 !== "") {
            if (urlDocumentoFinal) {
              eliminarArchivoDrive(urlDocumentoFinal);
            }
            urlDocumentoFinal = guardarDocumentoEnDrive(
              payload.documento_base64,
              "DOC_" + idUnidad + "_" + (payload.documento_nombre || "documento")
            );
          }

          sheetActivos.getRange(numeroFila, 2).setValue(payload.placa || "");
          sheetActivos.getRange(numeroFila, 3).setValue(payload.serial || "");
          sheetActivos.getRange(numeroFila, 4).setValue(payload.marca || "");
          sheetActivos.getRange(numeroFila, 5).setValue(payload.modelo || "");
          sheetActivos.getRange(numeroFila, 6).setValue(payload.color || "");
          sheetActivos.getRange(numeroFila, 7).setValue(payload.tipo_vehiculo || "");
          sheetActivos.getRange(numeroFila, 8).setValue(payload.flota || "Liviana");
          sheetActivos.getRange(numeroFila, 9).setValue(payload.estatus_final || "");
          sheetActivos.getRange(numeroFila, 10).setValue(payload.situacion_actual || "");
          sheetActivos.getRange(numeroFila, 11).setValue(payload.gerencia || "");
          sheetActivos.getRange(numeroFila, 12).setValue(payload.responsable_usuario || "");
          sheetActivos.getRange(numeroFila, 13).setValue(payload.cargo_usuario || "");
          sheetActivos.getRange(numeroFila, 14).setValue(payload.ubicacion_taller || "");
          sheetActivos.getRange(numeroFila, 15).setValue(urlDocumentoFinal);

          SpreadsheetApp.flush();
          return retornarJSON({ status: "SUCCESS", message: "Activo técnico actualizado correctamente." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID de Unidad no encontrado en el Maestro de Activos." });
    }

    if (payload.accion === "eliminar_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();
      var datosActivos = sheetActivos.getDataRange().getValues();

      for (var k = 1; k < datosActivos.length; k++) {
        if (String(datosActivos[k][0]).toUpperCase().trim() === idUnidad) {
          var numeroFila = k + 1;
          var urlDoc = datosActivos[k][14];
          eliminarArchivoDrive(urlDoc);

          sheetActivos.deleteRow(numeroFila);
          SpreadsheetApp.flush();

          return retornarJSON({ status: "SUCCESS", message: "Vehículo removido del Maestro de Activos." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID de Unidad no encontrado para eliminar." });
    }

    // =========================================================================
    // MÓDULO: HISTORIAL DE MANTENIMIENTO / TALLERES
    // =========================================================================

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
            item[encabezados[j]] = Utilities.formatDate(fila[j], Session.getScriptTimeZone(), FORMATO_FECHA_HORA);
          } else {
            item[encabezados[j]] = fila[j];
          }
        }
        listaObjetos.push(item);
      }
      return retornarJSON({ status: "SUCCESS", datos: listaObjetos });
    }

    if (["crear", "editar", "eliminar"].indexOf(payload.accion) !== -1) {
      var authCheckHistorial = validarTokenSesion(payload.token);
      if (!authCheckHistorial.valido) {
        return retornarJSON({ status: "ERROR", message: "Sesión no autorizada o token expirado. Por favor inicie sesión." });
      }
    }

    if (payload.accion === "editar") {
      var datos = sheet.getDataRange().getValues();
      var idBuscado = String(payload.id_registro);

      for (var k = 1; k < datos.length; k++) {
        if (String(datos[k][COL_ID_REGISTRO - 1]) === idBuscado) {
          var numeroFila = k + 1;

          var urlFotoDespuesFinal = payload.foto_despues || "";
          if (payload.foto_despues_base64 && payload.foto_despues_base64 !== "") {
            urlFotoDespuesFinal = guardarFotoEnDrive(
              payload.foto_despues_base64,
              "DESPUES_" + idBuscado + "_" + (payload.unidad || "unidad") + ".jpg"
            );
          }

          sheet.getRange(numeroFila, COL_TIPO_FLOTA).setValue(payload.flota || "");
          sheet.getRange(numeroFila, COL_NOMBRE_TALLER).setValue(payload.nombre_taller || "");
          sheet.getRange(numeroFila, COL_TALLER_EXT).setValue(payload.nombre_taller_ext || "");
          sheet.getRange(numeroFila, COL_ESTATUS).setValue(payload.estatus || "");
          sheet.getRange(numeroFila, COL_OBSERVA).setValue(payload.observaciones || "");
          sheet.getRange(numeroFila, COL_MARCA).setValue(payload.marca || "");
          sheet.getRange(numeroFila, COL_MODELO).setValue(payload.modelo || "");
          sheet.getRange(numeroFila, COL_COLOR).setValue(payload.color || "");
          sheet.getRange(numeroFila, COL_ANIO).setValue(payload.anio || "");
          sheet.getRange(numeroFila, COL_SERIAL).setValue(payload.serial || "");
          sheet.getRange(numeroFila, COL_TIPO_VEHICULO).setValue(payload.tipo_vehiculo || "");
          sheet.getRange(numeroFila, COL_AVANCE).setValue(payload.avance || 0);
          sheet.getRange(numeroFila, COL_FOTO_ANTES).setValue(payload.foto_antes || "");
          sheet.getRange(numeroFila, COL_FOTO_DESPUES).setValue(urlFotoDespuesFinal);
          sheet.getRange(numeroFila, COL_GERENCIA).setValue(payload.gerencia || "");
          sheet.getRange(numeroFila, COL_USUARIO).setValue(payload.usuario || "");
          sheet.getRange(numeroFila, COL_CARGO_USUARIO).setValue(payload.cargo_usuario || "");
          sheet.getRange(numeroFila, COL_MODIFICADO_POR).setValue(payload.modificado_por || "");

          if (payload.tareas) {
            sheet.getRange(numeroFila, COL_TAREAS).setValue(payload.tareas);
          }

          if (payload.fecha_salida && payload.fecha_salida !== "") {
            sheet.getRange(numeroFila, COL_FECHA_SALIDA).setValue(payload.fecha_salida);
          } else if (payload.estatus === "Listo") {
            var fechaHoyConHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), FORMATO_FECHA_HORA);
            sheet.getRange(numeroFila, COL_FECHA_SALIDA).setValue(fechaHoyConHora);
          } else {
            sheet.getRange(numeroFila, COL_FECHA_SALIDA).setValue("");
          }

          SpreadsheetApp.flush();
          return retornarJSON({ status: "SUCCESS", message: "Sincronizado correctamente." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID no encontrado." });
    }

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

      var fechaIngresoFinal = payload.fecha_ingreso || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), FORMATO_FECHA_HORA);

      var urlFotoDrive = "";
      if (payload.foto_antes_base64 && payload.foto_antes_base64 !== "") {
        urlFotoDrive = guardarFotoEnDrive(
          payload.foto_antes_base64,
          "ANTES_" + nuevoId + "_" + (payload.unidad || "unidad") + ".jpg"
        );
      }

      // Matriz de 23 posiciones totalmente sincronizada con los índices A-W (0 a 22)
      var nuevaFila = new Array(23).fill("");
      nuevaFila[COL_ID_REGISTRO - 1]    = nuevoId;
      nuevaFila[COL_UNIDAD - 1]         = payload.unidad || "S/I";
      nuevaFila[COL_TIPO_FLOTA - 1]     = payload.flota || "";
      nuevaFila[COL_NOMBRE_TALLER - 1]  = payload.nombre_taller || "";
      nuevaFila[COL_TALLER_EXT - 1]     = payload.nombre_taller_ext || "";
      nuevaFila[COL_ESTATUS - 1]        = payload.estatus || "Por Atender";
      nuevaFila[COL_OBSERVA - 1]        = payload.observaciones || "";
      nuevaFila[COL_MARCA - 1]          = payload.marca || "";
      nuevaFila[COL_MODELO - 1]         = payload.modelo || "";
      nuevaFila[COL_COLOR - 1]          = payload.color || "";
      nuevaFila[COL_ANIO - 1]           = payload.anio || "";
      nuevaFila[COL_SERIAL - 1]         = payload.serial || "";
      nuevaFila[COL_TIPO_VEHICULO - 1]  = payload.tipo_vehiculo || "";
      nuevaFila[COL_AVANCE - 1]         = payload.avance || 0;
      nuevaFila[COL_FOTO_ANTES - 1]     = urlFotoDrive;
      nuevaFila[COL_FOTO_DESPUES - 1]    = payload.foto_despues || "";
      nuevaFila[COL_FECHA_INGR - 1]     = fechaIngresoFinal;
      nuevaFila[COL_FECHA_SALIDA - 1]   = payload.fecha_salida || "";
      nuevaFila[COL_GERENCIA - 1]       = payload.gerencia || "";
      nuevaFila[COL_USUARIO - 1]        = payload.usuario || "";
      nuevaFila[COL_CARGO_USUARIO - 1]  = payload.cargo_usuario || "";
      nuevaFila[COL_TAREAS - 1]         = payload.tareas || "[]";
      nuevaFila[COL_MODIFICADO_POR - 1] = payload.modificado_por || "";

      sheet.appendRow(nuevaFila);
      SpreadsheetApp.flush();

      return retornarJSON({ status: "SUCCESS", message: "Registrado con éxito.", id_asignado: nuevoId });
    }

    if (payload.accion === "eliminar") {
      var datos = sheet.getDataRange().getValues();
      var idBuscado = String(payload.id_registro);

      for (var k = 1; k < datos.length; k++) {
        if (String(datos[k][COL_ID_REGISTRO - 1]) === idBuscado) {
          var numeroFila = k + 1;

          var urlFotoAntes = datos[k][COL_FOTO_ANTES - 1];
          var urlFotoDespues = datos[k][COL_FOTO_DESPUES - 1];

          eliminarArchivoDrive(urlFotoAntes);
          eliminarArchivoDrive(urlFotoDespues);

          sheet.deleteRow(numeroFila);
          SpreadsheetApp.flush();

          return retornarJSON({ status: "SUCCESS", message: "Registro y archivos eliminados correctamente." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID no encontrado para eliminar." });
    }

    return retornarJSON({ status: "ERROR", message: "Operación no reconocida." });

  } catch (error) {
    return retornarJSON({ status: "ERROR", message: "Error crítico backend: " + error.toString() });
  }
}

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

    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://drive.google.com/thumbnail?id=" + archivo.getId() + "&sz=w1200";

  } catch (e) {
    return "Error al guardar en Drive: " + e.toString();
  }
}

function guardarDocumentoEnDrive(base64Data, nombreArchivo) {
  try {
    if (CONFIG_DRIVE_FOLDER_ID === "TU_ID_DE_CARPETA_DE_GOOGLE_DRIVE_AQUI" || !CONFIG_DRIVE_FOLDER_ID) {
      return "Error: ID de carpeta de Drive no configurado en Código.gs";
    }

    var mimeType = "image/jpeg";
    if (base64Data.indexOf("data:application/pdf") === 0 || (nombreArchivo && nombreArchivo.toLowerCase().indexOf(".pdf") !== -1)) {
      mimeType = "application/pdf";
    } else if (base64Data.indexOf("data:image/png") === 0) {
      mimeType = "image/png";
    }

    var partes = base64Data.split(",");
    var rawData = partes.length > 1 ? partes[1] : partes[0];

    var blob = Utilities.newBlob(Utilities.base64Decode(rawData), mimeType, nombreArchivo);
    var carpeta = DriveApp.getFolderById(CONFIG_DRIVE_FOLDER_ID);
    var archivo = carpeta.createFile(blob);

    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    if (mimeType === "application/pdf") {
      return "https://drive.google.com/uc?export=view&id=" + archivo.getId();
    }
    return "https://drive.google.com/thumbnail?id=" + archivo.getId() + "&sz=w1200";

  } catch (e) {
    return "Error al guardar documento en Drive: " + e.toString();
  }
}

function eliminarArchivoDrive(url) {
  if (!url || typeof url !== "string" || !url.includes("id=")) return;
  try {
    var id = url.split("id=")[1].split("&")[0];
    var archivo = DriveApp.getFileById(id);
    archivo.setTrashed(true);
  } catch (e) {
    Logger.log("No se pudo eliminar el archivo de Drive: " + e.toString());
  }
}

function retornarJSON(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function probarPermisos() {
  var carpeta = DriveApp.getFolderById("1F7qlcKjf3PEir_Svj0ctRXyBqoeG3pXg");
  var archivoPrueba = carpeta.createFile("prueba_permisos.txt", "Verificación de escritura para PWA", "text/plain");
  Logger.log("¡Permisos de ESCRITURA aprobados! Archivo creado: " + archivoPrueba.getName());
  archivoPrueba.setTrashed(true);
}
