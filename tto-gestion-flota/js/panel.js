// =========================================================================
// TTOCC SYSTEM - FRONTEND LOGIC (panel.js)
// Control de operaciones, modal dinámico, procesamiento Base64 y Fetch API
// =========================================================================

// ⚠️ REEMPLAZA ESTA URL POR LA DE TU IMPLEMENTACIÓN DE GOOGLE APPS SCRIPT
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzxtjOaMKcuEqEZIgxNChm9VsSf75Ff1taXjmlsw8Nl-JR3mLAs2K3YiyHuvXgD-uOwgg/exec"; 

let cacheDatos = []; // Almacenamiento local de los registros de la fosa

// Escuchar la carga del DOM para inicializar la lectura del backend
window.addEventListener("DOMContentLoaded", cargarDatos);

/**
 * Consulta la API de Apps Script para leer las 16 columnas del Google Sheet
 */
async function cargarDatos() {
  try {
    const respuesta = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "read" }) // o "leer", según tu Código.gs
    });
    const resultado = await respuesta.json();
    
    if (resultado.status === "SUCCESS") {
      cacheDatos = resultado.datos;
      renderizarTabla(cacheDatos);
    } else {
      alert("Error de lectura backend: " + resultado.message);
    }
  } catch (e) {
    console.error("Error de conexión:", e);
    const tbody = document.getElementById("tabla_historial");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-6 text-red-500 font-bold">
            ❌ Error de conexión con el Servidor Google App Script. Verifique la URL de despliegue.
          </td>
        </tr>`;
    }
  }
}

/**
 * Renderiza dinámicamente las filas de la tabla con los datos del caché
 * @param {Array} datos - Lista de objetos provenientes del Sheet
 */
function renderizarTabla(datos) {
  const tbody = document.getElementById("tabla_historial");
  if (!tbody) return;

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-6 text-gray-500">No hay registros activos en el historial.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  datos.forEach((item, index) => {
    // Configuración visual de colores según el Estatus de la unidad
    let colorEstatus = "bg-gray-200 text-gray-800";
    if (item["ESTATUS"] === "Listo") colorEstatus = "bg-green-100 text-green-800 font-bold";
    if (item["ESTATUS"] === "En Reparación") colorEstatus = "bg-amber-100 text-amber-800";
    if (item["ESTATUS"] === "Por Atender") colorEstatus = "bg-red-100 text-red-800";

    tbody.innerHTML += `
      <tr class="hover:bg-gray-50 transition text-sm">
        <td class="px-5 py-3 border-b border-gray-200 font-bold text-blue-600">${item["ID_REGISTRO"]}</td>
        <td class="px-5 py-3 border-b border-gray-200 font-semibold">${item["UNIDAD"]}</td>
        <td class="px-5 py-3 border-b border-gray-200">${item["FLOTA"] || "S/I"}</td>
        <td class="px-5 py-3 border-b border-gray-200">
          ${item["FOSA"] === "Taller Externo" ? '🏭 ' + item["TALLER_EXT"] : '🔧 ' + item["FOSA"]}
        </td>
        <td class="px-5 py-3 border-b border-gray-200 text-xs font-medium text-gray-600">${item["GERENCIA_USUARIA"] || "S/I"}</td>
        <td class="px-5 py-3 border-b border-gray-200 text-xs italic text-gray-500">${item["CHOFER_RESPONSABLE"] || "No Asignado"}</td>
        <td class="px-5 py-3 border-b border-gray-200">
          <div class="w-full bg-gray-200 rounded-full h-2 mb-1">
            <div class="bg-blue-600 h-2 rounded-full" style="width: ${item["AVANCE"]}%"></div>
          </div>
          <span class="text-xs text-gray-500 font-medium">${item["AVANCE"]}%</span>
        </td>
        <td class="px-5 py-3 border-b border-gray-200">
          <span class="px-2.5 py-1 inline-flex text-xs leading-5 rounded-full ${colorEstatus}">${item["ESTATUS"]}</span>
        </td>
        <td class="px-5 py-3 border-b border-gray-200 text-center">
          <button onclick="abrirModalEditar(${index})" class="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 px-3 text-xs rounded transition shadow">
            ✏️ Editar
          </button>
        </td>
      </tr>
    `;
  });
}

// =========================================================================
// INTERFACES INTERACTIVAS (CAMPOS VISIBLES / OCULTOS)
// =========================================================================

function alternarTallerExterno() {
  const selectTaller = document.getElementById("nombre_taller");
  const contenedorExt = document.getElementById("contenedor_taller_ext");
  if (!selectTaller || !contenedorExt) return;

  if (selectTaller.value === "Taller Externo") {
    contenedorExt.classList.remove("hidden");
  } else {
    contenedorExt.classList.add("hidden");
    document.getElementById("nombre_taller_ext").value = "";
  }
}

function alternarOtraGerencia() {
  const selectGerencia = document.getElementById("gerencia_usuaria");
  const contenedorOtra = document.getElementById("contenedor_otra_gerencia");
  if (!selectGerencia || !contenedorOtra) return;

  if (selectGerencia.value === "Otra") {
    contenedorOtra.classList.remove("hidden");
    document.getElementById("otra_gerencia").focus();
  } else {
    contenedorOtra.classList.add("hidden");
    document.getElementById("otra_gerencia").value = "";
  }
}

// =========================================================================
// CONTROLADORES DE MODAL (CREAR / EDITAR)
// =========================================================================

function abrirModalCrear() {
  const form = document.getElementById("form_unidad");
  if (form) form.reset();
  
  document.getElementById("id_registro").value = "";
  document.getElementById("modal_titulo").innerText = "Registrar Nueva Unidad en Flota";
  document.getElementById("contenedor_taller_ext").classList.add("hidden");
  document.getElementById("contenedor_otra_gerencia").classList.add("hidden");
  
  // Deshabilitar campos de salida en registros totalmente nuevos
  document.getElementById("fecha_salida").disabled = true;
  document.getElementById("foto_despues").disabled = true;
  
  document.getElementById("modal_registro").classList.remove("hidden");
}

function abrirModalEditar(index) {
  const form = document.getElementById("form_unidad");
  if (form) form.reset();
  
  const item = cacheDatos[index];

  document.getElementById("modal_titulo").innerText = `Modificar Unidad: ${item["UNIDAD"]}`;
  document.getElementById("id_registro").value = item["ID_REGISTRO"];
  document.getElementById("unidad").value = item["UNIDAD"];
  document.getElementById("flota").value = item["FLOTA"] || "";
  document.getElementById("marca").value = item["MARCA"] || "";
  document.getElementById("estatus").value = item["ESTATUS"];
  document.getElementById("avance").value = item["AVANCE"] || "0";
  document.getElementById("observaciones").value = item["OBSERVACIONES"] || "";
  document.getElementById("fecha_ingreso").value = item["FECHA_INGRESO"] || "";
  document.getElementById("fecha_salida").value = item["FECHA_SALIDA"] || "";
  document.getElementById("chofer_usuario").value = item["CHOFER_RESPONSABLE"] || "";
  
  // Habilitar campos de cierre para la edición activa
  document.getElementById("fecha_salida").disabled = false;
  document.getElementById("foto_despues").disabled = false;

  // Evaluar fosa / taller externo
  document.getElementById("nombre_taller").value = item["FOSA"] || "";
  if (item["FOSA"] === "Taller Externo") {
    document.getElementById("contenedor_taller_ext").classList.remove("hidden");
    document.getElementById("nombre_taller_ext").value = item["TALLER_EXT"] || "";
  } else {
    document.getElementById("contenedor_taller_ext").classList.add("hidden");
  }

  // Evaluar Gerencia Usuaria (Dinámica)
  const selectGerencia = document.getElementById("gerencia_usuaria");
  const opcionesPredefinidas = ["Operaciones", "Logística", "Mantenimiento", "Seguridad Integral / PCP", "Servicios Logísticos"];
  
  if (item["GERENCIA_USUARIA"] && item["GERENCIA_USUARIA"] !== "") {
    if (opcionesPredefinidas.includes(item["GERENCIA_USUARIA"])) {
      selectGerencia.value = item["GERENCIA_USUARIA"];
      document.getElementById("contenedor_otra_gerencia").classList.add("hidden");
    } else {
      selectGerencia.value = "Otra";
      document.getElementById("contenedor_otra_gerencia").classList.remove("hidden");
      document.getElementById("otra_gerencia").value = item["GERENCIA_USUARIA"];
    }
  }

  // Retener URLs existentes de imágenes para no perder los enlaces de Drive
  document.getElementById("foto_antes_url").value = item["FOTO_ANTES"] || "";
  document.getElementById("foto_despues_url").value = item["FOTO_DESPUES"] || "";

  document.getElementById("modal_registro").classList.remove("hidden");
}

function cerrarModal() {
  document.getElementById("modal_registro").classList.add("hidden");
}

/**
 * Utilidad asíncrona para convertir un objeto File (imagen) en string Base64
 * @param {File} file - Archivo capturado desde el input file
 */
function transformarBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// =========================================================================
// ENVÍO DE DATOS Y PROCESAMIENTO CRUD (POST)
// =========================================================================
async function procesarFormulario(event) {
  event.preventDefault();
  const btnGuardar = document.getElementById("btn_guardar");
  
  btnGuardar.disabled = true;
  btnGuardar.innerText = "Procesando Backend...";

  const idRegistro = document.getElementById("id_registro").value;
  const accionExec = idRegistro === "" ? "crear" : "editar";

  // Procesar el valor final de la Gerencia Usuaria
  let gerenciaFinal = document.getElementById("gerencia_usuaria").value;
  if (gerenciaFinal === "Otra") {
    gerenciaFinal = document.getElementById("otra_gerencia").value;
  }

  // Capturar archivos multimedia y transformarlos para DriveApp
  let fotoAntesBase64 = "";
  let fotoDespuesBase64 = "";

  const fileAntes = document.getElementById("foto_antes").files[0];
  if (fileAntes) fotoAntesBase64 = await transformarBase64(fileAntes);

  const fileDespues = document.getElementById("foto_despues").files[0];
  if (fileDespues) fotoDespuesBase64 = await transformarBase64(fileDespues);

  // Armar el Payload exacto mapeado a las 16 columnas del backend
  const datosPayload = {
    accion: accionExec,
    id_registro: idRegistro,
    unidad: document.getElementById("unidad").value,
    flota: document.getElementById("flota").value,
    nombre_taller: document.getElementById("nombre_taller").value,
    nombre_taller_ext: document.getElementById("nombre_taller_ext").value,
    marca: document.getElementById("marca").value,
    gerencia: gerenciaFinal,
    usuario: document.getElementById("chofer_usuario").value,
    estatus: document.getElementById("estatus").value,
    avance: document.getElementById("avance").value || "0",
    fecha_ingreso: document.getElementById("fecha_ingreso").value,
    fecha_salida: document.getElementById("fecha_salida").value,
    observaciones: document.getElementById("observaciones").value,
    
    // Cadenas Base64 para inyección multimedia en Google Drive
    foto_antes_base64: fotoAntesBase64,
    foto_despues_base64: fotoDespuesBase64,
    
    // Respaldo de URLs existentes si no se sube un nuevo archivo
    foto_antes: document.getElementById("foto_antes_url").value,
    foto_despues: document.getElementById("foto_despues_url").value
  };

  try {
    const response = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify(datosPayload)
    });
    const result = await response.json();

    if (result.status === "SUCCESS") {
      alert(result.message);
      cerrarModal();
      cargarDatos(); // Refrescar la tabla en tiempo real
    } else {
      alert("Error devuelto por el servidor: " + result.message);
    }
  } catch (err) {
    alert("Fallo crítico de red al intentar sincronizar con Apps Script.");
    console.error("Error en Fetch:", err);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerText = "Sincronizar";
  }
}
