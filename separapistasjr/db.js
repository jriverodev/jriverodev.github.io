/**
 * db.js
 * Capa de almacenamiento local Offline-First utilizando Dexie.js (IndexedDB).
 * Permite guardar proyectos de audio, sus archivos originales y los 4 stems separados.
 */

import Dexie from 'https://unpkg.com/dexie@latest/dist/dexie.js';

export const db = new Dexie('AudioSeparatorDB');

// Definir versión y esquema de IndexedDB
db.version(2).stores({
  proyectos: '++id, nombre, fechaCreacion, duracion, estado',
  pistasAudio: 'proyectoId'
});

/**
 * Registra un nuevo proyecto con su audio original.
 * @param {string} nombreArchivo - Nombre original del archivo subido.
 * @param {Blob} archivoBlob - Blob del audio original.
 * @param {number} duracionSegundos - Duración estimada en segundos.
 * @returns {Promise<number>} ID del proyecto creado.
 */
export async function guardarNuevoProyecto(nombreArchivo, archivoBlob, duracionSegundos = 0) {
  try {
    const nombreLimpio = nombreArchivo.replace(/\.[^/.]+$/, "");

    const proyectoId = await db.proyectos.add({
      nombre: nombreLimpio,
      fechaCreacion: Date.now(),
      duracion: duracionSegundos,
      estado: 'pendiente'
    });

    await db.pistasAudio.put({
      proyectoId: proyectoId,
      originalBlob: archivoBlob,
      vocalsBlob: null,
      drumsBlob: null,
      bassBlob: null,
      otherBlob: null
    });

    return proyectoId;
  } catch (error) {
    console.error("Error al guardar el nuevo proyecto en IndexedDB:", error);
    throw error;
  }
}

/**
 * Guarda o actualiza los 4 stems separados devueltos por Demucs v4.
 * @param {number} proyectoId
 * @param {Object} tracks - Objeto con { vocalsBlob, drumsBlob, bassBlob, otherBlob }
 */
export async function guardarPistasSeparadas(proyectoId, tracks) {
  try {
    const id = parseInt(proyectoId);

    // Obtener registro existente
    const registroPrevio = await db.pistasAudio.get({ proyectoId: id });

    await db.pistasAudio.put({
      proyectoId: id,
      originalBlob: registroPrevio ? registroPrevio.originalBlob : null,
      vocalsBlob: tracks.vocalsBlob || tracks.vocals || null,
      drumsBlob: tracks.drumsBlob || tracks.drums || null,
      bassBlob: tracks.bassBlob || tracks.bass || null,
      otherBlob: tracks.otherBlob || tracks.other || null
    });

    // Actualizar estado del proyecto
    await db.proyectos.update(id, {
      estado: 'procesado'
    });

    console.log(`Pistas guardadas con éxito para el proyecto #${id}`);
  } catch (error) {
    console.error("Error al guardar las pistas en IndexedDB:", error);
    throw error;
  }
}

/**
 * Obtiene la lista ordenada de todos los proyectos guardados.
 * @returns {Promise<Array>}
 */
export async function obtenerTodosLosProyectos() {
  try {
    return await db.proyectos.orderBy('fechaCreacion').reverse().toArray();
  } catch (error) {
    console.error("Error al listar proyectos de IndexedDB:", error);
    return [];
  }
}

/**
 * Recupera un proyecto y sus Blobs de audio.
 * @param {number} proyectoId
 * @returns {Promise<Object|null>}
 */
export async function obtenerProyectoCompleto(proyectoId) {
  try {
    const id = parseInt(proyectoId);
    const proyecto = await db.proyectos.get(id);
    if (!proyecto) return null;

    const pistas = await db.pistasAudio.get({ proyectoId: id });

    return {
      ...proyecto,
      pistas: pistas || {}
    };
  } catch (error) {
    console.error(`Error al obtener proyecto #${proyectoId}:`, error);
    return null;
  }
}

/**
 * Genera URLs de objeto temporales (URL.createObjectURL) para reproducir los Blobs.
 * @param {number} proyectoId
 */
export async function cargarPistasDelProyecto(proyectoId) {
  const proyecto = await obtenerProyectoCompleto(proyectoId);
  if (!proyecto || !proyecto.pistas) return null;

  const { originalBlob, vocalsBlob, drumsBlob, bassBlob, otherBlob } = proyecto.pistas;

  return {
    proyectoInfo: {
      id: proyecto.id,
      nombre: proyecto.nombre,
      duracion: proyecto.duracion,
      estado: proyecto.estado
    },
    blobs: {
      original: originalBlob,
      vocals: vocalsBlob,
      drums: drumsBlob,
      bass: bassBlob,
      other: otherBlob
    },
    urls: {
      originalUrl: originalBlob ? URL.createObjectURL(originalBlob) : null,
      vocalsUrl: vocalsBlob ? URL.createObjectURL(vocalsBlob) : null,
      drumsUrl: drumsBlob ? URL.createObjectURL(drumsBlob) : null,
      bassUrl: bassBlob ? URL.createObjectURL(bassBlob) : null,
      otherUrl: otherBlob ? URL.createObjectURL(otherBlob) : null
    }
  };
}

/**
 * Elimina un proyecto y sus datos de audio almacenados.
 * @param {number} proyectoId
 */
export async function eliminarProyecto(proyectoId) {
  try {
    const id = parseInt(proyectoId);
    await db.pistasAudio.where({ proyectoId: id }).delete();
    await db.proyectos.delete(id);
    console.log(`Proyecto #${id} eliminado correctamente.`);
  } catch (error) {
    console.error(`Error al eliminar proyecto #${proyectoId}:`, error);
    throw error;
  }
}
