import Dexie from 'dexie';

// Inicializar la base de datos de la PWA
export const db = new Dexie('AudioSeparatorDB');

/**
 * Esquema de versiones.
 * NOTA: En Dexie solo se indexan los campos por los que vas a buscar (Primary keys e Índices).
 * Los blobs de audio se guardan dentro del objeto pero no necesitan indexarse.
 */
db.version(1).stores({
  proyectos: '++id, nombre, fechaCreacion, duracion',
  pistasAudio: 'proyectoId' // Relación 1:1 o 1:N con el proyecto
});

// Tipado/Estructura lógica de los datos que guardaremos:
/*
  proyectos: {
    id: 1,
    nombre: "Solo de Telecaster - Práctica",
    fechaCreacion: 1774324200000, // Timestamp
    duracion: 184.5 // en segundos
  }

  pistasAudio: {
    proyectoId: 1, // Llave primaria vinculada al proyecto
    originalBlob: Blob,   // Archivo .wav completo subido por el usuario
    guitarraBlob: Blob,   // Pista aislada de guitarra
    bateriaBlob: Blob,    // Pista aislada de batería (opcional)
    bajoBlob: Blob,       // Pista aislada de bajo (opcional)
    otrosBlob: Blob       // Voces/Teclados/Resto (opcional)
  }
*/
