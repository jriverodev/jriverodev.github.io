import { db } from './db.js';
import { sincronizarDatos, subirAlSheetsCentral } from './sync.js';

// Inicialización de Eventos al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
  actualizarConteoLocal();

  // Enlace del botón de Sincronización Estándar
  const btnSync = document.getElementById("btn-sync");
  if (btnSync) {
    btnSync.addEventListener("click", ejecutarSincronizacionRemota);
  }

  // Eventos de Autenticación y Desbloqueo del Panel de Coordinación
  const btnTriggerAuth = document.getElementById("btn-trigger-auth");
  if (btnTriggerAuth) {
    btnTriggerAuth.addEventListener("click", autenticarAccesoCoordinacion);
  }

  const btnLockAdmin = document.getElementById("btn-lock-admin");
  if (btnLockAdmin) {
    btnLockAdmin.addEventListener("click", () => {
      document.getElementById("panel-coordinacion").classList.add("hidden");
    });
  }

  // Descarga de Plantilla CSV
  const btnPlantilla = document.getElementById("btn-descargar-plantilla");
  if (btnPlantilla) {
    btnPlantilla.addEventListener("click", descargarPlantillaEjemplo);
  }

  // Accionador de carga de Archivos CSV
  const btnUploadTrigger = document.getElementById("btn-admin-upload-trigger");
  const csvFileInput = document.getElementById("csv-file-input");
  if (btnUploadTrigger && csvFileInput) {
    btnUploadTrigger.addEventListener("click", () => csvFileInput.click());
    csvFileInput.addEventListener("change", manejarCargaArchivoCSV);
  }

  // Listeners interactivos en vistas de Cocina y Salud
  const chkSoloAlertas = document.getElementById("chk-solo-alertas");
  if (chkSoloAlertas) {
    chkSoloAlertas.addEventListener("change", window.renderCocina);
  }

  const searchSalud = document.getElementById("search-salud");
  if (searchSalud) {
    searchSalud.addEventListener("input", window.renderSalud);
  }
});

/**
 * Muestra el total de registros salvados en la IndexedDB local
 */
async function actualizarConteoLocal() {
  try {
    const total = await db.caminantes.count();
    const localCountEl = document.getElementById("local-count");
    if (localCountEl) localCountEl.innerText = total;
    return total;
  } catch (err) {
    console.error("Error leyendo Dexie local:", err);
    return 0;
  }
}

/**
 * Acción de descarga desde Google Sheets hacia la DB local
 */
async function ejecutarSincronizacionRemota() {
  Swal.fire({
    title: 'Sincronizando...',
    text: 'Conectando con la base de datos central en la nube.',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  const resultado = await sincronizarDatos();

  if (resultado.exito) {
    const total = await actualizarConteoLocal();
    document.getElementById("sync-status").innerText = `Última sincronización: ${new Date().toLocaleTimeString()}`;
    Swal.fire({
      icon: 'success',
      title: '¡Sincronizado!',
      text: `Se descargaron e indexaron ${resultado.conteo} caminantes correctamente.`,
      timer: 2000,
      showConfirmButton: false
    });
    // Forzar refresco si las vistas están activas
    if (!document.getElementById("view-cocina").classList.contains("hidden")) window.renderCocina();
    if (!document.getElementById("view-salud").classList.contains("hidden")) window.renderSalud();
  } else {
    Swal.fire({
      icon: 'error',
      title: 'Error de Red',
      text: 'No se pudo leer la matriz central. Verifica tu conexión o el estado de la hoja.'
    });
  }
}

/**
 * Sistema de protección por Pin para el panel organizador
 */
function autenticarAccesoCoordinacion() {
  Swal.fire({
    title: 'Acceso Restringido',
    text: 'Introduce el PIN de Coordinador:',
    input: 'password',
    inputPlaceholder: 'Pin secreto',
    showCancelButton: true,
    confirmButtonColor: '#4f46e5',
    confirmButtonText: 'Desbloquear',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      if (result.value === "3312" || result.value === "emaus") {
        document.getElementById("panel-coordinacion").classList.remove("hidden");
        Swal.fire({
          icon: 'success',
          title: 'Acceso Concedido',
          text: 'Panel de administración habilitado.',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'PIN Incorrecto',
          text: 'No tienes autorización para alterar la matriz original.'
        });
      }
    }
  });
}

/**
 * Genera y descarga un CSV de ejemplo calibrado con las 24 columnas exactas
 */
function descargarPlantillaEjemplo() {
  const encabezados = [
    "ID_PLANILLA", "NOMBRE_COMPLETO", "CEDULA", "CELULAR", "TALLA_CAMISA", 
    "CONDICION_SALUD", "ALERGICO_MED", "DETALLE_ALERGIA_MED", "ALERGICO_COMIDA", 
    "DETALLE_ALERGIA_COMIDA", "TIENE_TRATAMIENTO", 
    "MEDICAMENTO_1", "HORARIO_1", 
    "MEDICAMENTO_2", "HORARIO_2", 
    "MEDICAMENTO_3", "HORARIO_3", 
    "CONTACTO_1_NOMBRE", "PARENTESCO_1", "TELEFONO_1", 
    "CONTACTO_2_NOMBRE", "PARENTESCO_2", "TELEFONO_2", 
    "OBSERVACIONES_GENERALES"
  ];
  
  const filaEjemplo = [
    "1", "Carlos José Mendoza Pérez", "V-14.234.567", "0424-7654321", "L", 
    "Hipertensión arterial", "SI", "Penicilina", "SI", 
    "Requiere dieta hiposódica estricta (sin sal).", "SI", 
    "Losartán Potassium 50mg", "08:00 AM", 
    "Amlodipina 5mg", "08:00 PM",
    "Aspirina 100mg", "12:00 PM",
    "María Mendoza", "Esposa", "0414-1112233", 
    "Pedro Mendoza", "Padre", "0426-9998877", 
    "Alergia severa a los mariscos"
  ];

  const contenidoCsv = "\uFEFF" + encabezados.join(";") + "\n" + filaEjemplo.join(";");
  const blob = new Blob([contenidoCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const enlace = document.createElement("a");
  enlace.setAttribute("href", url);
  enlace.setAttribute("download", "plantilla_matriz_emaus.csv");
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
}

/**
 * Lee el archivo cargado y activa el parser secuencial
 */
function manejarCargaArchivoCSV(e) {
  const archivo = e.target.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = async function(evt) {
    const texto = evt.target.result;
    await ejecutarProcesamientoCSV(texto);
  };
  lector.readAsText(archivo, "UTF-8");
  e.target.value = ""; // Limpiar input
}

/**
 * Parser Inteligente de 24 columnas con Matriz de Dieta Expandida para Cocina y Salud
 */
async function ejecutarProcesamientoCSV(texto) {
  Swal.fire({
    title: 'Procesando Archivo...',
    text: 'Validando columnas, alergias y regímenes médicos.',
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const lineas = texto.split(/\r?\n/);
    const caminantesProcesados = [];

    // Empezamos en i = 1 para omitir la fila de cabeceras
    for(let i = 1; i < lineas.length; i++) {
      const lineaLimpia = lineas[i].trim();
      if (!lineaLimpia) continue;

      const columnas = lineaLimpia.split(';');
      if (!columnas[1]) continue; // Omitir filas sin nombre

      // Mapeo exhaustivo indexado por posición (Base 0)
      const id_planilla = columnas[0] ? columnas[0].replace(/[\uFEFF]/g, '').trim() : ''; 
      const nombre_completo = columnas[1].trim();
      const cedula = columnas[2] ? columnas[2].trim() : '';
      const celular_caminante = columnas[3] ? columnas[3].trim() : '';
      const talla_camisa = columnas[4] ? columnas[4].trim() : 'M';
      const condicion_salud = columnas[5] ? columnas[5].trim() : 'Ninguna';
      const alergico_med = columnas[6] ? columnas[6].trim().toUpperCase() : 'NO';
      const detalle_alergia_med = columnas[7] ? columnas[7].trim() : 'Ninguna';
      const alergico_comida = columnas[8] ? columnas[8].trim().toUpperCase() : 'NO';
      const detalle_alergia_comida = columnas[9] ? columnas[9].trim() : '';
      const tiene_tratamiento = columnas[10] ? columnas[10].trim().toUpperCase() : 'NO';
      
      // Captura de los 3 Bloques de Fármacos
      const med1 = columnas[11] ? columnas[11].trim() : '';
      const hor1 = columnas[12] ? columnas[12].trim() : '';
      const med2 = columnas[13] ? columnas[13].trim() : '';
      const hor2 = columnas[14] ? columnas[14].trim() : '';
      const med3 = columnas[15] ? columnas[15].trim() : '';
      const hor3 = columnas[16] ? columnas[16].trim() : '';
      
      // Desplazamiento correcto para contactos de emergencia (+2 posiciones)
      const con1_nombre = columnas[17] ? columnas[17].trim() : '';
      const con1_parentesco = columnas[18] ? columnas[18].trim() : '';
      const con1_tlf = columnas[19] ? columnas[19].trim() : '';

      const con2_nombre = columnas[20] ? columnas[20].trim() : '';
      const con2_parentesco = columnas[21] ? columnas[21].trim() : '';
      const con2_tlf = columnas[22] ? columnas[22].trim() : '';
      
      const observaciones_generales = columnas[23] ? columnas[23].trim() : '';

      // --- ALGORITMO PREVENTIVO DE ALERTAS DE COCINA ---
      let tipo_dieta = "Estándar";
      let requiere_atencion_cocina = false;
      const alertas_cocina = [];

      const condicionMin = condicion_salud.toLowerCase();
      const obsMin = observaciones_generales.toLowerCase();
      const comidaMin = detalle_alergia_comida.toLowerCase();

      // Validación de Restricciones Críticas (Hipertensión, Sal, Canela)
      if (condicionMin.includes("hipert") || condicionMin.includes("tensión") || obsMin.includes("hiposod") || obsMin.includes("sin sal") || comidaMin.includes("sal")) {
        tipo_dieta = "Hiposódica (Bajo en Sal) ⚠️";
        requiere_atencion_cocina = true;
        alertas_cocina.push("CONTROL DE PRESIÓN: No añadir sal común, cubitos ni condimentos procesados.");
        
        if (obsMin.includes("canela") || condicionMin.includes("canela") || comidaMin.includes("canela")) {
          alertas_cocina.push("RESTRICCIÓN CRÍTICA: ¡NO SUMINISTRAR CANELA!");
        }
      }

      // Validación de Casos Diabéticos
      if (condicionMin.includes("diabet") || condicionMin.includes("azúcar") || obsMin.includes("glicemia") || obsMin.includes("sin azúcar")) {
        tipo_dieta = "Hipoglicémica (Sin Azúcar) ⚠️";
        requiere_atencion_cocina = true;
        alertas_cocina.push("DIABETES: Cero azúcar refinada, controlar carbohidratos simples.");
      }

      // Alergias generales de alimentación
      if (alergico_comida === "SI" || alergico_comida === "SÍ" || detalle_alergia_comida !== "") {
        requiere_atencion_cocina = true;
        alertas_cocina.push(`ALERGIA DETECTADA: ${detalle_alergia_comida || "Ver observaciones"}`);
        if (tipo_dieta === "Estándar") tipo_dieta = "Alergia Específica";
      }

      // Mapeo dinámico del arreglo médico
      const tratamientos = [];
      if (med1 && hor1) tratamientos.push({ medicamento: med1, schedule: hor1 });
      if (med2 && hor2) tratamientos.push({ medicamento: med2, schedule: hor2 });
      if (med3 && hor3) tratamientos.push({ medicamento: med3, schedule: hor3 });

      const contactos_emergencia = [];
      if (con1_nombre) contactos_emergencia.push({ nombre: con1_nombre, parentesco: con1_parentesco, telefono: con1_tlf });
      if (con2_nombre) contactos_emergencia.push({ nombre: con2_nombre, parentesco: con2_parentesco, telefono: con2_tlf });

      caminantesProcesados.push({
        id_planilla,
        nombre_completo,
        cedula,
        celular_caminante,
        talla_camisa,
        observaciones_generales,
        cocina: {
          tipo_dieta,
          requiere_atencion: requiere_atencion_cocina,
          alertas: alertas_cocina,
          alertas_comida_si: (alergico_comida === "SI" || alergico_comida === "SÍ"),
          observaciones_origen: detalle_alergia_comida || observaciones_generales
        },
        salud: {
          necesidades_especiales: requiere_atencion_cocina || (condicion_salud !== "Ninguna" && condicion_salud !== "NO"),
          condicion_especial: condicion_salud,
          alergico_medicina: (alergico_med === "SI" || alergico_med === "SÍ"),
          detalle_alergia_med,
          bajo_tratamiento: (tiene_tratamiento === "SI" || tiene_tratamiento === "SÍ"),
          tratamientos,
          contactos_emergencia
        }
      });
    }

    // Guardado primario en IndexedDB local (Garantiza funcionamiento 100% offline)
    await db.caminantes.clear();
    await db.caminantes.bulkAdd(caminantesProcesados);
    await actualizarConteoLocal();

    // Transmisión inmediata en background al Google Sheet central
    const subidaNube = await subirAlSheetsCentral(caminantesProcesados);

    if (subidaNube) {
      Swal.fire({
        icon: 'success',
        title: '¡Matriz Publicada!',
        text: `Se procesaron e inyectaron ${caminantesProcesados.length} registros en la nube con éxito.`,
        confirmButtonColor: '#4f46e5'
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Guardado Localmente ⚠️',
        text: 'La base de datos local se actualizó, pero el teléfono no tiene conexión estable para impactar el Sheets central. Se sincronizará al volver a la red.',
        confirmButtonColor: '#d97706'
      });
    }

  } catch (error) {
    console.error("Error parseando matriz:", error);
    Swal.fire({
      icon: 'error',
      title: 'Formato Inválido',
      text: 'Asegúrate de que las columnas utilicen separador por punto y coma (;) y coincidan con la plantilla.'
    });
  }
}

/**
 * RENDERIZADO CAPA DE COCINA
 */
window.renderCocina = async function() {
  const listaCocina = document.getElementById("lista-cocina");
  if (!listaCocina) return;

  const caminantes = await db.caminantes.toArray();
  const soloAlertas = document.getElementById("chk-solo-alertas").checked;

  let html = "";
  let contEstandar = 0;
  let contHiposodica = 0;

  caminantes.forEach(c => {
    if (c.cocina.tipo_dieta.includes("Hiposódica")) contHiposodica++;
    else contEstandar++;

    if (soloAlertas && !c.cocina.requiere_atencion) return;

    const badgeColor = c.cocina.requiere_atencion ? 'bg-red-100 text-red-800 border-red-200' : 'bg-green-100 text-green-800 border-green-200';
    
    let alertasHtml = "";
    if (c.cocina.alertas && c.cocina.alertas.length > 0) {
      c.cocina.alertas.forEach(a => {
        alertasHtml += `<p class="text-xs text-red-700 font-medium flex items-center gap-1 mt-1">🔴 ${a}</p>`;
      });
    }

    html += `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-2">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-bold text-gray-900 text-sm">${c.nombre_completo}</h4>
            <p class="text-xs text-gray-500">Planilla: N°${c.id_planilla} | C.I: ${c.cedula}</p>
          </div>
          <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor}">
            ${c.cocina.tipo_dieta}
          </span>
        </div>
        ${alertasHtml}
      </div>`;
  });

  document.getElementById("stat-estandar").innerText = contEstandar;
  document.getElementById("stat-hiposodica").innerText = contHiposodica;
  listaCocina.innerHTML = html || `<p class="text-center text-xs text-gray-400 py-6">No hay registros especiales que requieran atención en este momento.</p>`;
};

/**
 * RENDERIZADO CAPA DE SALUD
 */
window.renderSalud = async function() {
  const listaSalud = document.getElementById("lista-salud");
  if (!listaSalud) return;

  const terminoBusqueda = document.getElementById("search-salud").value.toLowerCase();
  const caminantes = await db.caminantes.toArray();

  let html = "";

  const filtrados = caminantes.filter(c => 
    c.nombre_completo.toLowerCase().includes(terminoBusqueda) || 
    c.id_planilla.toString().includes(terminoBusqueda) ||
    c.cedula.includes(terminoBusqueda)
  );

  filtrados.forEach(c => {
    let tratamientosHtml = "";
    
    if (c.salud.tratamientos && c.salud.tratamientos.length > 0) {
      c.salud.tratamientos.forEach(t => {
        tratamientosHtml += `
          <div class="flex justify-between items-center text-xs border-b border-teal-100/50 pb-1 last:border-0 last:pb-0">
            <span class="text-gray-700 font-medium">💊 ${t.medicamento}</span>
            <span class="bg-teal-600 text-white font-bold px-2 py-0.5 rounded-md">⏰ ${t.schedule}</span>
          </div>`;
      });
    } else {
      tratamientosHtml = `<p class="text-xs text-gray-400 italic">Sin tratamientos crónicos programados.</p>`;
    }

    const tlfEmergencia = (c.salud.contactos_emergencia && c.salud.contactos_emergencia[0]) ? 
      `${c.salud.contactos_emergencia[0].nombre} (${c.salud.contactos_emergencia[0].parentesco}): ${c.salud.contactos_emergencia[0].telefono}` : 'No especificado';

    html += `
      <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="font-bold text-gray-900 text-sm">N°${c.id_planilla} - ${c.nombre_completo}</h4>
            <p class="text-xs text-gray-500">Condición: <span class="text-indigo-600 font-medium">${c.salud.condicion_especial || 'Ninguna'}</span></p>
            <p class="text-xs text-gray-500">Alergia Médica: <span class="font-semibold text-amber-700">${c.salud.alergico_medicina ? c.salud.detalle_alergia_med : 'Ninguna'}</span></p>
          </div>
          <span class="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded">
            Talla: ${c.talla_camisa}
          </span>
        </div>
        
        <div class="bg-teal-50/70 p-3 rounded-xl border border-teal-100 space-y-1.5">
          <p class="text-[11px] uppercase font-bold text-teal-800 tracking-wider">Dosificación y Horarios:</p>
          ${tratamientosHtml}
        </div>

        <div class="text-[11px] text-gray-500 pt-1 flex flex-col gap-0.5 border-t border-gray-100">
          <p>📞 <strong>Emergencia:</strong> ${tlfEmergencia}</p>
          ${c.observaciones_generales ? `<p>📝 <strong>Obs:</strong> ${c.observaciones_generales}</p>` : ''}
        </div>
      </div>`;
  });

  listaSalud.innerHTML = html || `<p class="text-center text-xs text-gray-400 py-6">No se encontraron caminantes que coincidan con la búsqueda.</p>`;
};
