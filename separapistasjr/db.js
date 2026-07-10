// db.js
import Dexie from 'https://unpkg.com/dexie@latest/dist/dexie.js';

// Inicializar la base de datos
export const db = new Dexie('AudioSeparatorDB');

// Definir el esquema (solo se indexan los campos de búsqueda rápidos)
db.version(1).stores({
  proyectos: '++id, nombre, fechaCreacion, duracion',
  pistasAudio: 'proyectoId' 
});

/**
 * Guarda un archivo de audio original subido por el usuario.
 */
export async function guardarNuevoProyecto(nombreArchivo, archivoBlob, duracionSegundos) {
  try {
    const proyectoId = await db.proyectos.add({
      nombre: nombreArchivo.replace(/\.[^/.]+$/, ""), // Remueve extensión .wav
      fechaCreacion: Date.now(),
      duracion: duracionSegundos
    });

    await db.pistasAudio.add({
      proyectoId: proyectoId,
      originalBlob: archivoBlob,
      guitarraBlob: null,
      bateriaBlob: null,
      bajoBlob: null,
      otrosBlob: null
    });

    return proyectoId;
  } catch (error) {
    console.error("Error al guardar el archivo original:", error);
    throw error;
  }
}

/**
 * Actualiza el proyecto con los resultados devueltos por la IA.
 */
export async function guardarPistasSeparadas(proyectoId, tracks) {
  try {
    await db.pistasAudio.update(proyectoId, {
      guitarraBlob: tracks.guitar,
      bateriaBlob: tracks.drums,
      bajoBlob: tracks.bass,
      otrosBlob: tracks.other
    });
    console.log("Pistas guardadas en IndexedDB exitosamente.");
  } catch (error) {
    console.error("Error al actualizar las pistas:", error);
    throw error;
  }
}

/**
 * Obtiene los metadatos y crea URLs locales reproducibles de los Blobs.
 */
export async function cargarPistasDelProyecto(proyectoId) {
  const pistas = await db.pistasAudio.get({ proyectoId: parseInt(proyectoId) });
  if (!pistas) return null;

  return {
    originalUrl: pistas.originalBlob ? URL.createObjectURL(pistas.originalBlob) : null,
    guitarraUrl: pistas.guitarraBlob ? URL.createObjectURL(pistas.guitarraBlob) : null,
    bateriaUrl: pistas.bateriaBlob ? URL.createObjectURL(pistas.bateriaBlob) : null,
    bajoUrl: pistas.bajoBlob ? URL.createObjectURL(pistas.bajoBlob) : null,
    otrosUrl: pistas.otrosBlob ? URL.createObjectURL(pistas.otrosBlob) : null
  };
}

/**
 * Elimina por completo un proyecto y sus audios para liberar espacio.
 */
export async function eliminarProyecto(proyectoId) {
  const id = parseInt(proyectoId);
  await db.proyectos.delete(id);
  await db.pistasAudio.delete(id);
}
