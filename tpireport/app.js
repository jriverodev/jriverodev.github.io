/**
 * TPI Reportes - Lógica de Aplicación PWA y Exportación a WhatsApp
 */

// Estado global de la aplicación
let modoFormatoBold = false;
let perfilActual = null;

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  inicializarFechaYHoraDefault();
  await cargarPerfilUsuario();
  escucharEventosFormulario();
  actualizarVistaPreviaWhatsApp();
  await cargarHistorial();
  registrarServiceWorker();
  inicializarEstadoRed();
  inicializarTema();
});

/**
 * Genera la fecha actual en formato DD/MM/YYYY
 */
function obtenerFechaFormateada(date = new Date()) {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/**
 * Genera la hora actual en formato HHMMhoras (ej: 1552horas)
 */
function obtenerHoraFormateada(date = new Date()) {
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');
  return `${horas}${minutos}horas`;
}

/**
 * Inicializa los campos de fecha y hora en el formulario
 */
function inicializarFechaYHoraDefault() {
  const inputFecha = document.getElementById('input-fecha');
  const inputHora = document.getElementById('input-hora');

  if (inputFecha && !inputFecha.value) {
    inputFecha.value = obtenerFechaFormateada();
  }
  if (inputHora && !inputHora.value) {
    inputHora.value = obtenerHoraFormateada();
  }
}

/**
 * Actualiza fecha y hora al momento actual
 */
function actualizarFechaHoraActual() {
  document.getElementById('input-fecha').value = obtenerFechaFormateada();
  document.getElementById('input-hora').value = obtenerHoraFormateada();
  actualizarVistaPreviaWhatsApp();
  mostrarToast('Fecha y hora actualizadas', 'info');
}

/**
 * Carga el perfil del operador TPI desde IndexedDB/localStorage
 */
async function cargarPerfilUsuario() {
  perfilActual = await obtenerPerfilTPI();
  if (!perfilActual) return;

  // Llenar formulario de reporte con defaults si están vacíos o no modificados
  const setIfExist = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  };

  setIfExist('input-tpi', perfilActual.tpi);
  setIfExist('input-ci', perfilActual.ci);
  setIfExist('input-tlf', perfilActual.tlf);
  setIfExist('input-radio', perfilActual.radio);
  setIfExist('input-bateria', perfilActual.bateria);
  setIfExist('input-lugar', perfilActual.lugarDefault);
  setIfExist('input-notificado', perfilActual.notificadoDefault);
  setIfExist('input-turno', perfilActual.turnoDefault);

  // Llenar formulario de Perfil tab
  setIfExist('perfil-tpi', perfilActual.tpi);
  setIfExist('perfil-ci', perfilActual.ci);
  setIfExist('perfil-tlf', perfilActual.tlf);
  setIfExist('perfil-radio', perfilActual.radio);
  setIfExist('perfil-bateria', perfilActual.bateria);
  setIfExist('perfil-lugar', perfilActual.lugarDefault);
  setIfExist('perfil-notificado', perfilActual.notificadoDefault);
  setIfExist('perfil-turno', perfilActual.turnoDefault);
}

/**
 * Escucha cambios en los campos del formulario para actualizar en vivo la vista previa
 */
function escucharEventosFormulario() {
  const campos = [
    'input-lugar', 'input-fecha', 'input-hora', 'input-turno',
    'input-tpi', 'input-ci', 'input-tlf', 'input-radio',
    'input-bateria', 'input-asunto', 'input-observaciones', 'input-notificado'
  ];

  campos.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', actualizarVistaPreviaWhatsApp);
      el.addEventListener('change', actualizarVistaPreviaWhatsApp);
    }
  });
}

/**
 * Extrae los valores actuales del formulario
 */
function obtenerDatosFormulario() {
  return {
    lugar: document.getElementById('input-lugar')?.value.trim() || '',
    fecha: document.getElementById('input-fecha')?.value.trim() || '',
    hora: document.getElementById('input-hora')?.value.trim() || '',
    turno: document.getElementById('input-turno')?.value.trim() || '',
    tpi: document.getElementById('input-tpi')?.value.trim() || '',
    ci: document.getElementById('input-ci')?.value.trim() || '',
    tlf: document.getElementById('input-tlf')?.value.trim() || '',
    radio: document.getElementById('input-radio')?.value.trim() || '',
    bateria: document.getElementById('input-bateria')?.value.trim() || '',
    asunto: document.getElementById('input-asunto')?.value.trim() || '',
    observaciones: document.getElementById('input-observaciones')?.value.trim() || '',
    notificado: document.getElementById('input-notificado')?.value.trim() || ''
  };
}

/**
 * Genera el texto exacto según la plantilla requerida para WhatsApp
 */
function generarTextoWhatsApp(datos = obtenerDatosFormulario(), boldMode = modoFormatoBold) {
  if (boldMode) {
    return `*Reporte*
*${datos.lugar}*
*Fecha:* ${datos.fecha}
*Hora:* ${datos.hora}
*Turno:* ${datos.turno}
*TPI:* ${datos.tpi}
*CI:* ${datos.ci}
*TLF:* ${datos.tlf}
*Radio:* ${datos.radio}
*Bateria:* ${datos.bateria}

*Asunto:*
${datos.asunto}

*Observaciones:*
${datos.observaciones}

*Notificado:*
${datos.notificado}`;
  }

  // Formato exacto estándar (como en la especificación del usuario)
  return `Reporte
${datos.lugar}
Fecha ${datos.fecha}
Hora ${datos.hora}
Turno: ${datos.turno}
TPI: ${datos.tpi}
CI: ${datos.ci}
TLF: ${datos.tlf}
Radio: ${datos.radio}
Bateria: ${datos.bateria}

Asunto:
${datos.asunto}

Observaciones:
${datos.observaciones}

Notificado:
${datos.notificado}`;
}

/**
 * Actualiza la caja de vista previa de WhatsApp
 */
function actualizarVistaPreviaWhatsApp() {
  const previewEl = document.getElementById('whatsapp-preview-output');
  if (!previewEl) return;

  const texto = generarTextoWhatsApp();
  previewEl.textContent = texto;
}

/**
 * Alterna entre formato de texto exacto y formato en negrita de WhatsApp
 */
function toggleFormatoWhatsApp() {
  modoFormatoBold = !modoFormatoBold;
  const labelEl = document.getElementById('label-formato');
  if (labelEl) {
    labelEl.textContent = modoFormatoBold ? 'Negrita (*)' : 'Texto Exacto';
  }
  actualizarVistaPreviaWhatsApp();
}

/**
 * Carga plantillas predeterminadas en Asunto y Observaciones
 */
function cargarPreset(tipo) {
  const inputAsunto = document.getElementById('input-asunto');
  const inputObs = document.getElementById('input-observaciones');
  const inputLugar = document.getElementById('input-lugar');

  if (tipo === 'sin_novedad') {
    const lugar = inputLugar.value || 'Edificio Principal PDVSA el Menito. (COA)';
    inputAsunto.value = `para conocimiento de los superiores se envía reporte sala COA ${lugar} encontrandose hasta la hora, sin novedad.`;
    inputObs.value = 'Sin novedad.';
  } else if (tipo === 'con_novedad') {
    inputAsunto.value = 'se informa a la superioridad novedad detectada durante la inspección operativa en la instalación.';
    inputObs.value = 'Se procede según procedimiento operativo estandarizado. Se mantiene monitoreo continuo.';
  } else if (tipo === 'cambio_guardia') {
    inputAsunto.value = 'se realiza entrega y recepción de guardia verificando inventario, equipos de comunicación y novedades en la sala.';
    inputObs.value = 'Sin novedades relevantes al momento del relevo de guardia.';
  }

  actualizarFechaHoraActual();
  actualizarVistaPreviaWhatsApp();
  mostrarToast('Plantilla cargada correctamente', 'success');
}

/**
 * Limpia el formulario restaurando valores por defecto del perfil
 */
function limpiarFormulario() {
  document.getElementById('form-reporte').reset();
  inicializarFechaYHoraDefault();
  cargarPerfilUsuario();
  actualizarVistaPreviaWhatsApp();
  mostrarToast('Formulario reiniciado', 'info');
}

/**
 * Abre WhatsApp con el mensaje cargado
 */
async function enviarWhatsApp() {
  const datos = obtenerDatosFormulario();

  if (!datos.asunto) {
    Swal.fire({
      icon: 'warning',
      title: 'Asunto Requerido',
      text: 'Por favor complete el asunto del reporte antes de enviar.',
      confirmButtonColor: '#0061A4'
    });
    return;
  }

  // Guardar automáticamente en el historial local
  await guardarReporteDB(datos);
  await cargarHistorial();

  const mensaje = generarTextoWhatsApp(datos);
  const urlEncoded = encodeURIComponent(mensaje);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${urlEncoded}`;

  // Abrir ventana de WhatsApp
  window.open(whatsappUrl, '_blank');
}

/**
 * Copia el reporte generado al portapapeles
 */
async function copiarReporte() {
  const texto = generarTextoWhatsApp();
  try {
    await navigator.clipboard.writeText(texto);
    mostrarToast('Reporte copiado al portapapeles', 'success');
  } catch (err) {
    // Fallback manual para navegadores antiguos
    const textArea = document.createElement('textarea');
    textArea.value = texto;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    mostrarToast('Reporte copiado al portapapeles', 'success');
  }
}

/**
 * Guarda el reporte en IndexedDB manualmente y notifica
 */
async function guardarEHistorial() {
  const datos = obtenerDatosFormulario();
  if (!datos.asunto) {
    mostrarToast('El asunto no puede estar vacío', 'warning');
    return;
  }

  await guardarReporteDB(datos);
  await cargarHistorial();
  mostrarToast('Reporte guardado en el historial', 'success');
}

/**
 * Utiliza la API Web Share nativa del dispositivo
 */
async function compartirReporte() {
  const texto = generarTextoWhatsApp();
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Reporte TPI PDVSA',
        text: texto
      });
    } catch (e) {
      console.log('Compartir cancelado o no soportado:', e);
    }
  } else {
    copiarReporte();
  }
}

/**
 * Renderiza la lista del historial de reportes
 */
async function cargarHistorial() {
  const contenedor = document.getElementById('historial-container');
  const badgeTotal = document.getElementById('badge-total-historial');
  const inputBuscar = document.getElementById('input-buscar-historial');
  if (!contenedor) return;

  const busqueda = inputBuscar ? inputBuscar.value : '';
  const reportes = await obtenerReportesDB(busqueda);

  if (badgeTotal) {
    badgeTotal.textContent = `${reportes.length} guardado${reportes.length === 1 ? '' : 's'}`;
  }

  if (reportes.length === 0) {
    contenedor.innerHTML = `
      <div class="text-center py-10 px-4 rounded-2xl bg-slate-100/60 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
        <span class="material-symbols-outlined text-4xl text-slate-400">folder_off</span>
        <p class="text-sm font-semibold text-slate-600 dark:text-slate-300">No hay reportes registrados</p>
        <p class="text-xs text-slate-400">Los reportes enviados o guardados aparecerán en este historial.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = reportes.map(r => `
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow space-y-3">
      <div class="flex items-start justify-between gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-2">
        <div>
          <span class="text-xs font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">domain</span>
            ${escapeHtml(r.lugar || 'Sin Lugar')}
          </span>
          <p class="text-xs text-slate-400 font-medium">
            ${escapeHtml(r.fecha)} • ${escapeHtml(r.hora)} • Turno: ${escapeHtml(r.turno || '12 hrs.')}
          </p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 shrink-0">
          TPI: ${escapeHtml(r.tpi || '')}
        </span>
      </div>

      <div class="space-y-1">
        <p class="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2">
          <strong class="text-slate-900 dark:text-white">Asunto:</strong> ${escapeHtml(r.asunto || 'Sin asunto')}
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
          <strong>Obs:</strong> ${escapeHtml(r.observaciones || 'Sin observaciones')}
        </p>
      </div>

      <div class="flex items-center justify-between pt-1 text-xs">
        <span class="text-[11px] text-slate-400">
          Notificado: ${escapeHtml(r.notificado || 'N/A')}
        </span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="enviarReporteHistorialWhatsApp(${r.id})" class="p-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors" title="Enviar por WhatsApp">
            <span class="material-symbols-outlined text-base">send</span>
          </button>
          <button type="button" onclick="verDetalleReporte(${r.id})" class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors" title="Ver Detalles">
            <span class="material-symbols-outlined text-base">visibility</span>
          </button>
          <button type="button" onclick="duplicarReporteAlFormulario(${r.id})" class="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 transition-colors" title="Editar / Cargar en Formulario">
            <span class="material-symbols-outlined text-base">edit</span>
          </button>
          <button type="button" onclick="confirmarEliminarReporte(${r.id})" class="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors" title="Eliminar">
            <span class="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Filtra la lista del historial al escribir en la barra de búsqueda
 */
function filtrarHistorial() {
  const input = document.getElementById('input-buscar-historial');
  const btnLimpiar = document.getElementById('btn-limpiar-busqueda');

  if (input && btnLimpiar) {
    if (input.value.trim().length > 0) {
      btnLimpiar.classList.remove('hidden');
    } else {
      btnLimpiar.classList.add('hidden');
    }
  }
  cargarHistorial();
}

function limpiarBusqueda() {
  const input = document.getElementById('input-buscar-historial');
  if (input) {
    input.value = '';
    filtrarHistorial();
  }
}

/**
 * Muestra el detalle del reporte en un modal emergente
 */
async function verDetalleReporte(id) {
  const reporte = await obtenerReportePorIdDB(id);
  if (!reporte) return;

  const textoFormatted = generarTextoWhatsApp(reporte, false);

  const contenidoEl = document.getElementById('modal-detalle-contenido');
  const accionesEl = document.getElementById('modal-detalle-acciones');
  const modalEl = document.getElementById('modal-detalle-reporte');

  if (contenidoEl) {
    contenidoEl.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
          <p><strong>Lugar:</strong> ${escapeHtml(reporte.lugar)}</p>
          <p><strong>Fecha/Hora:</strong> ${escapeHtml(reporte.fecha)} - ${escapeHtml(reporte.hora)} (${escapeHtml(reporte.turno)})</p>
          <p><strong>TPI:</strong> ${escapeHtml(reporte.tpi)} (C.I.: ${escapeHtml(reporte.ci)})</p>
        </div>
        <div class="wa-preview-card p-3">
          <pre class="wa-chat-bubble p-3 text-xs leading-relaxed font-sans">${escapeHtml(textoFormatted)}</pre>
        </div>
      </div>
    `;
  }

  if (accionesEl) {
    accionesEl.innerHTML = `
      <button type="button" onclick="copiarTextoDirecto(\`${escapeJsString(textoFormatted)}\`)" class="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-semibold flex items-center gap-1">
        <span class="material-symbols-outlined text-sm">content_copy</span> Copiar
      </button>
      <button type="button" onclick="enviarReporteHistorialWhatsApp(${reporte.id})" class="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1">
        <span class="material-symbols-outlined text-sm">send</span> WhatsApp
      </button>
    `;
  }

  if (modalEl) modalEl.classList.remove('hidden');
}

function cerrarModalDetalle() {
  const modalEl = document.getElementById('modal-detalle-reporte');
  if (modalEl) modalEl.classList.add('hidden');
}

/**
 * Carga los datos de un reporte existente en el formulario principal
 */
async function duplicarReporteAlFormulario(id) {
  const r = await obtenerReportePorIdDB(id);
  if (!r) return;

  document.getElementById('input-lugar').value = r.lugar || '';
  document.getElementById('input-fecha').value = r.fecha || '';
  document.getElementById('input-hora').value = r.hora || '';
  document.getElementById('input-turno').value = r.turno || '';
  document.getElementById('input-tpi').value = r.tpi || '';
  document.getElementById('input-ci').value = r.ci || '';
  document.getElementById('input-tlf').value = r.tlf || '';
  document.getElementById('input-radio').value = r.radio || '';
  document.getElementById('input-bateria').value = r.bateria || '';
  document.getElementById('input-asunto').value = r.asunto || '';
  document.getElementById('input-observaciones').value = r.observaciones || '';
  document.getElementById('input-notificado').value = r.notificado || '';

  actualizarVistaPreviaWhatsApp();
  cambiarTab('nuevo');
  mostrarToast('Reporte cargado en el formulario', 'info');
}

/**
 * Envía un reporte del historial directamente a WhatsApp
 */
async function enviarReporteHistorialWhatsApp(id) {
  const reporte = await obtenerReportePorIdDB(id);
  if (!reporte) return;

  const mensaje = generarTextoWhatsApp(reporte, false);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  window.open(whatsappUrl, '_blank');
}

/**
 * Confirma la eliminación de un reporte individual
 */
async function confirmarEliminarReporte(id) {
  const res = await Swal.fire({
    title: '¿Eliminar reporte?',
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  });

  if (res.isConfirmed) {
    await eliminarReporteDB(id);
    await cargarHistorial();
    mostrarToast('Reporte eliminado', 'success');
  }
}

/**
 * Vacía todo el historial previa confirmación
 */
async function confirmarVaciarHistorial() {
  const res = await Swal.fire({
    title: '¿Vaciar todo el historial?',
    text: 'Se borrarán todos los reportes guardados en este dispositivo.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Sí, vaciar todo',
    cancelButtonText: 'Cancelar'
  });

  if (res.isConfirmed) {
    await vaciarHistorialDB();
    await cargarHistorial();
    mostrarToast('Historial vaciado completamente', 'success');
  }
}

/**
 * Guarda los datos del perfil TPI desde la pestaña Perfil
 */
async function guardarPerfilHandler() {
  const perfil = {
    tpi: document.getElementById('perfil-tpi').value.trim(),
    ci: document.getElementById('perfil-ci').value.trim(),
    tlf: document.getElementById('perfil-tlf').value.trim(),
    radio: document.getElementById('perfil-radio').value.trim(),
    bateria: document.getElementById('perfil-bateria').value.trim(),
    turnoDefault: document.getElementById('perfil-turno').value.trim(),
    lugarDefault: document.getElementById('perfil-lugar').value.trim(),
    notificadoDefault: document.getElementById('perfil-notificado').value.trim()
  };

  await guardarPerfilTPI(perfil);
  await cargarPerfilUsuario();

  Swal.fire({
    icon: 'success',
    title: 'Perfil Guardado',
    text: 'Sus datos predeterminados fueron guardados correctamente.',
    confirmButtonColor: '#0061A4'
  });
}

/**
 * Exporta el historial en formato JSON
 */
async function exportarHistorialJSON() {
  const reportes = await obtenerReportesDB();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportes, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tpi_reportes_backup_${obtenerFechaFormateada().replace(/\//g, '-')}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Importa reportes desde un archivo JSON
 */
async function importarHistorialJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const items = JSON.parse(e.target.result);
      if (Array.isArray(items)) {
        for (const item of items) {
          await guardarReporteDB(item);
        }
        await cargarHistorial();
        mostrarToast(`${items.length} reportes importados con éxito`, 'success');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Error de importación',
        text: 'El archivo JSON seleccionado no tiene un formato válido.',
        confirmButtonColor: '#0061A4'
      });
    }
  };
  reader.readAsText(file);
}

/**
 * Manejo de pestañas principales (Nuevo, Historial, Perfil)
 */
function cambiarTab(tabName) {
  const views = ['nuevo', 'historial', 'perfil'];

  views.forEach(v => {
    const sec = document.getElementById(`view-${v}`);
    const btn = document.getElementById(`tab-btn-${v}`);

    if (v === tabName) {
      sec?.classList.remove('hidden');
      btn?.classList.add('nav-tab-active');
    } else {
      sec?.classList.add('hidden');
      btn?.classList.remove('nav-tab-active');
    }
  });

  if (tabName === 'historial') {
    cargarHistorial();
  }
}

/**
 * Toggle de tema oscuro / claro
 */
function inicializarTema() {
  const temaGuardado = localStorage.getItem('tpi_tema') || 'light';
  aplicarTema(temaGuardado);

  const btnToggle = document.getElementById('btn-theme-toggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const esOscuro = document.documentElement.classList.contains('dark');
      const nuevoTema = esOscuro ? 'light' : 'dark';
      aplicarTema(nuevoTema);
      localStorage.setItem('tpi_tema', nuevoTema);
    });
  }
}

function aplicarTema(tema) {
  const iconTheme = document.getElementById('icon-theme');
  if (tema === 'dark') {
    document.documentElement.classList.add('dark');
    if (iconTheme) iconTheme.textContent = 'light_mode';
  } else {
    document.documentElement.classList.remove('dark');
    if (iconTheme) iconTheme.textContent = 'dark_mode';
  }
}

/**
 * Indicador de conectividad de red
 */
function inicializarEstadoRed() {
  const led = document.getElementById('led-network-status');
  const actualizarRed = () => {
    if (navigator.onLine) {
      led?.classList.remove('bg-rose-500');
      led?.classList.add('bg-emerald-500');
      led?.setAttribute('title', 'En línea (Online)');
    } else {
      led?.classList.remove('bg-emerald-500');
      led?.classList.add('bg-rose-500');
      led?.setAttribute('title', 'Modo Fuera de Línea (Offline)');
    }
  };

  window.addEventListener('online', actualizarRed);
  window.addEventListener('offline', actualizarRed);
  actualizarRed();
}

/**
 * Registro de Service Worker para PWA
 */
function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker de TPI Reportes registrado:', reg.scope))
        .catch(err => console.warn('Error al registrar Service Worker:', err));
    });
  }
}

/**
 * Helper para notificaciones Toast con SweetAlert2
 */
function mostrarToast(mensaje, icono = 'success') {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: icono,
    title: mensaje,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
}

/**
 * Helpers para sanitizar HTML y JS strings
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJsString(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function copiarTextoDirecto(texto) {
  navigator.clipboard.writeText(texto).then(() => {
    mostrarToast('Texto copiado al portapapeles', 'success');
  });
}
