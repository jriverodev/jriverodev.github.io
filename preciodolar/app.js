const priceEl = document.getElementById('price-value');
const dateEl = document.getElementById('update-date');
const loadingEl = document.getElementById('loading');
const refreshBtn = document.getElementById('refresh-btn');
const offlineMsg = document.getElementById('offline-message');

// URL del BCV y el Proxy CORS gratuito para poder leerla desde el navegador
const BCV_URL = 'https://www.bcv.org.ve/';
const PROXY_URL = 'https://api.allorigins.win/get?url=' + encodeURIComponent(BCV_URL);

// 1. Registro del Service Worker para soporte PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito', reg.scope))
      .catch(err => console.error('Error al registrar el Service Worker', err));
  });
}

// 2. Función de Scraping directo en el Frontend
async function scrapingBCV() {
  // Mostrar estado de carga
  priceEl.classList.add('hidden');
  loadingEl.style.display = 'block';
  
  try {
    // Consultamos al proxy para evadir el bloqueo de CORS del navegador
    const response = await fetch(PROXY_URL);
    if (!response.ok) throw new Error('Error al conectar con el servidor proxy');
    
    const wrapper = await response.json();
    const htmlContenido = wrapper.contents; // Aquí está el HTML completo del BCV

    // Creamos un clon virtual del HTML para poder leerlo con selectores de JavaScript
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContenido, 'text/html');

    // --- AQUÍ OCURRE EL SCRAPING ---
    // Buscamos el contenedor específico del dólar en el diseño del BCV
    const dolarContainer = doc.querySelector('#dolar');
    
    if (!dolarContainer) throw new Error('No se encontró la estructura del dólar en el HTML');

    // Extraemos el precio (normalmente dentro de una etiqueta 'strong')
    const precioRaw = dolarContainer.querySelector('strong').textContent.trim();
    
    // Extraemos la fecha valor que publica el BCV
    const fechaContainer = doc.querySelector('.date-display-single');
    const fecha = fechaContainer ? fechaContainer.textContent.trim() : new Date().toLocaleDateString();

    // Guardamos los datos limpios en la interfaz y en almacenamiento local (Offline)
    updateUI(precioRaw, fecha);
    localStorage.setItem('last_price', precioRaw);
    localStorage.setItem('last_date', fecha);
    
    offlineMsg.classList.add('hidden');

  } catch (error) {
    console.error('Error haciendo scraping al BCV:', error);
    // Si falla el scraping o la red, cargamos el último dato guardado
    loadLocalData();
  } finally {
    loadingEl.style.display = 'none';
    priceEl.classList.remove('hidden');
  }
}

function updateUI(price, date) {
  priceEl.textContent = price;
  dateEl.textContent = date;
}

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

// 3. Eventos
refreshBtn.addEventListener('click', scrapingBCV);

// Carga inicial al abrir la app
if (navigator.onLine) {
  scrapingBCV();
} else {
  loadLocalData();
}
