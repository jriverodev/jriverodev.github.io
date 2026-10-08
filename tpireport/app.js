/**
 * TPI Reportes - Lógica de Aplicación PWA, Fotos GPS y Exportación a WhatsApp
 */

// Estado global de la aplicación
let modoFormatoBold = false;
let perfilActual = null;
let coordenadasGPSActuales = { lat: null, lon: null, alt: null, acc: null };
let fotoCanvasProcessedData = null;

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
  inicializarFechaYHoraDefault();
  await cargarPerfilUsuario();
  escucharEventosFormulario();
  actualizarVistaPreviaWhatsApp();
  await cargarHistorial();
  await cargarGaleriaFotos();
  obtenerCoordenadasGPS();
  registrarServiceWorker();
  inicializarEstadoRed();
  inicializarTema();
});

/**
 * Convierte fecha YYYY-MM-DD a DD/MM/YYYY
 */
function formatearFechaEspanol(isoDate) {
  if (!isoDate) return '';
  const partes = isoDate.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return isoDate;
}

/**
 * Convierte hora HH:MM a HHMMhoras (ej: 15:52 -> 1552horas)
 */
function formatearHoraWhatsApp(timeStr) {
  if (!timeStr) return '';
  const limpia = timeStr.replace(':', '');
  return `${limpia}horas`;
}

/**
 * Sincroniza la fecha seleccionada en el input nativo con la plantilla WhatsApp
 */
function sincronizarFechaPicker() {
  const nativePicker = document.getElementById('input-fecha-native');
  const hiddenInput = document.getElementById('input-fecha');
  if (nativePicker && hiddenInput) {
    hiddenInput.value = formatearFechaEspanol(nativePicker.value);
    actualizarVistaPreviaWhatsApp();
  }
}

/**
 * Sincroniza la hora seleccionada en el input nativo con la plantilla WhatsApp
 */
function sincronizarHoraPicker() {
  const nativePicker = document.getElementById('input-hora-native');
  const hiddenInput = document.getElementById('input-hora');
  if (nativePicker && hiddenInput) {
    hiddenInput.value = formatearHoraWhatsApp(nativePicker.value);
    actualizarVistaPreviaWhatsApp();
  }
}

/**
 * Establece un atajo rápido de hora
 */
function setAtajoHora(horaStr) {
  const nativePicker = document.getElementById('input-hora-native');
  if (nativePicker) {
    nativePicker.value = horaStr;
    sincronizarHoraPicker();
    mostrarToast(`Hora fijada a ${horaStr}`, 'info');
  }
}

/**
 * Genera la fecha actual en formato ISO YYYY-MM-DD
 */
function obtenerFechaISOHoy(date = new Date()) {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${anio}-${mes}-${dia}`;
}

/**
 * Genera la hora actual en formato HH:MM
 */
function obtenerHoraISOHoy(date = new Date()) {
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');
  return `${horas}:${minutos}`;
}

/**
 * Inicializa los campos de fecha y hora en el formulario
 */
function inicializarFechaYHoraDefault() {
  const nativeDate = document.getElementById('input-fecha-native');
  const nativeTime = document.getElementById('input-hora-native');

  if (nativeDate && !nativeDate.value) {
    nativeDate.value = obtenerFechaISOHoy();
    sincronizarFechaPicker();
  }
  if (nativeTime && !nativeTime.value) {
    nativeTime.value = obtenerHoraISOHoy();
    sincronizarHoraPicker();
  }
}

/**
 * Actualiza fecha y hora al momento actual
 */
function actualizarFechaHoraActual() {
  const nativeDate = document.getElementById('input-fecha-native');
  const nativeTime = document.getElementById('input-hora-native');

  if (nativeDate) nativeDate.value = obtenerFechaISOHoy();
  if (nativeTime) nativeTime.value = obtenerHoraISOHoy();

  sincronizarFechaPicker();
  sincronizarHoraPicker();
  mostrarToast('Fecha y hora actualizadas', 'info');
}

/**
 * Obtiene las coordenadas GPS del dispositivo mediante Geolocation API
 */
function obtenerCoordenadasGPS() {
  const latEl = document.getElementById('gps-lat');
  const lonEl = document.getElementById('gps-lon');
  const accEl = document.getElementById('gps-acc');
  const altEl = document.getElementById('gps-alt');

  if (latEl) latEl.textContent = 'Buscando satélites...';
  if (lonEl) lonEl.textContent = 'Buscando satélites...';

  if (!('geolocation' in navigator)) {
    if (latEl) latEl.textContent = 'No soportado';
    if (lonEl) lonEl.textContent = 'No soportado';
    return;
  }

  const opciones = {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  };

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coordenadasGPSActuales = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        alt: pos.coords.altitude ? `${Math.round(pos.coords.altitude)}m` : 'N/A',
        acc: pos.coords.accuracy ? `±${Math.round(pos.coords.accuracy)}m` : 'N/A'
      };

      if (latEl) latEl.textContent = coordenadasGPSActuales.lat.toFixed(6);
      if (lonEl) lonEl.textContent = coordenadasGPSActuales.lon.toFixed(6);
      if (accEl) accEl.textContent = coordenadasGPSActuales.acc;
      if (altEl) altEl.textContent = coordenadasGPSActuales.alt;

      actualizarVistaPreviaWhatsApp();
    },
    (err) => {
      console.warn('Error al obtener GPS:', err.message);
      if (latEl) latEl.textContent = 'Ubicación desactivada';
      if (lonEl) lonEl.textContent = 'Ubicación desactivada';
    },
    opciones
  );
}

/**
 * Carga el perfil del operador TPI desde IndexedDB/localStorage
 */
async function cargarPerfilUsuario() {
  perfilActual = await obtenerPerfilTPI();
  if (!perfilActual) return;

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
    notificado: document.getElementById('input-notificado')?.value.trim() || '',
    incluirGpsLink: document.getElementById('chk-incluir-gps-wa')?.checked || false
  };
}

/**
 * Genera el texto exacto según la plantilla requerida para WhatsApp
 */
function generarTextoWhatsApp(datos = obtenerDatosFormulario(), boldMode = modoFormatoBold) {
  let gpsText = '';
  if (datos.incluirGpsLink && coordenadasGPSActuales.lat && coordenadasGPSActuales.lon) {
    const mapsLink = `https://maps.google.com/?q=${coordenadasGPSActuales.lat},${coordenadasGPSActuales.lon}`;
    gpsText = boldMode ? `\n\n*Ubicación GPS Satelital:*\n${mapsLink}` : `\n\nUbicación GPS Satelital:\n${mapsLink}`;
  }

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
${datos.notificado}${gpsText}`;
  }

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
${datos.notificado}${gpsText}`;
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
 * Carga plantillas predeterminadas
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
 * Procesa la foto capturada imprimiendo una marca de agua completa en el canvas
 */
function procesarFotoConMarcaDeAgua(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.getElementById('canvas-watermark');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      canvas.width = img.width;
      canvas.height = img.height;

      // Dibujar imagen original
      ctx.drawImage(img, 0, 0);

      // Calcular proporciones de marca de agua
      const bannerHeight = Math.max(120, img.height * 0.18);
      const fontSizeHeading = Math.max(16, bannerHeight * 0.18);
      const fontSizeBody = Math.max(13, bannerHeight * 0.14);

      // Banner inferior translúcido estilo industrial
      ctx.fillStyle = 'rgba(11, 37, 69, 0.88)';
      ctx.fillRect(0, img.height - bannerHeight, img.width, bannerHeight);

      // Borde decorativo verde turquesa
      ctx.fillStyle = '#00A896';
      ctx.fillRect(0, img.height - bannerHeight, img.width, 6);

      // Datos a estampar
      const datos = obtenerDatosFormulario();
      const fechaHoraActual = `${datos.fecha || obtenerFechaISOHoy()} - ${datos.hora || '1200horas'}`;
      const gpsStr = (coordenadasGPSActuales.lat && coordenadasGPSActuales.lon)
        ? `GPS: Lat ${coordenadasGPSActuales.lat.toFixed(6)}, Lon ${coordenadasGPSActuales.lon.toFixed(6)} (${coordenadasGPSActuales.acc})`
        : 'GPS: No disponible al momento de captura';

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${fontSizeHeading}px sans-serif`;
      ctx.fillText(`TPI INSPECCIÓN: ${datos.tpi || 'Miguel Rivero'} (C.I. ${datos.ci || '20.458.588'})`, 20, img.height - bannerHeight + fontSizeHeading + 12);

      ctx.fillStyle = '#E2EBF2';
      ctx.font = `${fontSizeBody}px sans-serif`;
      ctx.fillText(`LUGAR: ${datos.lugar || 'PDVSA el Menito (COA)'}`, 20, img.height - bannerHeight + fontSizeHeading + fontSizeBody + 20);

      ctx.fillStyle = '#8ECAE6';
      ctx.font = `bold ${fontSizeBody}px monospace`;
      ctx.fillText(`FECHA/HORA: ${fechaHoraActual}`, 20, img.height - bannerHeight + fontSizeHeading + (fontSizeBody * 2) + 26);

      ctx.fillStyle = '#00A896';
      ctx.font = `bold ${fontSizeBody}px monospace`;
      ctx.fillText(gpsStr, 20, img.height - bannerHeight + fontSizeHeading + (fontSizeBody * 3) + 32);

      // Guardar objeto de datos procesados
      fotoCanvasProcessedData = {
        dataUrl: canvas.toDataURL('image/jpeg', 0.85),
        latitude: coordenadasGPSActuales.lat,
        longitude: coordenadasGPSActuales.lon,
        altitude: coordenadasGPSActuales.alt,
        accuracy: coordenadasGPSActuales.acc,
        lugar: datos.lugar,
        tpi: datos.tpi
      };

      const previewBox = document.getElementById('preview-foto-container');
      if (previewBox) previewBox.classList.remove('hidden');

      mostrarToast('Marca de agua GPS agregada', 'success');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/**
 * Descarta la foto procesada actual
 */
function descartarFotoActual() {
  fotoCanvasProcessedData = null;
  const previewBox = document.getElementById('preview-foto-container');
  if (previewBox) previewBox.classList.add('hidden');
}

/**
 * Guarda la foto con marca de agua en la galería de evidencias IndexedDB
 */
async function guardarFotoEnHistorial() {
  if (!fotoCanvasProcessedData) return;

  await guardarFotoDB(fotoCanvasProcessedData);
  descartarFotoActual();
  await cargarGaleriaFotos();

  Swal.fire({
    icon: 'success',
    title: 'Foto Guardada',
    text: 'La fotografía con marca de agua y GPS fue almacenada en la galería.',
    confirmButtonColor: '#134074'
  });
}

/**
 * Carga las fotos guardadas en la galería
 */
async function cargarGaleriaFotos() {
  const grid = document.getElementById('fotos-galeria-grid');
  const badgeTotal = document.getElementById('badge-total-fotos');
  if (!grid) return;

  const fotos = await obtenerFotosDB();

  if (badgeTotal) {
    badgeTotal.textContent = `${fotos.length} foto${fotos.length === 1 ? '' : 's'}`;
  }

  if (fotos.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-8 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700">
        <span class="material-symbols-outlined text-3xl text-slate-400">add_a_photo</span>
        <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">No hay fotografías con GPS registradas</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = fotos.map(f => `
    <div class="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-2 pb-2">
      <div class="relative h-44 bg-black">
        <img src="${f.dataUrl}" alt="Foto GPS TPI" class="w-full h-full object-cover">
        <div class="absolute inset-0 photo-card-overlay flex flex-col justify-end p-2.5 text-white">
          <span class="text-[10px] font-bold text-[#8ECAE6] flex items-center gap-1">
            <span class="material-symbols-outlined text-xs text-[#00A896]">location_on</span>
            ${escapeHtml(f.lugar || 'PDVSA el Menito')}
          </span>
          <span class="text-[9px] font-mono text-slate-200">
            ${f.latitude ? `GPS: ${f.latitude.toFixed(5)}, ${f.longitude.toFixed(5)}` : 'Sin GPS'}
          </span>
        </div>
      </div>
      <div class="px-2.5 flex items-center justify-between text-xs">
        <span class="text-[10px] text-slate-400">
          Inspector: ${escapeHtml(f.tpi || 'TPI')}
        </span>
        <div class="flex items-center gap-1">
          ${f.latitude ? `
            <button type="button" onclick="copiarGpsEnlace(${f.latitude}, ${f.longitude})" class="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200" title="Copiar enlace GPS">
              <span class="material-symbols-outlined text-sm">link</span>
            </button>
          ` : ''}
          <button type="button" onclick="confirmarEliminarFoto(${f.id})" class="p-1 rounded bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400" title="Eliminar">
            <span class="material-symbols-outlined text-sm">delete</span>
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

function copiarGpsEnlace(lat, lon) {
  const url = `https://maps.google.com/?q=${lat},${lon}`;
  navigator.clipboard.writeText(url).then(() => {
    mostrarToast('Enlace de Google Maps copiado', 'success');
  });
}

async function confirmarEliminarFoto(id) {
  const res = await Swal.fire({
    title: '¿Eliminar foto?',
    text: 'Esta evidencia será eliminada del dispositivo.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#e11d48',
    confirmButtonText: 'Eliminar'
  });

  if (res.isConfirmed) {
    await eliminarFotoDB(id);
    await cargarGaleriaFotos();
    mostrarToast('Fotografía eliminada', 'success');
  }
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
      confirmButtonColor: '#134074'
    });
    return;
  }

  await guardarReporteDB(datos);
  await cargarHistorial();

  const mensaje = generarTextoWhatsApp(datos);
  const urlEncoded = encodeURIComponent(mensaje);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${urlEncoded}`;

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
 * Guarda el reporte en IndexedDB manualmente
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
          <span class="text-xs font-bold text-[#134074] dark:text-[#8ECAE6] flex items-center gap-1">
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

async function enviarReporteHistorialWhatsApp(id) {
  const reporte = await obtenerReportePorIdDB(id);
  if (!reporte) return;

  const mensaje = generarTextoWhatsApp(reporte, false);
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  window.open(whatsappUrl, '_blank');
}

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
    confirmButtonColor: '#134074'
  });
}

async function exportarHistorialJSON() {
  const reportes = await obtenerReportesDB();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(reportes, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `tpi_reportes_backup_${obtenerFechaISOHoy()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

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
        confirmButtonColor: '#134074'
      });
    }
  };
  reader.readAsText(file);
}

/**
 * Manejo de pestañas principales (Nuevo, Fotos, Historial, Perfil)
 */
function cambiarTab(tabName) {
  const views = ['nuevo', 'fotos', 'historial', 'perfil'];

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
  } else if (tabName === 'fotos') {
    cargarGaleriaFotos();
    obtenerCoordenadasGPS();
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
