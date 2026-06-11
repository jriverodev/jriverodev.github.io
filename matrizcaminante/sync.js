import { db } from './db.js';

const API_URL = "https://script.google.com/macros/s/AKfycbxXL4a7KST8YF5KqCxM7ETMDFZQ9ICWT6fptWTP-MjZgcGwaFXfKvz5qyA8xVdOLyU2/exec";

export async function sincronizarDatos() {
  try {
    // 1. Intentar hacer el fetch al Apps Script
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) throw new Error("Error al conectar con el servidor de Google");
    
    const datosCaminantes = await respuesta.json();
    
    // 2. Limpiar la base de datos local vieja e insertar lo nuevo en una transacción atómica
    await db.transaction('rw', db.caminantes, async () => {
      await db.caminantes.clear();
      await db.caminantes.bulkAdd(datosCaminantes);
    });
    
    console.log(`Sincronización exitosa: ${datosCaminantes.length} caminantes guardados localmente.`);
    return { exito: true, conteo: datosCaminantes.length };
    
  } catch (error) {
    console.error("Fallo la sincronización, usando datos locales previos:", error);
    return { exito: false, error: error.message };
  }
}
