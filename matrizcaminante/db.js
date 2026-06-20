// db.js - Importación de Dexie compatible con navegadores y GitHub Pages
import Dexie from 'https://unpkg.com/dexie@latest/dist/dexie.mjs';

// Inicializar la base de datos de Emaús
export const db = new Dexie('EmausDatabase');

// Definir el esquema con los índices de búsqueda rápida
db.version(1).stores({
  caminantes: 'id_planilla, nombre_completo, cocina.tipo_dieta, cocina.requiere_atencion, salud.bajo_tratamiento'
});
