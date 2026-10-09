// Asegurar que la aplicación corre dentro de Capacitor antes de activar el listener
if (window.Capacitor && Capacitor.Plugins) {
  const { App, Toast } = Capacitor.Plugins;

  let tiempoUltimoClick = 0;

  App.addListener('backButton', async ({ canGoBack }) => {
    // Detectar de forma precisa si el usuario está parado en la raíz/inicio
    const rutaActual = window.location.pathname;
    const esPaginaPrincipal = rutaActual.endsWith('index.html') || 
                             rutaActual.endsWith('/') || 
                             rutaActual === '';

    // Si está en un submódulo (ej: panel.html, patio.html, form-flota.html) regrésalo al index
    if (!esPaginaPrincipal) {
      // Si el historial nativo de la WebView tiene páginas previas, va atrás
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        // Fallback de seguridad: si se rompe el historial, lo fuerza a ir al index.html
        window.location.href = 'index.html';
      }
    } else {
      // ---- COMPORTAMIENTO EN LA RAÍZ (index.html) ----
      const tiempoActual = new Date().getTime();
      
      // Si presiona el botón por segunda vez en menos de 2 segundos (2000 ms) cierra la app
      if (tiempoActual - tiempoUltimoClick < 2000) {
        App.exitApp();
      } else {
        // Primer click: guarda la hora actual y lanza el Toast nativo estilo Android
        tiempoUltimoClick = tiempoActual;
        
        // Verifica si el plugin de Toast está disponible en el entorno nativo
        if (Toast) {
          await Toast.show({
            text: 'Presione atrás otra vez para salir',
            duration: 'short',
            position: 'bottom'
          });
        } else {
          // Fallback por si ejecutas pruebas web sin el plugin nativo cargado
          console.log('Presione atrás otra vez para salir');
        }
      }
    }
  });
}
