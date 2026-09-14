/**
 * app.js
 * Módulo principal de la aplicación Separador de Pistas PWA.
 * Integra Hugging Face Space API (@gradio/client / Demucs v4),
 * el almacenamiento local Dexie (db.js) y el reproductor multipista (audioPlayer.js).
 */

import { Client } from 'https://cdn.jsdelivr.net/npm/@gradio/client/+esm';
import { MultiTrackPlayer } from './audioPlayer.js';
import {
  guardarNuevoProyecto,
  guardarPistasSeparadas,
  obtenerTodosLosProyectos,
  cargarPistasDelProyecto,
  eliminarProyecto,
  db
} from './db.js';

// Instancia global del reproductor multipista
const player = new MultiTrackPlayer();

// Estado de la aplicación
let proyectoActualId = null;
let archivoSeleccionado = null;
let hfClient = null;

// Elementos del DOM
const statusBox = document.getElementById('status-box');
const statusIcon = document.getElementById('status-icon');
const statusMessage = document.getElementById('status-message');
const statusSubtext = document.getElementById('status-subtext');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressBar = document.getElementById('progress-bar');

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileNameDisplay = document.getElementById('file-name');
const btnProcesar = document.getElementById('btn-procesar');
const spaceSelect = document.getElementById('space-select');

// Sección Reproductor
const mixerSection = document.getElementById('mixer-section');
const currentProjectTitle = document.getElementById('current-project-title');
const btnPlayPause = document.getElementById('btn-play-pause');
const btnStop = document.getElementById('btn-stop');
const seekBar = document.getElementById('seek-bar');
const timeDisplay = document.getElementById('time-display');
const masterVolumeSlider = document.getElementById('master-volume');

// Faders y Botones por Pista
const stemsConfig = [
  { key: 'vocals', name: 'Voces', icon: '🎤', faderId: 'vol-vocals', muteId: 'mute-vocals', soloId: 'solo-vocals', dlId: 'dl-vocals' },
  { key: 'drums', name: 'Batería', icon: '🥁', faderId: 'vol-drums', muteId: 'mute-drums', soloId: 'solo-drums', dlId: 'dl-drums' },
  { key: 'bass', name: 'Bajo', icon: '🎸', faderId: 'vol-bass', muteId: 'mute-bass', soloId: 'solo-bass', dlId: 'dl-bass' },
  { key: 'other', name: 'Otros', icon: '🎹', faderId: 'vol-other', muteId: 'mute-other', soloId: 'solo-other', dlId: 'dl-other' }
];

// Lista de Proyectos
const listaProyectos = document.getElementById('lista-proyectos');
const emptyProjectsMessage = document.getElementById('empty-projects');

// Indicador de estado de conexión
const netStatusIndicator = document.getElementById('net-status-indicator');

// ----------------------------------------------------
// Inicialización
// ----------------------------------------------------
window.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupPlayerCallbacks();
  actualizarEstadoRed();
  cargarListaProyectos();
});

// Detectar cambios en el estado de red
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

function actualizarEstadoRed() {
  if (navigator.onLine) {
    netStatusIndicator.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2"></span>Online`;
    netStatusIndicator.className = "text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  } else {
    netStatusIndicator.innerHTML = `<span class="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 mr-2"></span>Modo Offline`;
    netStatusIndicator.className = "text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20";
  }
}

// ----------------------------------------------------
// Configuración de Eventos UI
// ----------------------------------------------------
function setupEventListeners() {
  // Selección de archivo vía input o Drag and Drop
  fileInput.addEventListener('change', (e) => manejarSeleccionArchivo(e.target.files[0]));

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-cyan-500', 'bg-cyan-500/5');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-cyan-500', 'bg-cyan-500/5');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-cyan-500', 'bg-cyan-500/5');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      manejarSeleccionArchivo(e.dataTransfer.files[0]);
    }
  });

  // Botón procesar
  btnProcesar.addEventListener('click', ejecutarProcesamientoIA);

  // Reproductor Master
  btnPlayPause.addEventListener('click', () => {
    if (player.isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  });

  btnStop.addEventListener('click', () => {
    player.stop();
  });

  seekBar.addEventListener('input', (e) => {
    const targetTime = parseFloat(e.target.value);
    player.seek(targetTime);
  });

  masterVolumeSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value) / 100;
    player.setMasterVolume(vol);
  });

  // Eventos para cada uno de los 4 faders, Mute y Solo
  stemsConfig.forEach(stem => {
    const fader = document.getElementById(stem.faderId);
    const muteBtn = document.getElementById(stem.muteId);
    const soloBtn = document.getElementById(stem.soloId);

    if (fader) {
      fader.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        player.setTrackVolume(stem.key, val);
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = player.toggleTrackMute(stem.key);
        if (isMuted) {
          muteBtn.classList.add('bg-rose-600', 'text-white');
          muteBtn.classList.remove('bg-slate-700', 'text-slate-300');
        } else {
          muteBtn.classList.remove('bg-rose-600', 'text-white');
          muteBtn.classList.add('bg-slate-700', 'text-slate-300');
        }
      });
    }

    if (soloBtn) {
      soloBtn.addEventListener('click', () => {
        const isSolo = player.toggleTrackSolo(stem.key);
        if (isSolo) {
          soloBtn.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
          soloBtn.classList.remove('bg-slate-700', 'text-slate-300');
        } else {
          soloBtn.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
          soloBtn.classList.add('bg-slate-700', 'text-slate-300');
        }
      });
    }
  });
}

// Callbacks del reproductor para mantener sincronizada la UI
function setupPlayerCallbacks() {
  player.setOnTimeUpdate((currentTime, duration) => {
    seekBar.max = duration || 100;
    seekBar.value = currentTime || 0;
    timeDisplay.innerText = `${formatearTiempo(currentTime)} / ${formatearTiempo(duration)}`;
  });

  player.setOnStateChange((isPlaying) => {
    if (isPlaying) {
      btnPlayPause.innerHTML = `
        <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
        <span>Pausar</span>
      `;
      btnPlayPause.className = "flex items-center space-x-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl transition duration-200 shadow-lg shadow-amber-500/20";
    } else {
      btnPlayPause.innerHTML = `
        <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <span>Reproducir</span>
      `;
      btnPlayPause.className = "flex items-center space-x-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl transition duration-200 shadow-lg shadow-cyan-500/20";
    }
  });

  player.setOnEnd(() => {
    btnPlayPause.innerHTML = `
      <svg class="w-6 h-6 fill-current" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z"/>
      </svg>
      <span>Reproducir</span>
    `;
    btnPlayPause.className = "flex items-center space-x-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl transition duration-200 shadow-lg shadow-cyan-500/20";
  });
}

// ----------------------------------------------------
// Gestión de Selección de Archivos
// ----------------------------------------------------
async function manejarSeleccionArchivo(file) {
  if (!file) return;

  if (!file.type.includes('audio') && !file.name.match(/\.(mp3|wav|flac|ogg|m4a)$/i)) {
    mostrarEstado("⚠️ Por favor selecciona un archivo de audio válido (.mp3, .wav)", "error");
    return;
  }

  archivoSeleccionado = file;
  fileNameDisplay.innerText = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;

  mostrarEstado("Calculando duración del archivo...", "info");

  // Obtener duración con AudioContext
  try {
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    const duracion = audioBuffer.duration;
    tempCtx.close();

    // Guardar borrador en Dexie
    proyectoActualId = await guardarNuevoProyecto(file.name, file, duracion);

    btnProcesar.disabled = false;
    mostrarEstado(`✅ Archivo cargado localmente. Listo para separar instrumentos.`, "exito");
    cargarListaProyectos();
  } catch (err) {
    console.error("Error al leer duración del archivo:", err);
    proyectoActualId = await guardarNuevoProyecto(file.name, file, 0);
    btnProcesar.disabled = false;
    mostrarEstado(`✅ Archivo cargado. Listo para separar instrumentos.`, "exito");
    cargarListaProyectos();
  }
}

// ----------------------------------------------------
// Procesamiento de IA con Hugging Face Demucs v4 API
// ----------------------------------------------------
async function ejecutarProcesamientoIA() {
  if (!proyectoActualId || !archivoSeleccionado) {
    mostrarEstado("No hay un archivo seleccionado para procesar.", "error");
    return;
  }

  if (!navigator.onLine) {
    mostrarEstado("⚠️ Se requiere conexión a internet para procesar el audio con la API de Hugging Face.", "error");
    return;
  }

  btnProcesar.disabled = true;
  const spaceId = spaceSelect ? spaceSelect.value : "akhaliq/demucs";

  try {
    // 1. Estado Conectando
    mostrarEstado("🔌 Conectando con Hugging Face API (Demucs v4)...", "procesando", 15);

    hfClient = await Client.connect(spaceId);

    // 2. Estado Procesando
    mostrarEstado("⚡ Procesando audio con la IA (Separando Voces, Batería, Bajo y Otros)... Esto toma entre 30 y 90 segundos según el archivo.", "procesando", 45);

    // Enviar archivo al endpoint predict de Gradio
    const result = await hfClient.predict("/predict", {
      audio: archivoSeleccionado
    }).catch(async (err) => {
      console.warn("Retrying with index or default endpoint call...", err);
      return await hfClient.predict(0, [archivoSeleccionado]);
    });

    // 3. Estado Descargando y convirtiendo resultados a Blobs
    mostrarEstado("⬇️ Descargando y procesando stems generados...", "procesando", 85);

    const tracksBlobs = await extraerStemsDeResultado(result);

    // 4. Guardar en Dexie.js (Offline First)
    await guardarPistasSeparadas(proyectoActualId, tracksBlobs);

    mostrarEstado("✅ ¡Separación completada con éxito y guardada en el dispositivo!", "exito", 100);

    // Cargar en el mezclador multipista
    await cargarProyectoEnMixer(proyectoActualId);
    await cargarListaProyectos();

  } catch (error) {
    console.error("Error durante el procesamiento con Hugging Face:", error);
    mostrarEstado(`❌ Error de procesamiento: ${error.message || "Asegúrate de que la API de Hugging Face esté disponible."}`, "error");
  } finally {
    btnProcesar.disabled = false;
  }
}

/**
 * Parsea la respuesta del Space de Hugging Face y convierte las URLs / archivos en Blobs
 */
async function extraerStemsDeResultado(result) {
  const data = result.data || result;

  let vocalsUrl = null;
  let drumsUrl = null;
  let bassUrl = null;
  let otherUrl = null;

  if (Array.isArray(data)) {
    // Mapeo habitual de 4 outputs: [Vocals, Bass, Drums, Other] o [Vocals, Drums, Bass, Other]
    data.forEach((item, index) => {
      const url = item?.url || item?.name || (typeof item === 'string' ? item : null);
      if (url) {
        const lower = url.toLowerCase();
        if (lower.includes('vocal')) vocalsUrl = url;
        else if (lower.includes('drum')) drumsUrl = url;
        else if (lower.includes('bass')) bassUrl = url;
        else if (lower.includes('other') || lower.includes('no_vocal')) otherUrl = url;
        else {
          // Asignación por orden fallback de akhaliq/demucs (0: Vocals, 1: Bass, 2: Drums, 3: Other)
          if (index === 0 && !vocalsUrl) vocalsUrl = url;
          if (index === 1 && !bassUrl) bassUrl = url;
          if (index === 2 && !drumsUrl) drumsUrl = url;
          if (index === 3 && !otherUrl) otherUrl = url;
        }
      }
    });
  } else if (typeof data === 'object') {
    vocalsUrl = data.vocals?.url || data.vocals;
    drumsUrl = data.drums?.url || data.drums;
    bassUrl = data.bass?.url || data.bass;
    otherUrl = data.other?.url || data.other;
  }

  // Convertir cada URL obtenida a un Blob mediante fetch
  const fetchBlob = async (url) => {
    if (!url) return null;
    try {
      const res = await fetch(url);
      return await res.blob();
    } catch (e) {
      console.error("Error al descargar Blob del stem:", url, e);
      return null;
    }
  };

  const [vocalsBlob, drumsBlob, bassBlob, otherBlob] = await Promise.all([
    fetchBlob(vocalsUrl),
    fetchBlob(drumsBlob),
    fetchBlob(bassBlob),
    fetchBlob(otherUrl)
  ]);

  return {
    vocalsBlob,
    drumsBlob,
    bassBlob,
    otherBlob
  };
}

// ----------------------------------------------------
// Cargar Proyecto en el Mezclador Multipista
// ----------------------------------------------------
async function cargarProyectoEnMixer(proyectoId) {
  mostrarEstado("Cargando pistas en el reproductor multipista...", "info");

  const datos = await cargarPistasDelProyecto(proyectoId);
  if (!datos) {
    mostrarEstado("No se pudieron cargar las pistas del proyecto.", "error");
    return;
  }

  proyectoActualId = proyectoId;
  currentProjectTitle.innerText = datos.proyectoInfo.nombre;

  // Cargar Blobs en el reproductor multipista
  const stemsParaPlayer = {
    vocals: datos.blobs.vocals,
    drums: datos.blobs.drums,
    bass: datos.blobs.bass,
    other: datos.blobs.other
  };

  try {
    const duracion = await player.loadStems(stemsParaPlayer);

    // Configurar botones de descarga directa por pista
    stemsConfig.forEach(stem => {
      const dlBtn = document.getElementById(stem.dlId);
      if (dlBtn && datos.urls[`${stem.key}Url`]) {
        dlBtn.href = datos.urls[`${stem.key}Url`];
        dlBtn.download = `${datos.proyectoInfo.nombre}_${stem.name}.wav`;
        dlBtn.classList.remove('hidden');
      }
    });

    mixerSection.classList.remove('hidden');
    mixerSection.scrollIntoView({ behavior: 'smooth' });

    timeDisplay.innerText = `0:00 / ${formatearTiempo(duracion)}`;
    mostrarEstado(`🎵 Proyecto "${datos.proyectoInfo.nombre}" listo para mezclar.`, "exito");
  } catch (err) {
    console.error("Error al cargar stems en el reproductor:", err);
    mostrarEstado("Error al decodificar los archivos de audio en el reproductor.", "error");
  }
}

// ----------------------------------------------------
// Renderizado de Lista de Proyectos Guardados
// ----------------------------------------------------
async function cargarListaProyectos() {
  const proyectos = await obtenerTodosLosProyectos();
  listaProyectos.innerHTML = "";

  if (!proyectos || proyectos.length === 0) {
    emptyProjectsMessage.classList.remove('hidden');
    return;
  }

  emptyProjectsMessage.classList.add('hidden');

  proyectos.forEach(p => {
    const fecha = new Date(p.fechaCreacion).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const esProcesado = p.estado === 'procesado';
    const badgeBg = esProcesado ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    const badgeText = esProcesado ? 'Procesado' : 'Pendiente';

    const card = document.createElement('div');
    card.className = "bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700";
    card.innerHTML = `
      <div class="flex items-center space-x-3">
        <div class="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zm12 0c0 1.105-1.343 2-3 2s-3-.895-3-2 .895-2 3-2 3 .895 3 2zM9 10l12-2"/>
          </svg>
        </div>
        <div>
          <h4 class="font-semibold text-slate-100">${p.nombre}</h4>
          <div class="flex items-center space-x-2 mt-1">
            <span class="text-xs text-slate-400">${fecha}</span>
            <span class="text-xs text-slate-500">•</span>
            <span class="text-xs text-slate-400">${formatearTiempo(p.duracion)}</span>
            <span class="text-xs px-2 py-0.5 rounded-full border ${badgeBg}">${badgeText}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center space-x-2 self-end md:self-auto">
        ${esProcesado ? `
          <button class="btn-cargar-proyecto px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-sm font-medium rounded-xl border border-cyan-500/30 transition flex items-center space-x-1.5" data-id="${p.id}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Mezclar</span>
          </button>
        ` : ''}
        <button class="btn-eliminar-proyecto px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-sm font-medium rounded-xl border border-rose-500/30 transition flex items-center space-x-1.5" data-id="${p.id}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          <span>Eliminar</span>
        </button>
      </div>
    `;

    listaProyectos.appendChild(card);
  });

  // Listener para botones de la lista
  document.querySelectorAll('.btn-cargar-proyecto').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      cargarProyectoEnMixer(id);
    });
  });

  document.querySelectorAll('.btn-eliminar-proyecto').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.getAttribute('data-id');
      if (confirm("¿Estás seguro de que deseas eliminar este proyecto y sus pistas grabadas?")) {
        if (proyectoActualId === parseInt(id)) {
          player.stop();
          mixerSection.classList.add('hidden');
        }
        await eliminarProyecto(id);
        cargarListaProyectos();
        mostrarEstado("Proyecto eliminado correctamente del dispositivo.", "info");
      }
    });
  });
}

// ----------------------------------------------------
// Utilidades de UI
// ----------------------------------------------------
function mostrarEstado(mensaje, tipo = "info", porcentaje = null) {
  statusBox.classList.remove('hidden');

  if (porcentaje !== null) {
    progressBarContainer.classList.remove('hidden');
    progressBar.style.width = `${porcentaje}%`;
  } else {
    progressBarContainer.classList.add('hidden');
  }

  statusMessage.innerText = mensaje;

  if (tipo === "error") {
    statusIcon.innerHTML = `<span class="text-rose-400 text-xl">❌</span>`;
    statusBox.className = "bg-rose-950/40 border border-rose-500/30 rounded-2xl p-4 transition-all";
  } else if (tipo === "exito") {
    statusIcon.innerHTML = `<span class="text-emerald-400 text-xl">✅</span>`;
    statusBox.className = "bg-emerald-950/40 border border-emerald-500/30 rounded-2xl p-4 transition-all";
  } else if (tipo === "procesando") {
    statusIcon.innerHTML = `<div class="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>`;
    statusBox.className = "bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-4 transition-all";
  } else {
    statusIcon.innerHTML = `<span class="text-cyan-400 text-xl">ℹ️</span>`;
    statusBox.className = "bg-slate-900 border border-slate-800 rounded-2xl p-4 transition-all";
  }
}

function formatearTiempo(segundos) {
  if (!segundos || isNaN(segundos)) return "0:00";
  const mins = Math.floor(segundos / 60);
  const segs = Math.floor(segundos % 60);
  return `${mins}:${segs < 10 ? '0' : ''}${segs}`;
}
