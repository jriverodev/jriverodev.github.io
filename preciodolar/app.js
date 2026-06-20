const priceEl = document.getElementById('price-value');
const dateEl = document.getElementById('update-date');
const loadingEl = document.getElementById('loading');
const refreshBtn = document.getElementById('refresh-btn');
const offlineMsg = document.getElementById('offline-message');
const inputUsd = document.getElementById('input-usd');
const inputBs = document.getElementById('input-bs');

// URL oficial del BCV y el proxy CORS que entrega el HTML como texto plano
const BCV_URL = 'https://www.bcv.org.ve/';
const PROXY_URL = 'https://corsproxy.io/?' + encodeURIComponent(BCV_URL);

// Variable global para guardar la tasa numérica limpia para la calculadora
let tasaNumerica = 0;

// ==========================================
// 1. REGISTRO DEL SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('¡Service Worker registrado con éxito!', reg.scope))
      .catch(err => console.error('Error al registrar el Service Worker:', err));
  });
}

// ==========================================
// 2. LÓGICA DE SCRAPING Y RESPALDO LOCAL
// ==========================================
async function scrapingBCV() {
  // Mostrar estado de carga en la interfaz
  priceEl.classList.add('hidden');
  loadingEl.style.display = 'block';
  
  try {
    const response = await fetch(PROXY_URL);
    if (!response.ok) throw new Error('Error al conectar con el servidor proxy');
    
    // Leemos la respuesta como TEXTO (HTML puro)
    const htmlContenido = await response.text(); 

    // Creamos un DOM virtual para analizar el HTML del BCV
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContenido, 'text/html');

    // --- SCRAPING ---
    const dolarContainer = doc.querySelector('#dolar');
    if (!dolarContainer) throw new Error('No se encontró la estructura del dólar en el HTML');

    // Extraemos el texto del precio (etiqueta 'strong')
    const precioRaw = dolarContainer.querySelector('strong').textContent.trim();
    
    // Extraemos la fecha valor
    const fechaContainer = doc.querySelector('.date-display-single');
    const fecha = fechaContainer ? fechaContainer.textContent.trim() : new Date().toLocaleDateString();

    // Actualizamos la interfaz
    updateUI(precioRaw, fecha);

    // Guardamos en LocalStorage para soporte Offline
    localStorage.setItem('last_price', precioRaw);
    localStorage.setItem('last_date', fecha);
    
    offlineMsg.classList.add('hidden');

  } catch (error) {
    console.error('Error haciendo scraping al BCV:', error);
    // Si la red falla, recurre inmediatamente al respaldo local
    loadLocalData();
  } finally {
    loadingEl.style.display = 'none';
    priceEl.classList.remove('hidden');
  }
}

// Función para pintar los datos en pantalla
function updateUI(price, date) {
  priceEl.textContent = price;
  dateEl.textContent = date;
  
  // Limpiamos la string del BCV (cambiamos coma por punto) y la convertimos a número
  tasaNumerica = parseFloat(price.replace(',', '.'));
  
  // Si el usuario ya tenía montos en la calculadora, se recalculan con la nueva tasa
  if (inputUsd.value) calcularDeUsdaBs();
}

// Función para cargar los últimos datos guardados
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

// ==========================================
// 3. LÓGICA DE LA CALCULADORA
// ==========================================

// Convierte de USD a Bolívares
function calcularDeUsdaBs() {
  if (!tasaNumerica || inputUsd.value === '') {
    inputBs.value = '';
    return;
  }
  const usd = parseFloat(inputUsd.value);
  inputBs.value = (usd * tasaNumerica).toFixed(2);
}

// Convierte de Bolívares a USD
function calcularDeBsaUsd() {
  if (!tasaNumerica || inputBs.value === '') {
    inputUsd.value = '';
    return;
  }
  const bs = parseFloat(inputBs.value);
  inputUsd.value = (bs / tasaNumerica).toFixed(2);
}

// ==========================================
// 4. CONTROLADORES DE EVENTOS (LISTENERS)
// ==========================================
refreshBtn.addEventListener('click', scrapingBCV);

// Escuchas en tiempo real para los inputs de la calculadora
inputUsd.addEventListener('input', calcularDeUsdaBs);
inputBs.addEventListener('input', calcularDeBsaUsd);

// Estado de la conexión a internet
window.addEventListener('online', () => offlineMsg.classList.add('hidden'));
window.addEventListener('offline', () => offlineMsg.classList.remove('hidden'));

// Ejecución inicial automática al abrir la aplicación
if (navigator.onLine) {
  scrapingBCV();
} else {
  loadLocalData();
}
