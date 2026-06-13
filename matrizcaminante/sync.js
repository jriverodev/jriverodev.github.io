import { db } from './db.js';

// URL real de tu Web App de Google Apps Script (Nueva Implementación del Retiro)
const URL_GOOGLE_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbwM11o5OLwHkJ9ib-cTMEojQkjfoGVVqO6whl0NvOvzzyqp8BY2r27gTAHT3TPRQF00/exec";

/**
 * 1. DESCARGA / CENTRALIZACIÓN DE DATOS (Desde la Nube hacia el Teléfono)
 * Se ejecuta al presionar "Descargar Datos del Sheets".
 * Descarga el JSON generado por el doGet del script de Google y lo indexa en IndexedDB.
 */
export async function sincronizarDatos() {
  try {
    // Evitamos que el navegador devuelva data vieja del caché agregando un timestamp dinámico (_t)
    const respuesta = await fetch(`${URL_GOOGLE_APPS_SCRIPT}?action=obtener_matriz&_t=${Date.now()}`);
    
    if (!respuesta.ok) {
      throw new Error("La red no respondió correctamente.");
    }
    
    const data = await respuesta.json();
    
    // Validamos que la estructura contenga el arreglo de caminantes parseado por el script
    if (data && Array.isArray(data.caminantes)) {
      // Limpieza preventiva de Dexie para evitar colisiones de ID o duplicaciones
      await db.caminantes.clear();
      
      // Inserción masiva ultra veloz en la base de datos local del teléfono
      await db.caminantes.bulkAdd(data.caminantes);
      
      return { exito: true, conteo: data.caminantes.length };
    }
    
    return { exito: false, conteo: 0 };
  } catch (error) {
    console.error("Error crítico durante la sincronización remota (Lectura):", error);
    return { exito: false, conteo: 0 };
  }
}

/**
 * 2. TRANSMISIÓN DE DATOS CENTRAL (Desde el Teléfono hacia la Nube)
 * Se ejecuta automáticamente después de arrastrar y procesar el archivo CSV en la PWA.
 * Transmite el objeto mapeado para que el doPost limpie la hoja y escriba la nueva matriz.
 */
export async function subirAlSheetsCentral(caminantesProcesados) {
  try {
    // Guardail de seguridad offline para evitar llamadas fallidas innecesarias
    if (!navigator.onLine) {
      console.warn("Dispositivo fuera de línea. La transmisión al Sheets se ha pospuesto.");
      return false;
    }

    // Usamos text/plain en el Content-Type para enviar un JSON plano "simple".
    // Esto evita que el navegador ejecute la verificación OPTIONS (Preflight) que causa el error de CORS.
    // El método doPost de Google Apps Script leerá el JSON con JSON.parse(e.postData.contents) perfectamente.
    const respuesta = await fetch(URL_GOOGLE_APPS_SCRIPT, {
      method: "POST",
      mode: "cors", 
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        accion: "guardar_matriz",
        caminantes: caminantesProcesados
      })
    });

    if (!respuesta.ok) {
      throw new Error("El Google Apps Script central rechazó o falló al procesar el paquete.");
    }
    
    const resultadoEnvio = await respuesta.json();
    return resultadoEnvio.exito === true;

  } catch (error) {
    console.error("Error crítico en la transmisión hacia Google Sheets (Escritura):", error);
    return false; // Retornar falso dispara la alerta visual preventiva de "Guardado Localmente ⚠️" en app.js
  }
}
