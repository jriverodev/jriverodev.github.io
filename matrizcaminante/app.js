import { db } from './db.js';
import { sincronizarDatos } from './sync.js';

// Contraseña de seguridad para el Panel de Coordinación
const CLAVE_ACCESO_ADMIN = "Emaus2026";

// --- INICIALIZACIÓN DE EVENTOS AL CARGAR LA APP ---
document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar la cantidad de registros guardados en el almacenamiento del teléfono
  await actualizarConteoLocal();

  // 1. Botón de Sincronización Estándar (Para todos los servidores en las mesas)
  document.getElementById('btn-sync').addEventListener('click', async () => {
    Swal.fire({
      title: 'Sincronizando...',
      text: 'Descargando datos del taller desde la nube.',
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
      // Refrescar las vistas por si hay datos nuevos
      if (!document.getElementById('view-cocina').classList.contains('hidden')) renderCocina();
      if (!document.getElementById('view-salud').classList.contains('hidden')) renderSalud();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error de Conexión',
        text: 'No se pudo descargar la data. La PWA seguirá usando la última base de datos guardada en este teléfono.',
        confirmButtonColor: '#ef4444'
      });
    }
  });

  // 2. Botón de Procesamiento Administrativo (Solicita Clave de Coordinación)
  document.getElementById('btn-admin-upload').addEventListener('click', () => {
    Swal.fire({
      title: 'Acceso Restringido',
      text: 'Ingrese la clave de coordinación para procesar y validar la lista matriz:',
      input: 'password',
      inputAttributes: {
        autocapitalize: 'off',
        autocorrect: 'off'
      },
      showCancelButton: true,
      confirmButtonText: 'Validar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d97706',
      inputValidator: (value) => {
        if (!value) {
          return '¡Debes ingresar una contraseña!';
        }
      }
    }).then(async (result) => {
      if (result.isConfirmed) {
        // Validación estricta de la contraseña
        if (result.value === CLAVE_ACCESO_ADMIN) {
          
          Swal.fire({
            title: 'Procesando Matriz...',
            text: 'Verificando restricciones dietéticas, alertas de hipertensión y horarios médicos.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
          });

          // Forzamos la actualización de la base de datos local
          const resultado = await sincronizarDatos();

          if (resultado.exito) {
            await actualizarConteoLocal();
            Swal.fire({
              icon: 'success',
              title: '¡Matriz Validada!',
              text: `La lista fue cargada con éxito. ${resultado.conteo} caminantes procesados y clasificados.`,
              confirmButtonColor: '#d97706'
            });
            renderCocina();
            renderSalud();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Error al procesar',
              text: 'Asegúrate de que la hoja de Google Sheets tenga datos válidos y no esté bloqueada.',
              confirmButtonColor: '#ef4444'
            });
          }

        } else {
          // Contraseña errónea
          Swal.fire({
            icon: 'error',
            title: 'Acceso Denegado',
            text: 'La contraseña ingresada es incorrecta. Acción cancelada por seguridad.',
            confirmButtonColor: '#ef4444'
          });
        }
      }
    });
  });

  // 3. Escuchar filtros dinámicos del módulo de Cocina
  document.getElementById('chk-solo-alertas').addEventListener('change', () => {
    renderCocina();
  });

  // 4. Escuchar barra de búsqueda en tiempo real de Salud
  document.getElementById('search-salud').addEventListener('input', () => {
    renderSalud();
  });
});

// Función auxiliar para refrescar el contador en pantalla
async function actualizarConteoLocal() {
  const count = await db.caminantes.count();
  document.getElementById('local-count').innerText = count;
}


// =======================================================
// 🍽️ LÓGICA DE CONTROL: SERVICIO DE COCINA
// =======================================================
export async function renderCocina() {
  const lista = document.getElementById('lista-cocina');
  const soloAlertas = document.getElementById('chk-solo-alertas').checked;
  lista.innerHTML = '<p class="text-gray-400 text-center text-sm py-4">Cargando menú...</p>';

  // 1. Obtener todos los registros desde IndexedDB
  const caminantes = await db.caminantes.toArray();

  // 2. Calcular estadísticas en tiempo real para el Jefe de Cocina
  let estandar = 0;
  let hiposodica = 0;
  caminantes.forEach(c => {
    if (c.cocina && c.cocina.tipo_dieta && c.cocina.tipo_dieta.includes("Hiposódica")) {
      hiposodica++;
    } else {
      estandar++;
    }
  });
  document.getElementById('stat-estandar').innerText = estandar;
  document.getElementById('stat-hiposodica').innerText = hiposodica;

  // 3. Limpiar contenedor y aplicar filtros
  lista.innerHTML = '';
  const filtrados = soloAlertas ? caminantes.filter(c => c.cocina && c.cocina.requiere_atencion) : caminantes;

  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">No hay registros de cocina que coincidan.</p>';
    return;
  }

  // 4. Renderizar las tarjetas de cocina
  filtrados.forEach(c => {
    const card = document.createElement('div');
    // Si requiere atención médica en la comida, se pinta con un borde naranja de advertencia
    const requiereAtencion = c.cocina && c.cocina.requiere_atencion;
    card.className = `p-4 rounded-xl shadow-sm border bg-white ${requiereAtencion ? 'border-l-4 border-l-orange-500 border-gray-200' : 'border-gray-200'}`;
    
    // Armar el bloque visual de alertas críticas si existen (Hipertensión, Canela, Diabetes, etc.)
    let alertasHtml = '';
    if (requiereAtencion && c.cocina.alertas && c.cocina.alertas.length > 0) {
      alertasHtml = `<div class="mt-2 bg-red-50 p-2 rounded-lg border border-red-200 space-y-1">`;
      c.cocina.alertas.forEach(alerta => {
        alertasHtml += `<p class="text-xs text-red-700 flex items-center gap-1 font-medium">
          <span class="material-icons text-xs">gavel</span> ${alerta}
        </p>`;
      });
      alertasHtml += `</div>`;
    }

    // Nota original copiada desde la planilla física
    const observaciones = c.cocina && c.cocina.observaciones_origen ? c.cocina.observaciones_origen : '';
    const tipoDieta = c.cocina && c.cocina.tipo_dieta ? c.cocina.tipo_dieta : 'Estándar';

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-900">${c.nombre_completo}</h3>
          <p class="text-xs text-gray-400">Planilla N° ${c.id_planilla} • Talla: <span class="font-bold text-gray-700">${c.talla_camisa}</span></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${requiereAtencion ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">
          ${tipoDieta}
        </span>
      </div>
      ${alertasHtml}
      ${observaciones ? `<p class="text-xs italic text-gray-500 mt-2 bg-gray-50 p-1.5 rounded">Nota planilla: ${observaciones}</p>` : ''}
    `;
    lista.appendChild(card);
  });
}


// =======================================================
// ⚕️ LÓGICA DE CONTROL: SERVICIO DE SALUD
// =======================================================
export async function renderSalud() {
  const lista = document.getElementById('lista-salud');
  const query = document.getElementById('search-salud').value.toLowerCase().trim();
  lista.innerHTML = '';

  let caminantes = await db.caminantes.toArray();

  // Filtrar en tiempo real si el usuario escribe en el buscador (Nombre o Número de Planilla)
  if (query !== '') {
    caminantes = caminantes.filter(c => 
      c.nombre_completo.toLowerCase().includes(query) || 
      c.id_planilla.includes(query)
    );
  }

  if (caminantes.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">No se encontraron caminantes en el registro.</p>';
    return;
  }

  // Renderizar las tarjetas del personal médico
  caminantes.forEach(c => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-xl shadow-sm border border-gray-200 bg-white space-y-3";

    // Validar si el paciente está bajo algún tratamiento médico continuo
    let tratamientosHtml = '';
    const tieneTratamiento = c.salud && c.salud.bajo_tratamiento;
    
    if (tieneTratamiento && c.salud.tratamientos && c.salud.tratamientos.length > 0) {
      tratamientosHtml = `<div class="bg-teal-50 p-2.5 rounded-xl border border-teal-100 space-y-2">
        <p class="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
          <span class="material-icons text-sm">schedule</span> Horarios de Medicación:
        </p>`;
      
      // Mapear cada dosis emparejada con su respectiva alarma horaria
      c.salud.tratamientos.forEach(t => {
        tratamientosHtml += `
          <div class="flex justify-between items-center text-xs border-b border-teal-100/50 pb-1 last:border-0 last:pb-0">
            <span class="text-gray-700 font-medium">💊 ${t.medicamento}</span>
            <span class="bg-teal-600 text-white font-bold px-2 py-0.5 rounded-md shadow-sm">⏰ ${t.horario}</span>
          </div>`;
      });
      tratamientosHtml += `</div>`;
    } else {
      // Mensaje pasivo si está sano o sin tratamientos declarados
      tratamientosHtml = `
        <p class="text-xs text-gray-400 flex items-center gap-1">
          <span class="material-icons text-sm text-gray-300">check_circle</span> No declara tratamientos asignados.
        </p>`;
    }

    // Alergias farmacéuticas (Alerta máxima para el médico en el retiro)
    let alergiaMedHtml = '';
    if (c.salud && c.salud.alergico_medicina) {
      alergiaMedHtml = `
        <div class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
          <span class="material-icons text-sm">warning</span> ALÉRGICO A: ${c.salud.detalle_alergia_med}
        </div>`;
    }

    // Botonera de llamadas de emergencia telefónica directa
    let contactosHtml = '<div class="grid grid-cols-2 gap-2 mt-2">';
    if (c.salud && c.salud.contactos_emergencia) {
      c.salud.contactos_emergencia.forEach(con => {
        if (con.nombre && con.telefono) {
          contactosHtml += `
            <a href="tel:${con.telefono}" class="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-lg flex flex-col items-center justify-center text-center transition">
              <span class="text-[10px] font-bold text-gray-500 uppercase">${con.parentesco || 'Familiar'}</span>
              <span class="text-xs font-semibold truncate w-full">${con.nombre}</span>
              <span class="text-[10px] text-indigo-600 flex items-center gap-0.5 mt-0.5 font-medium">
                <span class="material-icons text-xs">phone</span> Llamar
              </span>
            </a>`;
        }
      });
    }
    contactosHtml += '</div>';

    const condicionEspecial = c.salud && c.salud.condicion_especial ? c.salud.condicion_especial : '';

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-900 text-base">${c.nombre_completo}</h3>
          <p class="text-xs text-gray-400">Planilla: <span class="font-semibold text-gray-600">${c.id_planilla}</span> • C.I: ${c.cedula} • Edad: ${c.edad} años</p>
        </div>
      </div>
      
      ${alergiaMedHtml}
      ${tratamientosHtml}
      
      ${condicionEspecial ? `<p class="text-xs text-gray-600 bg-amber-50 border border-amber-200 p-2 rounded-lg"><strong>Condición:</strong> ${condicionEspecial}</p>` : ''}
      
      <div class="border-t border-gray-100 pt-2">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contactos en caso de Emergencia</p>
        ${contactosHtml}
      </div>
    `;
    lista.appendChild(card);
  });
}

// Hacer globales las funciones de renderizado para acoplarlas a las pestañas dinámicas del HTML
window.renderCocina = renderCocina;
window.renderSalud = renderSalud;
