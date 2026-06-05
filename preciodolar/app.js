const priceEl = document.getElementById('price-value');
const dateEl = document.getElementById('update-date');
const loadingEl = document.getElementById('loading');
const refreshBtn = document.getElementById('refresh-btn');
const offlineMsg = document.getElementById('offline-message');

// URL oficial del BCV y el proxy CORS que entrega el HTML como texto plano
const BCV_URL = 'https://www.bcv.org.ve/';
const PROXY_URL = 'https://corsproxy.io/?' + encodeURIComponent(BCV_URL);

// 1. Registro del Service Worker para soporte PWA (Modo Offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('¡Service Worker registrado con éxito!', reg.scope))
      .catch(err => console.error('Error al registrar el Service Worker:', err));
  });
}

// 2. Función de Scraping directo en el Frontend
async function scrapingBCV() {
  // Mostrar estado de carga en la interfaz
  priceEl.classList.add('hidden');
  loadingEl.style.display = 'block';
  
  try {
    // Consultamos al proxy para evadir el bloqueo de CORS del navegador
    const response = await fetch(PROXY_URL);
    if (!response.ok) throw new Error('Error al conectar con el servidor proxy');
    
    // Leemos la respuesta como TEXTO (HTML puro), evitando el error de JSON
    const htmlContenido = await response.text(); 

    // Creamos un DOM virtual para poder analizar el HTML del BCV usando selectores comunes
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContenido, 'text/html');

    // --- AQUÍ OCURRE EL SCRAPING ---
    // Buscamos el contenedor específico del dólar en el HTML del BCV (#dolar)
    const dolarContainer = doc.querySelector('#dolar');
    
    if (!dolarContainer) throw new Error('No se encontró la estructura del dólar en el HTML');

    // Extraemos el texto del precio (generalmente dentro de la etiqueta 'strong')
    const precioRaw = dolarContainer.querySelector('strong').textContent.trim();
    
    // Extraemos la fecha valor del BCV si está disponible, sino usamos la del dispositivo
    const fechaContainer = doc.querySelector('.date-display-single');
    const fecha = fechaContainer ? fechaContainer.textContent.trim() : new Date().toLocaleDateString();

    // Actualizamos la interfaz con los datos reales recopilados
    updateUI(precioRaw, fecha);

    // Guardamos las strings en LocalStorage para soporte Offline instantáneo
    localStorage.setItem('last_price', precioRaw);
    localStorage.setItem('last_date', fecha);
    
    offlineMsg.classList.add('hidden');

  } catch (error) {
    console.error('Error haciendo scraping al BCV:', error);
    // Si la red falla o el proxy cae, se recurre inmediatamente al respaldo local
    loadLocalData();
  } finally {
    // Ocultar estado de carga
    loadingEl.style.display = 'none';
    priceEl.classList.remove('hidden');
  }
}

// Función auxiliar para pintar los datos en pantalla
function updateUI(price, date) {
  priceEl.textContent = price;
  dateEl.textContent = date;
}

// Función para cargar los últimos datos guardados en caso de estar offline o error
function loadLocalData() {
  const localPrice = localStorage.getItem('last_price');
  const localDate = localStorage.getItem('last_date');
  
  if (localPrice && localDate) {
    updateUI(localPrice, localDate);
    if (!navigator.onLine) {
      offlineMsg.classList.remove('hidden');
    }
  } else {
    priceEl.textContent = "--,--";
    dateEl.textContent = "No disponible";
  }
}

// 3. Controladores de Eventos (Listeners)
refreshBtn.addEventListener('click', scrapingBCV);

// Escuchar si el dispositivo pierde o recupera conexión a internet
window.addEventListener('online', () => offlineMsg.classList.add('hidden'));
window.addEventListener('offline', () => offlineMsg.classList.remove('hidden'));

// Ejecución inicial automática al abrir o recargar la aplicación
if (navigator.onLine) {
  scrapingBCV();
} else {
  loadLocalData();
}
