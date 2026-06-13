export async function subirAlSheetsCentral(caminantesProcesados) {
  try {
    if (!navigator.onLine) {
      console.warn("Dispositivo sin conexión a internet. Envío pospuesto.");
      return false;
    }

    const URL_GOOGLE_APPS_SCRIPT = "https://script.google.com/macros/s/AKfycbw5uTgfk2SLfBkQltbpEl8kVrbRUE2N1XNU_jn2XhvOp5MzDQUVNRfdyXPIwcO7a1ao/exec";

    // Enviamos como texto plano (text/plain) para evitar el chequeo estricto de CORS Preflight.
    // Google Apps Script procesará el JSON interno de igual manera a través de e.postData.contents.
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

    if (!respuesta.ok) throw new Error("Error en respuesta de red.");
    
    const resultadoEnvio = await respuesta.json();
    return resultadoEnvio.exito === true;

  } catch (error) {
    console.error("Error en la transmisión hacia Google Sheets:", error);
    return false; 
  }
}
