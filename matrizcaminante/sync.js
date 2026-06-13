import { db } from './db.js';

// Reemplaza esto con el ID real de tu Web App de Google Apps Script asignada al retiro
const URL_GOOGLE_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbxXL4a7KST8YF5KqCxM7ETMDFZQ9ICWT6fptWTP-MjZgcGwaFXfKvz5qyA8xVdOLyU2/exec";

/**
 * 1. DESCARGA / CENTRALIZACIÓN DE DATOS (Nube -> Local)
 * Se ejecuta al presionar "Descargar Datos del Sheets"
 */
export async function sincronizarDatos() {
  try {
    // Evitamos problemas de caché agregando un timestamp a la petición
    const respuesta = await fetch(`${URL_GOOGLE_APPS_SCRIPT}?action=obtener_matriz&_t=${Date.now()}`);
    
    if (!respuesta.ok) throw new Error("Fallo en la red");
    
    const data = await respuesta.json();
    
    if (data && Array.isArray(data.caminantes)) {
      // Limpiamos los registros almacenados previamente para evitar duplicados
      await db.caminantes.clear();
      // Guardado masivo y veloz con bulkAdd nativo de IndexedDB
      await db.caminantes.bulkAdd(data.caminantes);
      
      return { exito: true, conteo: data.caminantes.length };
    }
    
    return { exito: false, conteo: 0 };
  } catch (error) {
    console.error("Error durante la sincronización remota:", error);
    return { exito: false, conteo: 0 };
  }
}

/**
 * 2. TRANSMISIÓN DE DATOS (Local -> Nube)
 * Se ejecuta de fondo inmediatamente tras procesar el archivo CSV real
 */
export async function subirAlSheetsCentral(caminantesProcesados) {
  try {
    if (!navigator.onLine) {
      console.warn("Dispositivo sin conexión a internet. Envío pospuesto.");
      return false;
    }

    const respuesta = await fetch(URL_GOOGLE_APPS_SCRIPT, {
      method: "POST",
      mode: "cors", // Cambia a "no-cors" únicamente si tu Apps Script no maneja respuestas CORS complejas
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accion: "guardar_matriz",
        caminantes: caminantesProcesados
      })
    });

    if (!respuesta.ok) throw new Error("El servidor central rechazó la transmisión.");
    
    const resultadoEnvio = await respuesta.json();
    return resultadoEnvio.exito === true;

  } catch (error) {
    console.error("Error en la transmisión hacia Google Sheets:", error);
    return false; // Al retornar falso, app.js dispara la advertencia de guardado local preventivo
  }
}
