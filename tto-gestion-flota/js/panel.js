// =========================================================================
// TTOCC SYSTEM - LÓGICA DE DETRÁS DE ESCENA (js/panel.js)
// Adaptado 100% al Diseño Dark Mode original de Jesús
// =========================================================================

const WEB_APP_URL = APP_CONFIG.URL_API || "https://script.google.com/macros/s/AKfycbwpevcpIspFtNiYGAdCrrQTIBVpLdohHws6KTYH0btUDXWpeYsoFm6lOwB9fvKxFZgA4A/exec"; 

let cacheDatos = []; 
let tareasActuales = []; // Guarda temporalmente el checklist del registro en edición

// Inicialización automática al cargar la página
window.addEventListener("DOMContentLoaded", cargarTablaEditable);

// =========================================================================
// 1. LEER DATOS Y NORMALIZAR
// =========================================================================
async function cargarTablaEditable() {
  const tbody = document.getElementById("tablaEditableCuerpo");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center py-8 text-slate-500 text-xs animate-pulse">
          <i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Conectando con la matriz en la nube...
        </td>
      </tr>`;
  }

  try {
    const respuesta = await fetch(WEB_APP_URL, {
      method: "POST",
      body: JSON.stringify({ accion: "leer" })
    });
    const resultado = await respuesta.json();
    
    if (resultado.status === "SUCCESS") {
      // Normalizador inteligente de llabas para evitar fallos por mayúsculas/minúsculas en el Sheet
      cacheDatos = resultado.datos.map(item => {
        let itemNormalizado = {};
        for (let llave in item) {
          let llaveLimpia = llave.toUpperCase().trim().replace(/\s+/g, '_');
          itemNormalizado[llaveLimpia] = item[llave];
        }
        return itemNormalizado;
      });
      
      renderizarTabla(cacheDatos);
    } else {
      alert("Error en el Servidor: " + resultado.message);
    }
  } catch (error) {
    console.error("Fallo de red:", error);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-red-500 text-xs font-semibold">
            <i class="fa-solid fa-triangle-exclamation mr-2"></i> Error de conexión con Google Apps Script.
          </td>
        </tr>`;
    }
  }
}

// =========================================================================
// 2. RENDERIZAR TABLA EN MODO OSCURO HIGH-TECH
// =========================================================================
function renderizarTabla(datos) {
  const tbody = document.getElementById("tablaEditableCuerpo");
  if (!tbody) return;

  if (datos.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-600 text-xs font-normal">No hay registros activos en el patio.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  datos.forEach((item, index) => {
    // Extracción tolerante de variables
    let id_reg     = item["ID_REGISTRO"] || item["ID"] || "—";
    let unidad     = item["UNIDAD"] || "S/I";
    let marca      = item["MARCA"] || "Genérica";
    let fosa       = item["FOSA"] || "Taller Central";
    let avance     = parseInt(item["AVANCE"]) || 0;
    let estatus    = item["ESTATUS"] || "Por Atender";
    let observa    = item["OBSERVA"] || item["OBSERVACIONES"] || "Sin novedades registradas.";
    let taller_ext = item["TALLER_EXT"] || item["NOMBRE_TALLER_EXT"] || "";

    // Estilos Cyberpunk / Dark Mode para los Badges de Estatus
    let claseEstatus = "bg-slate-800 text-slate-400 border border-slate-700";
    if (estatus === "Listo") claseEstatus = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold";
    if (estatus === "En Proceso" || estatus === "En Reparación") claseEstatus = "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    if (estatus === "Por Atender") claseEstatus = "bg-red-500/10 text-red-400 border border-red-500/20";

    tbody.innerHTML += `
      <tr class="hover:bg-slate-900/60 transition-all duration-150 border-b border-slate-800/40 text-xs">
        <td class="p-3 font-mono font-bold text-blue-400">#${id_reg}</td>
        <td class="p-3">
          <div class="font-bold text-white tracking-wide uppercase">${unidad}</div>
          <div class="text-[10px] text-slate-500 uppercase font-medium">${marca}</div>
        </td>
        <td class="p-3 text-slate-300 font-medium">
          ${fosa.includes("EXTERNAL") || fosa === "Taller Externo" 
            ? `🏭 <span class="text-[10px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-bold border border-yellow-500/20">${taller_ext}</span>` 
            : `🔧 ${fosa}`}
        </td>
        <td class="p-3">
          <div class="flex items-center gap-2">
            <div class="w-24 bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800 shadow-inner">
              <div class="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style="width: ${avance}%"></div>
            </div>
            <span class="font-mono text-[11px] font-bold text-slate-400">${avance}%</span>
          </div>
        </td>
        <td class="p-3">
          <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-wider inline-block ${claseEstatus}">
            ${estatus}
          </span>
        </td>
        <td class="p-3 text-slate-400 font-normal max-w-xs truncate" title="${observa}">${observa}</td>
        <td class="p-3 text-center">
          <button onclick="abrirModalEditar(${index})" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1 px-2.5 text-[11px] rounded-lg transition border border-slate-700/60 cursor-pointer">
            <i class="fa-solid fa-sliders mr-1 text-slate-400"></i> Control
          </button>
        </td>
      </tr>
    `;
  });
}

// =========================================================================
// 3. CONTROL DE MODALES (ALTAMENTE FIEL A TU HTML)
// =========================================================================
function abrirModalNuevo() {
  document.getElementById("formNuevoRegistro").reset();
  // Colocar fecha de hoy por defecto
  document.getElementById("add-fecha-ingreso").valueToDate = new Date();
  document.getElementById("add-fecha-ingreso").value = new Date().toISOString().substring(0, 10);
  document.getElementById("wrapper-externo").classList.add("hidden");
  document.getElementById("modalNuevoRegistro").classList.remove("hidden");
}

function cerrarModalNuevo() {
  document.getElementById("modalNuevoRegistro").classList.add("hidden");
}

function alternarTallerExterno(valor) {
  const wrapper = document.getElementById("wrapper-externo");
  if (valor.includes("EXTERNAL") || valor === "Taller Externo") {
    wrapper.classList.remove("hidden");
  } else {
    wrapper.classList.add("hidden");
    document.getElementById("add-taller-ext").value = "";
  }
}

function abrirModalEditar(index) {
  document.getElementById("formEditarRegistro").reset();
  const item = cacheDatos[index];

  // Inyectar llaves mapeadas en la edición
  document.getElementById("edit-id-registro").value = item["ID_REGISTRO"] || item["ID"] || "";
  document.getElementById("edit-unidad").value = item["UNIDAD"] || "";
  document.getElementById("edit-marca").value = item["MARCA"] || "";
  document.getElementById("edit-estatus").value = item["ESTATUS"] || "Por Atender";
  document.getElementById("edit-observa").value = item["OBSERVA"] || item["OBSERVACIONES"] || "";

  // Evaluar estatus para mostrar/ocultar el input de Foto Después si está "Listo"
  evaluarEstatusModal(item["ESTATUS"]);

  // Cargar y parsear Checklist Seguro
  try {
    let rawTareas = item["TAREAS"] || "[]";
    tareasActuales = typeof rawTareas === "string" ? JSON.parse(rawTareas) : rawTareas;
  } catch (e) {
    tareasActuales = [];
  }

  renderizarChecklistModal();
  document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
  document.getElementById("modalEditarRegistro").classList.add("hidden");
}

function evaluarEstatusModal(valor) {
  const wrapperFoto = document.getElementById("wrapper-foto-despues");
  if (valor === "Listo") {
    wrapperFoto.classList.remove("hidden");
  } else {
    wrapperFoto.classList.add("hidden");
    document.getElementById("edit-foto-despues").value = "";
  }
}

// =========================================================================
// 4. MOTOR REVOLUCIONARIO DEL CHECKLIST (PLAN VS REAL)
// =========================================================================
function agregarTareaModal() {
  const input = document.getElementById("edit-nueva-tarea");
  const texto = input.value.trim();
  if (!texto) return;

  tareasActuales.push({ descripcion: texto, completada: false });
  input.value = "";
  renderizarChecklistModal();
}

function eliminarTareaModal(idx) {
  tareasActuales.splice(idx, 1);
  renderizarChecklistModal();
}

function alternarEstadoTarea(idx) {
  tareasActuales[idx].completada = !tareasActuales[idx].completada;
  renderizarChecklistModal();
}

function renderizarChecklistModal() {
  const container = document.getElementById("edit-container-tareas");
  const lblAvance = document.getElementById("edit-lbl-avance-calculado");
  if (!container) return;

  if (tareasActuales.length === 0) {
    container.innerHTML = `<p class="text-[11px] text-slate-500 italic py-2 text-center">No hay tareas de diagnóstico asignadas a esta unidad.</p>`;
    lblAvance.innerText = "0%";
    return;
  }

  container.innerHTML = "";
  let completadas = 0;

  tareasActuales.forEach((tarea, idx) => {
    if (tarea.completada) completadas++;

    container.innerHTML += `
      <div class="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded-lg border border-slate-800/60 transition hover:border-slate-700">
        <label class="flex items-center gap-2.5 flex-1 cursor-pointer select-none text-[11px]">
          <input type="checkbox" ${tarea.completada ? "checked" : ""} onchange="alternarEstadoTarea(${idx})" class="rounded bg-slate-900 border-slate-700 text-blue-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer">
          <span class="${tarea.completada ? "line-through text-slate-500 font-medium" : "text-slate-300 font-semibold"}">${tarea.descripcion}</span>
        </label>
        <button type="button" onclick="eliminarTareaModal(${idx})" class="text-slate-500 hover:text-red-400 text-xs transition px-1 cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `;
  });

  // Cálculo matemático exacto de avance porcentual automatizado
  let porcentajeFinal = Math.round((completadas / tareasActuales.length) * 100);
  lblAvance.innerText = `${porcentajeFinal}%`;
}

// Helper para convertir archivos a Base64 de forma asíncrona
function convertirBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) resolve("");
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// =========================================================================
// 5. ENVÍO CRUD DE REGISTROS (CREAR / EDITAR)
// =========================================================================
async function guardarNuevoRegistro(event) {
  event.preventDefault();
  const btn = document.getElementById("btn-crear-submit");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Guardando...`;

  const fotoFile = document.getElementById("add-foto-antes").files[0];
  let fotoBase64 = "";
  if (fotoFile) fotoBase64 = await convertirBase64(fotoFile);

  const payload = {
    accion: "crear",
    unidad: document.getElementById("add-unidad").value,
    marca: document.getElementById("add-marca").value,
    flota: document.getElementById("add-flota").value,
    nombre_taller: document.getElementById("add-taller").value,
    nombre_taller_ext: document.getElementById("add-taller-ext").value,
    fecha_ingreso: document.getElementById("add-fecha-ingreso").value,
    observaciones: document.getElementById("add-observa").value,
    foto_antes_base64: fotoBase64
  };

  try {
    const res = await fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.status === "SUCCESS") {
      alert("Registro ingresado con éxito en el Patio.");
      cerrarModalNuevo();
      cargarTablaEditable();
    } else {
      alert("Error: " + json.message);
    }
  } catch (err) {
    alert("Error crítico de red al guardar.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
  }
}

async function guardarEdicionModal(event) {
  event.preventDefault();
  const btn = document.getElementById("btn-editar-submit");
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Sincronizando...`;

  const fotoDespuesFile = document.getElementById("edit-foto-despues").files[0];
  let fotoDespuesBase64 = "";
  if (fotoDespuesFile) fotoDespuesBase64 = await convertirBase64(fotoDespuesFile);

  // Calcular el avance actual en base al checklist antes de empaquetar el objeto
  let completadas = tareasActuales.filter(t => t.completada).length;
  let porcentajeFinal = tareasActuales.length > 0 ? Math.round((completadas / tareasActuales.length) * 100) : 0;

  const payload = {
    accion: "editar",
    id_registro: document.getElementById("edit-id-registro").value,
    marca: document.getElementById("edit-marca").value,
    estatus: document.getElementById("edit-estatus").value,
    observaciones: document.getElementById("edit-observa").value,
    avance: porcentajeFinal,
    tareas: JSON.stringify(tareasActuales), 
    foto_despues_base64: fotoDespuesBase64,
    fecha_salida: document.getElementById("edit-estatus").value === "Listo" ? new Date().toISOString().substring(0, 10) : ""
  };

  try {
    const res = await fetch(WEB_APP_URL, { method: "POST", body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.status === "SUCCESS") {
      alert("Fila actualizada y sincronizada en el Sheet.");
      cerrarModalEditar();
      cargarTablaEditable();
    } else {
      alert("Error: " + json.message);
    }
  } catch (err) {
    alert("Error de transmisión de red.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
  }
}
