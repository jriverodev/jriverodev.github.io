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

/**
 * Sanitiza recursivamente cualquier entrada para prevenir inyecciones HTML / Script
 */
function sanitizeInput(data) {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") {
    return data
      .replace(/<[^>]*>?/gm, "") // Elimina etiquetas HTML
      .replace(/[\r\n\t]/g, " ") // Reemplaza saltos de línea/tabulaciones por espacios
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

/**
 * Genera un Hash SHA-256 a partir de una contraseña y una sal (salt).
 * Explicación de Seguridad:
 * - Nunca se almacenan contraseñas en texto plano.
 * - La sal (salt) es un valor aleatorio único por usuario que evita ataques de tablas Rainbow.
 * - La combinación contraseña + salt se procesa mediante Utilities.computeDigest con SHA-256.
 */
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

/**
 * Genera una sal (salt) aleatoria de 16 caracteres hexadecimales
 */
function generarSaltAleatorio() {
  var chars = "abcdef0123456789";
  var salt = "";
  for (var i = 0; i < 16; i++) {
    salt += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return salt;
}

/**
 * Inicializa la base de usuarios autorizados en PropertiesService si no existe.
 * Almacena pares { usuario: { salt: string, hash: string } }
 */
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

  // Lista de usuarios por defecto con sus credenciales iniciales
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

/**
 * Autentica un usuario contra la base protegida en ScriptProperties
 */
function autenticarUsuario(usuarioInput, passwordInput) {
  var dbUsuarios = inicializarUsuarios();
  var usuarioUpper = String(usuarioInput || "").toUpperCase().trim();
  var userRecord = dbUsuarios[usuarioUpper];

  if (!userRecord) return false;

  var hashCalculado = calcularHashPassword(passwordInput, userRecord.salt);
  return hashCalculado === userRecord.hash;
}

/**
 * Genera un token de sesión temporal con timestamp de expiración y lo almacena en PropertiesService
 */
function generarTokenSesion(usuario) {
  var userProperties = PropertiesService.getScriptProperties();
  var token = "TTOCC_SEC_" + Utilities.getUuid().replace(/-/g, "");
  var ahora = new Date().getTime();
  var expiracion = ahora + DURACION_SESION_MS;

  var sesionesStr = userProperties.getProperty("TTOCC_SESIONES_DB") || "{}";
  var sesiones = {};
  try { sesiones = JSON.parse(sesionesStr); } catch (e) { sesiones = {}; }

  // Limpiar tokens expirados
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

/**
 * Valida si un token de sesión es legítimo y no ha expirado
 */
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

    // Obtener o crear 'Historial_Mantenimiento'
    var sheet = ss.getSheetByName("Historial_Mantenimiento");
    if (!sheet) {
      sheet = ss.insertSheet("Historial_Mantenimiento");
      sheet.appendRow([
        "ID_Registro", "ID_Unidad", "Tipo_Flota", "Nombre_Taller", "Avance",
        "Estatus", "Observaciones", "Fecha_Ingreso", "Fecha_Salida", "Marca",
        "Foto_Antes", "Foto_Despues", "Nombre_Taller_Ext", "Gerencia",
        "Usuario", "Tareas", "Modificado_Por"
      ]);
    }

    // Obtener o crear 'Maestro_Activos'
    var sheetActivos = ss.getSheetByName("Maestro_Activos");
    if (!sheetActivos) {
      sheetActivos = ss.insertSheet("Maestro_Activos");
      sheetActivos.appendRow(["ID_Unidad", "Placa", "Serial", "Marca", "Tipo_Flota"]);
    }

    // MAPEO DE COLUMNAS (17 columnas en Historial_Mantenimiento)
    var COL_ID_REGISTRO = 1;     // A
    var COL_UNIDAD = 2;          // B
    var COL_FLOTA = 3;           // C
    var COL_FOSA = 4;            // D
    var COL_AVANCE = 5;          // E
    var COL_ESTATUS = 6;         // F
    var COL_OBSERVA = 7;         // G
    var COL_FECHA_INGR = 8;      // H
    var COL_FECHA_SALIDA = 9;    // I
    var COL_MARCA = 10;          // J
    var COL_FOTO_ANTES = 11;     // K
    var COL_FOTO_DESPUES = 12;   // L
    var COL_TALLER_EXT = 13;     // M
    var COL_GERENCIA = 14;       // N
    var COL_USUARIO = 15;        // O
    var COL_TAREAS = 16;         // P
    var COL_MODIFICADO_POR = 17; // Q

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
    // MODULO: MAESTRO DE ACTIVOS
    // =========================================================================

    // LEER ACTIVOS (Lectura Pública)
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

    // VERIFICAR SESIÓN PARA ACCIONES DE ESCRITURA EN ACTIVOS
    if (["crear_activo", "editar_activo", "eliminar_activo"].indexOf(payload.accion) !== -1) {
      var authCheckActivos = validarTokenSesion(payload.token);
      if (!authCheckActivos.valido) {
        return retornarJSON({ status: "ERROR", message: "Sesión no autorizada o token expirado." });
      }
    }

    // CREAR ACTIVO
    if (payload.accion === "crear_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();

      var datosActivos = sheetActivos.getDataRange().getValues();
      for (var i = 1; i < datosActivos.length; i++) {
        if (String(datosActivos[i][0]).toUpperCase().trim() === idUnidad) {
          return retornarJSON({ status: "ERROR", message: "La unidad '" + idUnidad + "' ya está registrada en el Maestro de Activos." });
        }
      }

      var nuevaFilaActivo = [
        idUnidad,
        payload.placa || "",
        payload.serial || "",
        payload.marca || "",
        payload.flota || "Liviana"
      ];

      sheetActivos.appendRow(nuevaFilaActivo);
      SpreadsheetApp.flush();

      return retornarJSON({ status: "SUCCESS", message: "Vehículo registrado con éxito en el Maestro de Activos." });
    }

    // EDITAR ACTIVO
    if (payload.accion === "editar_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();
      var datosActivos = sheetActivos.getDataRange().getValues();

      for (var k = 1; k < datosActivos.length; k++) {
        if (String(datosActivos[k][0]).toUpperCase().trim() === idUnidad) {
          var numeroFila = k + 1;

          sheetActivos.getRange(numeroFila, 2).setValue(payload.placa || "");
          sheetActivos.getRange(numeroFila, 3).setValue(payload.serial || "");
          sheetActivos.getRange(numeroFila, 4).setValue(payload.marca || "");
          sheetActivos.getRange(numeroFila, 5).setValue(payload.flota || "Liviana");

          SpreadsheetApp.flush();
          return retornarJSON({ status: "SUCCESS", message: "Activo técnico actualizado correctamente." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID de Unidad no encontrado en el Maestro de Activos." });
    }

    // ELIMINAR ACTIVO
    if (payload.accion === "eliminar_activo") {
      var idUnidad = String(payload.id_unidad).toUpperCase().trim();
      var datosActivos = sheetActivos.getDataRange().getValues();

      for (var k = 1; k < datosActivos.length; k++) {
        if (String(datosActivos[k][0]).toUpperCase().trim() === idUnidad) {
          var numeroFila = k + 1;

          sheetActivos.deleteRow(numeroFila);
          SpreadsheetApp.flush();

          return retornarJSON({ status: "SUCCESS", message: "Vehículo removido del Maestro de Activos." });
        }
      }
      return retornarJSON({ status: "ERROR", message: "ID de Unidad no encontrado para eliminar." });
    }

    // =========================================================================
    // MODULO: HISTORIAL DE MANTENIMIENTO / TALLERES
    // =========================================================================

    // LEER HISTORIAL (Lectura Pública)
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

    // VERIFICAR SESIÓN PARA ACCIONES DE ESCRITURA EN HISTORIAL
    if (["crear", "editar", "eliminar"].indexOf(payload.accion) !== -1) {
      var authCheckHistorial = validarTokenSesion(payload.token);
      if (!authCheckHistorial.valido) {
        return retornarJSON({ status: "ERROR", message: "Sesión no autorizada o token expirado. Por favor inicie sesión." });
      }
    }

    // EDITAR HISTORIAL
    if (payload.accion === "editar") {
      var datos = sheet.getDataRange().getValues();
      var idBuscado = String(payload.id_registro);

      for (var k = 1; k < datos.length; k++) {
        if (String(datos[k][COL_ID_REGISTRO - 1]) === idBuscado) {
          var numeroFila = k + 1;

          // Procesar Foto Después en Google Drive si viene en Base64
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

    // CREAR HISTORIAL
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

      // Procesar Foto Antes en Google Drive
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

    // ELIMINAR HISTORIAL
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

/**
 * Genera el archivo físico en Google Drive y retorna el stream directo
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

    archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return "https://drive.google.com/thumbnail?id=" + archivo.getId() + "&sz=w1200";

  } catch (e) {
    return "Error al guardar en Drive: " + e.toString();
  }
}

/**
 * Intenta extraer el ID de un archivo de Drive de su URL y lo envía a la papelera
 */
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
