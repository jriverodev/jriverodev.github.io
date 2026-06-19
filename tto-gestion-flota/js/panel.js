// =========================================================================
// TTOCC SYSTEM - ARCHIVO LOGICO CENTRAL (panel.js)
// Sincronización PWA de 16 Columnas y carga nativa a Google Drive
// =========================================================================

// ⚠️ REEMPLAZA ESTA URL POR LA DE TU IMPLEMENTACIÓN DE GOOGLE APPS SCRIPT
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzxtjOaMKcuEqEZIgxNChm9VsSf75Ff1taXjmlsw8Nl-JR3mLAs2K3YiyHuvXgD-uOwgg/exec"; 

let cacheDatos = []; // Caché local para evitar peticiones redundantes

// Inicializar la carga de datos al renderizar el DOM
window.addEventListener("DOMContentLoaded", cargarDatos);

/**
 * Consume el backend en Apps Script para extraer el historial de flota
 */
async function cargarDatos() {
  try {
    const respuesta = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "leer" }) // Coincide exactamente con Código.gs
    });
    const resultado = await respuesta.json();
    
    if (resultado.status === "SUCCESS") {
      cacheDatos = resultado.datos;
      renderizarTabla(cacheDatos);
    } else {
      alert("Error en el Backend de Google: " + resultado.message);
    }
  } catch (error) {
    console.error("Fallo de red o CORS:", error);
    const tbody = document.getElementById("tabla_historial");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center py-8 text-red-500 font-semibold">
            ❌ No se pudo conectar con Apps Script. Verifica la URL de despliegue o la conexión de red.
          </td>
        </tr>`;
    }
  }
}

/**
 * Procesa e inyecta las filas dinámicas en la tabla de control
 * @param {Array} datos - Registros mapeados del Google Sheet
 */
function renderizarTabla(datos) {
  const tbody = document.getElementById("tabla_historial");
  if (!tbody) return;

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-8 text-slate-400 font-normal">No hay registros activos en la base de datos.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  datos.forEach((item, index) => {
    // Definición de Badges de Estatus con las paletas de color de Tailwind
    let claseEstatus = "bg-slate-100 text-slate-700 border border-slate-200";
    if (item["ESTATUS"] === "Listo") claseEstatus = "bg-green-50 text-green-700 border border-green-200 font-bold";
    if (item["ESTATUS"] === "En Reparación") claseEstatus = "bg-amber-50 text-amber-700 border border-amber-200";
    if (item["ESTATUS"] === "Por Atender") claseEstatus = "bg-red-50 text-red-700 border border-red-200";
    if (item["ESTATUS"] === "Espera de Repuesto") claseEstatus = "bg-purple-50 text-purple-700 border border-purple-200";
    if (item["ESTATUS"] === "En Diagnóstico") claseEstatus = "bg-blue-50 text-blue-700 border border-blue-200";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-50/80 transition-all duration-150 border-b border-slate-100 last:border-0">
        <td class="px-6 py-4 font-bold text-blue-600">#${item["ID_REGISTRO"]}</td>
        <td class="px-6 py-4 font-semibold text-slate-900">${item["UNIDAD"]}</td>
        <td class="px-6 py-4 text-slate-500 font-medium">${item["FLOTA"] || "—"}</td>
        <td class="px-6 py-4 text-slate-600 font-medium">
          ${item["FOSA"] === "Taller Externo" ? '🏭 <span class="text-xs bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">' + item["TALLER_EXT"] + '</span>' : '🔧 ' + item["FOSA"]}
        </td>
        <td class="px-6 py-4 text-xs font-semibold text-slate-600">${item["GERENCIA_USUARIA"] || "—"}</td>
        <td class="px-6 py-4 text-xs italic text-slate-500 font-normal">${item["CHOFER_RESPONSABLE"] || "No Asignado"}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="w-20 bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
              <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: ${item["AVANCE"]}%"></div>
            </div>
            <span class="text-xs font-bold text-slate-500">${item["AVANCE"]}%</span>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold inline-block tracking-wide shadow-sm ${claseEstatus}">
            ${item["ESTATUS"]}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <button onclick="abrirModalEditar(${index})" class="bg-slate-900 hover:bg-slate-800 text-white font-semibold py-1 px-3 text-xs rounded-lg transition shadow-sm border border-slate-950">
            Editar
          </button>
        </td>
      </tr>
    `;
  });
}

// =========================================================================
// INTERFACES REACTIVAS (MOSTRAR / OCULTAR SECCIONES)
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
// CONTROLADORES DE APERTURA DE MODALES
// =========================================================================

function abrirModalCrear() {
  const form = document.getElementById("form_unidad");
  if (form) form.reset();
  
  document.getElementById("id_registro").value = "";
  document.getElementById("modal_titulo").innerText = "Registrar Nueva Unidad en Flota";
  document.getElementById("contenedor_taller_ext").classList.add("hidden");
  document.getElementById("contenedor_otra_gerencia").classList.add("hidden");
  
  // Apagar inputs de cierre para el flujo inicial de ingreso
  document.getElementById("fecha_salida").disabled = true;
  document.getElementById("foto_despues").disabled = true;
  
  document.getElementById("modal_registro").classList.remove("hidden");
}

function abrirModalEditar(index) {
  const form = document.getElementById("form_unidad");
  if (form) form.reset();
  
  const item = cacheDatos[index];

  document.getElementById("modal_titulo").innerText = `Modificar Registro Unidad: ${item["UNIDAD"]}`;
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
  
  // Liberar controles para el flujo de egreso
  document.getElementById("fecha_salida").disabled = false;
  document.getElementById("foto_despues").disabled = false;

  // Evaluar fosa externa
  document.getElementById("nombre_taller").value = item["FOSA"] || "";
  if (item["FOSA"] === "Taller Externo") {
    document.getElementById("contenedor_taller_ext").classList.remove("hidden");
    document.getElementById("nombre_taller_ext").value = item["TALLER_EXT"] || "";
  } else {
    document.getElementById("contenedor_taller_ext").classList.add("hidden");
  }

  // Evaluar si la gerencia en la DB es una de la lista o fue escrita a mano
  const selectGerencia = document.getElementById("gerencia_usuaria");
  const opcionesLista = ["Operaciones", "Logística", "Mantenimiento", "Seguridad Integral / PCP", "Servicios Logísticos"];
  
  if (item["GERENCIA_USUARIA"] && item["GERENCIA_USUARIA"] !== "") {
    if (opcionesLista.includes(item["GERENCIA_USUARIA"])) {
      selectGerencia.value = item["GERENCIA_USUARIA"];
      document.getElementById("contenedor_otra_gerencia").classList.add("hidden");
    } else {
      selectGerencia.value = "Otra";
      document.getElementById("contenedor_otra_gerencia").classList.remove("hidden");
      document.getElementById("otra_gerencia").value = item["GERENCIA_USUARIA"];
    }
  }

  // Almacenar URLs de fotos previas en campos invisibles para evitar sobreescritura accidental
  document.getElementById("foto_antes_url").value = item["FOTO_ANTES"] || "";
  document.getElementById("foto_despues_url").value = item["FOTO_DESPUES"] || "";

  document.getElementById("modal_registro").classList.remove("hidden");
}

function cerrarModal() {
  document.getElementById("modal_registro").classList.add("hidden");
}

/**
 * Transforma flujos de archivos desde inputs binarios a cadenas Base64 legibles por Apps Script
 * @param {File} file - Instancia del archivo recuperado
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
// TRANSMISIÓN AJAX CRUD (POST PAYLOAD)
// =========================================================================
async function procesarFormulario(event) {
  event.preventDefault();
  const btnGuardar = document.getElementById("btn_guardar");
  
  btnGuardar.disabled = true;
  btnGuardar.innerText = "Sincronizando Nube...";

  const idRegistro = document.getElementById("id_registro").value;
  const accionEjecutar = idRegistro === "" ? "crear" : "editar";

  // Captura inteligente de la gerencia seleccionada
  let gerenciaFinal = document.getElementById("gerencia_usuaria").value;
  if (gerenciaFinal === "Otra") {
    gerenciaFinal = document.getElementById("otra_gerencia").value;
  }

  // Conversión multimedia de imágenes para Google Drive
  let fotoAntesBase64 = "";
  let fotoDespuesBase64 = "";

  const fileAntes = document.getElementById("foto_antes").files[0];
  if (fileAntes) fotoAntesBase64 = await transformarBase64(fileAntes);

  const fileDespues = document.getElementById("foto_despues").files[0];
  if (fileDespues) fotoDespuesBase64 = await transformarBase64(fileDespues);

  // Mapeo simétrico con el backend del archivo Código.gs
  const datosPayload = {
    accion: accionEjecutar,
    id_registro: idRegistro,
    unidad: document.getElementById("unidad").value,
    flota: document.getElementById("flota").value,
    nombre_taller: document.getElementById("nombre_taller").value,
    nombre_taller_ext: document.getElementById("nombre_taller_ext").value,
    marca: document.getElementById("marca").value,
    gerencia: gerenciaFinal,            // Mapeado a Columna O
    usuario: document.getElementById("chofer_usuario").value, // Mapeado a Columna P
    estatus: document.getElementById("estatus").value,
    avance: document.getElementById("avance").value || "0",
    fecha_ingreso: document.getElementById("fecha_ingreso").value,
    fecha_salida: document.getElementById("fecha_salida").value,
    observaciones: document.getElementById("observaciones").value,
    
    // Binarios para procesamiento de DriveApp
    foto_antes_base64: fotoAntesBase64,
    foto_despues_base64: fotoDespuesBase64,
    
    // URLs de respaldo si no hay archivos nuevos cargados
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
      cargarDatos(); // Actualización reactiva instantánea
    } else {
      alert("Error en validación de servidor: " + result.message);
    }
  } catch (err) {
    alert("Fallo crítico de red. No se pudo establecer conexión con Google Apps Script.");
    console.error("Fetch Exception:", err);
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerText = "Sincronizar";
  }
}
