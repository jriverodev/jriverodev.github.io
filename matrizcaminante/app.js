import { db } from './db.js';
import { sincronizarDatos, subirAlSheetsCentral } from './sync.js';

const CLAVE_ACCESO_ADMIN = "Emaus2026";

// --- INICIALIZACIÓN DE EVENTOS AL CARGAR LA APP ---
document.addEventListener('DOMContentLoaded', async () => {
  await actualizarConteoLocal();

  // --- CONTROL DE ACCESO SEGURO ---
  const btnTriggerAuth = document.getElementById('btn-trigger-auth');
  const btnLockAdmin = document.getElementById('btn-lock-admin');
  const panelCoordinacion = document.getElementById('panel-coordinacion');
  const blockAuthAdmin = document.getElementById('block-auth-admin');

  btnTriggerAuth.addEventListener('click', () => {
    Swal.fire({
      title: 'Acceso Restringido',
      text: 'Ingrese la clave de coordinación para habilitar las herramientas de administración:',
      input: 'password',
      inputAttributes: { autocapitalize: 'off', autocorrect: 'off' },
      showCancelButton: true,
      confirmButtonText: 'Desbloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5',
      inputValidator: (value) => {
        if (!value) return '¡Debes ingresar una contraseña!';
      }
    }).then((result) => {
      if (result.isConfirmed) {
        if (result.value === CLAVE_ACCESO_ADMIN) {
          panelCoordinacion.classList.remove('hidden');
          blockAuthAdmin.classList.add('hidden');
          Swal.fire({
            icon: 'success',
            title: 'Acceso Concedido',
            text: 'Panel de Administración habilitado.',
            timer: 1300,
            showConfirmButton: false
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'Contraseña incorrecta.',
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  });

  btnLockAdmin.addEventListener('click', () => {
    panelCoordinacion.classList.add('hidden');
    blockAuthAdmin.classList.remove('hidden');
  });

  // --- SINC DESCARGA CENTRAL ---
  document.getElementById('btn-sync').addEventListener('click', async () => {
    Swal.fire({
      title: 'Sincronizando...',
      text: 'Descargando datos del censo desde la nube.',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    const resultado = await sincronizarDatos();

    if (resultado.exito) {
      await actualizarConteoLocal();
      Swal.fire({
        icon: 'success',
        title: '¡Sincronización Exitosa!',
        text: `Se han almacenado ${resultado.conteo} caminantes en tu dispositivo para uso offline.`,
        confirmButtonColor: '#4f46e5'
      });
      if (!document.getElementById('view-cocina').classList.contains('hidden')) renderCocina();
      if (!document.getElementById('view-salud').classList.contains('hidden')) renderSalud();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        text: 'No se pudo descargar la data. Se usará la última base de datos guardada.',
        confirmButtonColor: '#ef4444'
      });
    }
  });

  // --- CARGA Y PROCESAMIENTO DEL ARCHIVO CSV REAL ---
  const btnAdminUploadTrigger = document.getElementById('btn-admin-upload-trigger');
  const csvFileInput = document.getElementById('csv-file-input');

  btnAdminUploadTrigger.addEventListener('click', () => {
    csvFileInput.click();
  });

  csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Swal.fire({
      title: '¿Procesar y subir matriz?',
      text: `Vas a cargar "${file.name}". Esto actualizará localmente la PWA y sobreescribirá la hoja central en la nube.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, subir ahora',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706'
    }).then((result) => {
      if (result.isConfirmed) {
        ejecutarProcesamientoCSV(file);
      } else {
        csvFileInput.value = '';
      }
    });
  });

  // Filtros en tiempo real
  document.getElementById('chk-solo-alertas').addEventListener('change', () => { renderCocina(); });
  document.getElementById('search-salud').addEventListener('input', () => { renderSalud(); });
});

async function actualizarConteoLocal() {
  const count = await db.caminantes.count();
  document.getElementById('local-count').innerText = count;
}

// Lógica para procesar la carga de la matriz rellenada
async function ejecutarProcesamientoCSV(file) {
  Swal.fire({
    title: 'Procesando Matriz...',
    text: 'Parseando registros e indexando restricciones de salud...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  const reader = new FileReader();
  
  reader.onload = async (event) => {
    try {
      const contenido = event.target.result;
      const lineas = contenido.split(/\r?\n/).filter(linea => linea.trim() !== '');
      
      if(lineas.length <= 1) {
        throw new Error("Estructura vacía.");
      }

      const caminantesProcesados = [];
      
      for(let i = 1; i < lineas.length; i++) {
        const columnas = lineas[i].split(';');
        if (!columnas[0] || !columnas[1]) continue;

        const id_planilla = columnas[0].replace(/[\uFEFF]/g, '').trim(); 
        const nombre_completo = columnas[1].trim();
        const cedula = columnas[2] ? columnas[2].trim() : '';
        const celular = columnas[3] ? columnas[3].trim() : '';
        const talla_camisa = columnas[4] ? columnas[4].trim() : 'M';
        const condicion_salud = columnas[5] ? columnas[5].trim() : 'Ninguna';
        const alergico_med = columnas[6] ? columnas[6].trim().toUpperCase() : 'NO';
        const detalle_alergia_med = columnas[7] ? columnas[7].trim() : '';
        const alergico_comida = columnas[8] ? columnas[8].trim().toUpperCase() : 'NO';
        const detalle_alergia_comida = columnas[9] ? columnas[9].trim() : '';
        const tiene_tratamiento = columnas[10] ? columnas[10].trim().toUpperCase() : 'NO';
        
        const med1 = columnas[11] ? columnas[11].trim() : '';
        const hor1 = columnas[12] ? columnas[12].trim() : '';
        const med2 = columnas[13] ? columnas[13].trim() : '';
        const hor2 = columnas[14] ? columnas[14].trim() : '';
        
        const con1_nombre = columnas[15] ? columnas[15].trim() : '';
        const con1_parentesco = columnas[16] ? columnas[16].trim() : '';
        const con1_tlf = columnas[17] ? columnas[17].trim() : '';
        
        const observaciones_generales = columnas[21] ? columnas[21].trim() : '';

        // --- SISTEMA INTEGREGADO DE REGLAS DE ATENCIÓN ESPECIAL ---
        let tipo_dieta = "Estándar";
        let requiere_atencion_cocina = false;
        const alertas_cocina = [];

        const condicionMin = condicion_salud.toLowerCase();
        const obsMin = observaciones_generales.toLowerCase();

        if (condicionMin.includes("hipert") || condicionMin.includes("tension") || obsMin.includes("hiposod") || obsMin.includes("sin sal")) {
          tipo_dieta = "Hiposódica ⚠️";
          requiere_atencion_cocina = true;
          alertas_cocina.push("Dieta Hiposódica Obligatoria");
        }

        if (alergico_comida === "SI" || alergico_comida === "SÍ") {
          requiere_atencion_cocina = true;
          alertas_cocina.push(`Alergia alimentaria: ${detalle_alergia_comida}`);
        }

        const tratamientos = [];
        if (med1 && hor1) tratamientos.push({ medicamento: med1, horario: hor1 });
        if (med2 && hor2) tratamientos.push({ medicamento: med2, horario: hor2 });

        caminantesProcesados.push({
          id_planilla,
          nombre_completo,
          cedula,
          edad: "N/A",
          talla_camisa,
          cocina: {
            tipo_dieta,
            requiere_atencion: requiere_atencion_cocina,
            alertas: alertas_cocina,
            observaciones_origen: observaciones_generales
          },
          salud: {
            bajo_tratamiento: (tiene_tratamiento === "SI" || tiene_tratamiento === "SÍ"),
            condicion_especial: condicion_salud !== "Ninguna" ? condicion_salud : "",
            alergico_medicina: (alergico_med === "SI" || alergico_med === "SÍ"),
            detalle_alergia_med,
            tratamientos,
            contactos_emergencia: [
              { nombre: con1_nombre, parentesco: con1_parentesco, telefono: con1_tlf }
            ]
          }
        });
      }

      // Guardar localmente de inmediato
      await db.caminantes.clear();
      await db.caminantes.bulkAdd(caminantesProcesados);
      await actualizarConteoLocal();

      // Transmitir al Google Sheets Central
      const enviadoANube = await subirAlSheetsCentral(caminantesProcesados);

      if (enviadoANube) {
        Swal.fire({
          icon: 'success',
          title: '¡Procesamiento Exitoso!',
          text: `Se registraron ${caminantesProcesados.length} caminantes en local y en Google Sheets.`,
          confirmButtonColor: '#d97706'
        });
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Guardado Localmente ⚠️',
          text: `Se cargaron ${caminantesProcesados.length} caminantes en el teléfono, pero la sincronización remota falló (revisa internet o tus credenciales).`,
          confirmButtonColor: '#f59e0b'
        });
      }

      // Renderizar cambios si las pestañas están activas
      renderCocina();
      renderSalud();

    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'Error de Estructura',
        text: 'Asegúrate de no cambiar los encabezados y guardar como CSV (delimitado por punto y coma).',
        confirmButtonColor: '#ef4444'
      });
    }
    document.getElementById('csv-file-input').value = '';
  };

  reader.readAsText(file, "UTF-8");
}

// --- RENDERIZADO VISUAL DE COCINA ---
export async function renderCocina() {
  const lista = document.getElementById('lista-cocina');
  const soloAlertas = document.getElementById('chk-solo-alertas').checked;
  lista.innerHTML = '<p class="text-gray-400 text-center text-sm py-4">Cargando menú...</p>';

  const caminantes = await db.caminantes.toArray();

  let estandar = 0, hiposodica = 0;
  caminantes.forEach(c => {
    if (c.cocina && c.cocina.tipo_dieta && c.cocina.tipo_dieta.includes("Hiposódica")) hiposodica++;
    else estandar++;
  });
  document.getElementById('stat-estandar').innerText = estandar;
  document.getElementById('stat-hiposodica').innerText = hiposodica;

  lista.innerHTML = '';
  const filtrados = soloAlertas ? caminantes.filter(c => c.cocina && c.cocina.requiere_atencion) : caminantes;

  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">Sin registros coincidentes.</p>';
    return;
  }

  filtrados.forEach(c => {
    const card = document.createElement('div');
    const requiereAtencion = c.cocina && c.cocina.requiere_atencion;
    card.className = `p-4 rounded-xl shadow-sm border bg-white ${requiereAtencion ? 'border-l-4 border-l-orange-500 border-gray-200' : 'border-gray-200'}`;
    
    let alertasHtml = '';
    if (requiereAtencion && c.cocina.alertas && c.cocina.alertas.length > 0) {
      alertasHtml = `<div class="mt-2 bg-red-50 p-2 rounded-lg border border-red-200 space-y-1">`;
      c.cocina.alertas.forEach(alerta => {
        alertasHtml += `<p class="text-xs text-red-700 flex items-center gap-1 font-medium"><span class="material-icons text-xs">gavel</span> ${alerta}</p>`;
      });
      alertasHtml += `</div>`;
    }

    const observaciones = c.cocina?.observaciones_origen || '';
    const tipoDieta = c.cocina?.tipo_dieta || 'Estándar';

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-900">${c.nombre_completo}</h3>
          <p class="text-xs text-gray-400">Planilla N° ${c.id_planilla} • Talla: <span class="font-bold text-gray-700">${c.talla_camisa}</span></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${requiereAtencion ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">${tipoDieta}</span>
      </div>
      ${alertasHtml}
      ${observaciones ? `<p class="text-xs italic text-gray-500 mt-2 bg-gray-50 p-1.5 rounded">Nota: ${observaciones}</p>` : ''}
    `;
    lista.appendChild(card);
  });
}

// --- RENDERIZADO VISUAL DE SALUD ---
export async function renderSalud() {
  const lista = document.getElementById('lista-salud');
  const query = document.getElementById('search-salud').value.toLowerCase().trim();
  lista.innerHTML = '';

  let caminantes = await db.caminantes.toArray();

  if (query !== '') {
    caminantes = caminantes.filter(c => 
      c.nombre_completo.toLowerCase().includes(query) || c.id_planilla.includes(query)
    );
  }

  if (caminantes.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">No se encontraron caminantes.</p>';
    return;
  }

  caminantes.forEach(c => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-xl shadow-sm border border-gray-200 bg-white space-y-3";

    let tratamientosHtml = '';
    if (c.salud?.bajo_tratamiento && c.salud.tratamientos?.length > 0) {
      tratamientosHtml = `<div class="bg-teal-50 p-2.5 rounded-xl border border-teal-100 space-y-2">
        <p class="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1"><span class="material-icons text-sm">schedule</span> Horarios:</p>`;
      c.salud.tratamientos.forEach(t => {
        tratamientosHtml += `
          <div class="flex justify-between items-center text-xs border-b border-teal-100/50 pb-1 last:border-0 last:pb-0">
            <span class="text-gray-700 font-medium">💊 ${t.medicamento}</span>
            <span class="bg-teal-600 text-white font-bold px-2 py-0.5 rounded-md">⏰ ${t.horario}</span>
          </div>`;
      });
      tratamientosHtml += `</div>`;
    } else {
      tratamientosHtml = `<p class="text-xs text-gray-400 flex items-center gap-1"><span class="material-icons text-sm text-gray-300">check_circle</span> Sin tratamientos permanentes.</p>`;
    }

    let alergiaMedHtml = c.salud?.alergico_medicina ? `<div class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1"><span class="material-icons text-sm">warning</span> ALÉRGICO A: ${c.salud.detalle_alergia_med}</div>` : '';

    let contactosHtml = '<div class="grid grid-cols-2 gap-2 mt-2">';
    if (c.salud?.contactos_emergencia) {
      c.salud.contactos_emergencia.forEach(con => {
        if (con.nombre && con.telefono) {
          contactosHtml += `
            <a href="tel:${con.telefono}" class="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg flex flex-col items-center justify-center text-center transition">
              <span class="text-[10px] font-bold text-gray-500 uppercase">${con.parentesco || 'Familiar'}</span>
              <span class="text-xs font-semibold truncate w-full">${con.nombre}</span>
              <span class="text-[10px] text-indigo-600 font-medium mt-0.5">📞 Llamar</span>
            </a>`;
        }
      });
    }
    contactosHtml += '</div>';

    const condicionEspecial = c.salud?.condicion_especial || '';

    card.innerHTML = `
      <div>
        <h3 class="font-bold text-gray-900 text-base">${c.nombre_completo}</h3>
        <p class="text-xs text-gray-400">Planilla: ${c.id_planilla} • C.I: ${c.cedula} • Edad: ${c.edad}</p>
      </div>
      ${alergiaMedHtml}
      ${tratamientosHtml}
      ${condicionEspecial ? `<p class="text-xs text-gray-600 bg-amber-50 border border-amber-200 p-2 rounded-lg"><strong>Condición:</strong> ${condicionEspecial}</p>` : ''}
      <div class="border-t border-gray-100 pt-2">
        <p class="text-[10px] font-bold text-gray-400 uppercase mb-1">Contactos de Emergencia</p>
        ${contactosHtml}
      </div>
    `;
    lista.appendChild(card);
  });
}

// Registro global en objeto global window
window.renderCocina = renderCocina;
window.renderSalud = renderSalud;
