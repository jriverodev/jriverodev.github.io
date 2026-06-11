import { db } from './db.js';
import { sincronizarDatos } from './sync.js';

// --- INICIALIZACIÓN Y EVENTOS ---
document.addEventListener('DOMContentLoaded', async () => {
  // Actualizar el conteo inicial de caminantes al abrir la app
  await actualizarConteoLocal();

  // Escuchar el clic del botón de sincronización
  document.getElementById('btn-sync').addEventListener('click', ejecutarSincronizacion);

  // Escuchar filtros de cocina (Ver sólo alertas críticas)
  document.getElementById('chk-solo-alertas').addEventListener('change', () => {
    renderCocina();
  });

  // Escuchar barra de búsqueda del servicio de salud
  document.getElementById('search-salud').addEventListener('input', () => {
    renderSalud();
  });
});

// Actualiza el número de caminantes guardados en el teléfono
async function actualizarConteoLocal() {
  const count = await db.caminantes.count();
  document.getElementById('local-count').innerText = count;
}

// Controla el proceso de descarga desde el Google Sheet
async function ejecutarSincronizacion() {
  const btn = document.getElementById('btn-sync');
  const status = document.getElementById('sync-status');
  
  btn.disabled = true;
  btn.innerHTML = `<span class="material-icons animate-spin">sync</span> Descargando...`;
  status.innerText = "Conectando con Google Sheets...";

  const resultado = await sincronizarDatos();

  btn.disabled = false;
  btn.innerHTML = `<span class="material-icons">sync</span> Descargar Datos del Sheets`;

  if (resultado.exito) {
    status.innerHTML = `<span class="text-green-600 font-bold">¡Éxito! Carga completada.</span>`;
    await actualizarConteoLocal();
    // Si estamos en otra pestaña, refrescar la interfaz
    renderCocina();
    renderSalud();
  } else {
    status.innerHTML = `<span class="text-red-600 font-bold">Error: ${resultado.error}</span>`;
  }
}


// =======================================================
// 🍽️ LÓGICA DEL SERVICIO DE COCINA
// =======================================================
export async function renderCocina() {
  const lista = document.getElementById('lista-cocina');
  const soloAlertas = document.getElementById('chk-solo-alertas').checked;
  lista.innerHTML = '<p class="text-gray-400 text-center text-sm py-4">Cargando menú...</p>';

  // 1. Obtener todos los caminantes de la IndexedDB
  const caminantes = await db.caminantes.toArray();

  // 2. Calcular estadísticas para el Jefe de Cocina
  let estandar = 0;
  let hiposodica = 0;
  caminantes.forEach(c => {
    if (c.cocina.tipo_dieta.includes("Hiposódica")) hiposodica++;
    else estandar++;
  });
  document.getElementById('stat-estandar').innerText = estandar;
  document.getElementById('stat-hiposodica').innerText = hiposodica;

  // 3. Filtrar y Renderizar tarjetas
  lista.innerHTML = '';
  const filtrados = soloAlertas ? caminantes.filter(c => c.cocina.requiere_atencion) : caminantes;

  if (filtrados.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">No hay registros que coincidan.</p>';
    return;
  }

  filtrados.forEach(c => {
    const card = document.createElement('div');
    // Si requiere atención, borde naranja/rojo, si no, blanco estándar
    card.className = `p-4 rounded-xl shadow-sm border bg-white ${c.cocina.requiere_atencion ? 'border-l-4 border-l-orange-500 border-gray-200' : 'border-gray-200'}`;
    
    // Crear el bloque de alertas si existen (Hipertensión, Canela, etc.)
    let alertasHtml = '';
    if (c.cocina.requiere_atencion && c.cocina.alertas.length > 0) {
      alertasHtml = `<div class="mt-2 bg-red-50 p-2 rounded-lg border border-red-200 space-y-1">`;
      c.cocina.alertas.forEach(alerta => {
        alertasHtml += `<p class="text-xs text-red-700 flex items-center gap-1 font-medium">
          <span class="material-icons text-xs">gavel</span> ${alerta}
        </p>`;
      });
      alertasHtml += `</div>`;
    }

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-900">${c.nombre_completo}</h3>
          <p class="text-xs text-gray-400">Planilla N° ${c.id_planilla} • Talla: <span class="font-bold text-gray-700">${c.talla_camisa}</span></p>
        </div>
        <span class="px-2 py-0.5 rounded text-xs font-semibold ${c.cocina.requiere_atencion ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}">
          ${c.cocina.tipo_dieta}
        </span>
      </div>
      ${alertasHtml}
      ${c.cocina.observaciones_origen ? `<p class="text-xs italic text-gray-500 mt-2 bg-gray-50 p-1.5 rounded">Nota planilla: ${c.cocina.observaciones_origen}</p>` : ''}
    `;
    lista.appendChild(card);
  });
}


// =======================================================
// ⚕️ LÓGICA DEL SERVICIO DE SALUD
// =======================================================
export async function renderSalud() {
  const lista = document.getElementById('lista-salud');
  const query = document.getElementById('search-salud').value.toLowerCase().trim();
  lista.innerHTML = '';

  let caminantes = await db.caminantes.toArray();

  // Filtrar si hay una búsqueda activa por nombre o planilla
  if (query !== '') {
    caminantes = caminantes.filter(c => 
      c.nombre_completo.toLowerCase().includes(query) || 
      c.id_planilla.includes(query)
    );
  }

  if (caminantes.length === 0) {
    lista.innerHTML = '<p class="text-gray-500 text-center text-sm py-4">No se encontraron caminantes.</p>';
    return;
  }

  caminantes.forEach(c => {
    const card = document.createElement('div');
    card.className = "p-4 rounded-xl shadow-sm border border-gray-200 bg-white space-y-3";

    // Generar la agenda de tratamientos/horarios si los tiene
    let tratamientosHtml = '';
    if (c.salud.bajo_treatment && c.salud.tratamientos.length > 0) {
      tratamientosHtml = `<div class="bg-teal-50 p-2.5 rounded-xl border border-teal-100 space-y-2">
        <p class="text-xs font-bold text-teal-800 uppercase tracking-wider flex items-center gap-1">
          <span class="material-icons text-sm">schedule</span> Horarios de Medicación:
        </p>`;
      c.salud.tratamientos.forEach(t => {
        tratamientosHtml += `
          <div class="flex justify-between items-center text-xs border-b border-teal-100/50 pb-1 last:border-0 last:pb-0">
            <span class="text-gray-700 font-medium">💊 ${t.medicamento}</span>
            <span class="bg-teal-600 text-white font-bold px-2 py-0.5 rounded-md shadow-sm">⏰ ${t.horario}</span>
          </div>`;
      });
      tratamientosHtml += `</div>`;
    } else {
      tratamientosHtml = `
        <p class="text-xs text-gray-400 flex items-center gap-1">
          <span class="material-icons text-sm text-gray-300">check_circle</span> No declara tratamientos asignados.
        </p>`;
    }

    // Alergias médicas (Crítico)
    let alergiaMedHtml = '';
    if (c.salud.alergico_medicina) {
      alergiaMedHtml = `
        <div class="bg-red-100 text-red-800 text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
          <span class="material-icons text-sm">warning</span> ALÉRGICO A: ${c.salud.detalle_alergia_med}
        </div>`;
    }

    // Botones de llamada rápida para emergencias familiares
    let contactosHtml = '<div class="grid grid-cols-2 gap-2 mt-2">';
    c.salud.contactos_emergencia.forEach((con, idx) => {
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
    contactosHtml += '</div>';

    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-gray-900 text-base">${c.nombre_completo}</h3>
          <p class="text-xs text-gray-400">Planilla: <span class="font-semibold text-gray-600">${c.id_planilla}</span> • C.I: ${c.cedula} • Edad: ${c.edad} años</p>
        </div>
      </div>
      
      ${alergiaMedHtml}
      ${tratamientosHtml}
      
      ${c.salid.condicion_especial ? `<p class="text-xs text-gray-600 bg-amber-50 border border-amber-200 p-2 rounded-lg"><strong>Condición:</strong> ${c.salud.condicion_especial}</p>` : ''}
      
      <div class="border-t border-gray-100 pt-2">
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Contactos en caso de Emergencia</p>
        ${contactosHtml}
      </div>
    `;
    lista.appendChild(card);
  });
}

// Hacer globales las funciones de renderizado para el switch de vistas del HTML
window.renderCocina = renderCocina;
window.renderSalud = renderSalud;
