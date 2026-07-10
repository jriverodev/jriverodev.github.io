// app.js
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
import { guardarNuevoProyecto, guardarPistasSeparadas, cargarPistasDelProyecto, db } from './db.js';

// Configurar Transformers.js para que use la caché nativa del navegador (Cache Storage API)
env.allowLocalModels = false;

let separadorPipeline = null;
let proyectoActualId = null;

// Elementos del DOM
const statusDiv = document.getElementById('status');
const fileInput = document.getElementById('file-input');
const btnProcesar = document.getElementById('btn-procesar');
const mixerDiv = document.getElementById('mixer');
const listaProyectosUl = document.getElementById('lista-proyectos');

// Inicializar la Aplicación
window.addEventListener('DOMContentLoaded', async () => {
  actualizarListaProyectos();
  await inicializarIA();
});

// 1. Cargar el modelo de IA desde Hugging Face (Se guarda automáticamente en caché del navegador)
async function inicializarIA() {
  statusDiv.innerText = "Cargando modelo de IA de separación (esto puede tardar en la primera ejecución)...";
  try {
    // Usamos un modelo Demucs optimizado y cuantizado (Xenova/demucs-quantized)
    separadorPipeline = await pipeline('audio-source-separation', 'Xenova/demucs-quantized', {
      device: 'webgpu', // Fuerza el uso de la GPU si está disponible
    });
    statusDiv.innerText = "IA Lista. Sube un archivo .wav para separar la guitarra.";
    fileInput.disabled = false;
  } catch (error) {
    console.warn("WebGPU no disponible, usando WebAssembly (CPU)...", error);
    // Fallback automático si WebGPU falla o no está soportado por el navegador
    separadorPipeline = await pipeline('audio-source-separation', 'Xenova/demucs-quantized', {
      device: 'wasm',
    });
    statusDiv.innerText = "IA Lista (Modo CPU). Sube un archivo .wav.";
    fileInput.disabled = false;
  }
}

// 2. Evento de selección de archivo
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  statusDiv.innerText = "Guardando archivo de audio en base de datos local...";
  
  // Obtener duración aproximada leyendo el archivo temporalmente
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const duracion = audioBuffer.duration;
  audioCtx.close();

  // Guardar en Dexie.js
  proyectoActualId = await guardarNuevoProyecto(file.name, file, duracion);
  
  btnProcesar.disabled = false;
  statusDiv.innerText = `Archivo "${file.name}" cargado localmente de forma segura. Listo para procesar.`;
  actualizarListaProyectos();
});

// 3. Ejecutar el procesamiento de IA local
btnProcesar.addEventListener('click', async () => {
  if (!separadorPipeline || !proyectoActualId) return;

  btnProcesar.disabled = true;
  statusDiv.innerText = "Procesando audio con IA... No cierres la pestaña (puede tomar un par de minutos).";

  try {
    // Obtener el blob original desde IndexedDB
    const pistaData = await db.pistasAudio.get({ proyectoId: proyectoActualId });
    const audioUrl = URL.createObjectURL(pistaData.originalBlob);

    // Ejecutar el pipeline de separación de fuentes
    const resultado = await separadorPipeline(audioUrl);
    
    // El resultado contiene canales en formato Float32Array. Los convertimos a Blobs de tipo Audio/Wav.
    // Nota: El wrapper de Xenova empaqueta directamente los outputs listos en blobs mapeados.
    const tracks = {
      guitar: resultado.guitar,
      drums: resultado.drums,
      bass: resultado.bass,
      other: resultado.other // Voces y otros instrumentos combinados
    };

    // Guardar las pistas resultantes en Dexie.js
    await guardarPistasSeparadas(proyectoActualId, tracks);
    
    statusDiv.innerText = "¡Separación completada con éxito!";
    cargarReproductor(proyectoActualId);
  } catch (error) {
    console.error("Error durante el procesamiento de la IA:", error);
    statusDiv.innerText = "Error al procesar el audio. Asegúrate de usar archivos cortos de prueba primero.";
    btnProcesar.disabled = false;
  }
});

// 4. Cargar los reproductores en el Mixer de la UI
async function cargarReproductor(id) {
  const urls = await cargarPistasDelProyecto(id);
  if (!urls || !urls.guitarraUrl) {
    statusDiv.innerText = "Este proyecto no ha sido procesado por la IA aún.";
    mixerDiv.style.display = 'none';
    return;
  }

  document.getElementById('audio-original').src = urls.originalUrl;
  document.getElementById('audio-guitarra').src = urls.guitarraUrl;
  document.getElementById('audio-resto').src = urls.otrosUrl; // Mapea el resto de la banda
  
  mixerDiv.style.display = 'block';
}

// 5. Renderizar los proyectos existentes en IndexedDB
async function actualizarListaProyectos() {
  const proyectos = await db.proyectos.toArray();
  listaProyectosUl.innerHTML = "";
  
  proyectos.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${p.nombre}</strong> (${Math.round(p.duracion)} segs)
      <button class="btn-cargar" data-id="${p.id}">Escuchar</button>
    `;
    listaProyectosUl.appendChild(li);
  });

  // Delegación de eventos para botones de la lista
  document.querySelectorAll('.btn-cargar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      proyectoActualId = parseInt(e.target.getAttribute('data-id'));
      cargarReproductor(proyectoActualId);
    });
  });
}
