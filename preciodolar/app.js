const priceEl = document.getElementById('price-value');
const dateEl = document.getElementById('update-date');
const loadingEl = document.getElementById('loading');
const refreshBtn = document.getElementById('refresh-btn');
const offlineMsg = document.getElementById('offline-message');
const inputUsd = document.getElementById('input-usd');
const inputBs = document.getElementById('input-bs');
const swapBtn = document.getElementById('swap-btn');

// Endpoints para obtener la tasa oficial del BCV
const DOLAR_API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
const BCV_URL = 'https://www.bcv.org.ve/';
const PROXY_SCRAPE_URL = 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(BCV_URL);

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

// Formateador de fecha amigable para la interfaz
function formatearFecha(fechaStr) {
  if (!fechaStr) return new Date().toLocaleDateString('es-VE');
  const d = new Date(fechaStr);
  if (isNaN(d.getTime())) return fechaStr;
  return d.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ==========================================
// 2. LÓGICA DE OBTENCIÓN DE TASA Y RESPALDO LOCAL
// ==========================================
async function obtenerTasaBCV() {
  // Mostrar estado de carga en la interfaz
  priceEl.classList.add('hidden');
  loadingEl.style.display = 'block';
  
  try {
    let precioRaw = null;
    let fecha = null;

    // Intentar vía API de DolarAPI (Tasa oficial BCV)
    try {
      const res = await fetch(DOLAR_API_URL);
      if (res.ok) {
        const data = await res.json();
        if (data && data.promedio) {
          // Formatear el promedio de DolarAPI con coma decimal (ej. 820,1018)
          const numPromedio = Number(data.promedio);
          precioRaw = numPromedio.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
          if (data.fechaActualizacion) {
            fecha = formatearFecha(data.fechaActualizacion);
          }
        }
      }
    } catch (eApi) {
      console.warn('Falló el primer intento con DolarAPI:', eApi);
    }

    // Si falló DolarAPI, intentar scraping de respaldo de www.bcv.org.ve
    if (!precioRaw) {
      const response = await fetch(PROXY_SCRAPE_URL);
      if (!response.ok) throw new Error('Error al conectar con el servidor proxy de respaldo');

      const htmlContenido = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContenido, 'text/html');

      const dolarContainer = doc.querySelector('#dolar');
      if (!dolarContainer) throw new Error('No se encontró la estructura del dólar en el HTML');

      precioRaw = dolarContainer.querySelector('strong').textContent.trim();

      const fechaContainer = doc.querySelector('.date-display-single');
      fecha = fechaContainer ? fechaContainer.textContent.trim() : new Date().toLocaleDateString('es-VE');
    }

    if (!precioRaw) {
      throw new Error('No se pudo obtener el precio de la tasa oficial');
    }

    if (!fecha) {
      fecha = new Date().toLocaleDateString('es-VE');
    }

    // Actualizamos la interfaz
    updateUI(precioRaw, fecha);

    // Guardamos en LocalStorage para soporte Offline
    localStorage.setItem('last_price', precioRaw);
    localStorage.setItem('last_date', fecha);
    
    offlineMsg.classList.add('hidden');

  } catch (error) {
    console.error('Error obteniendo tasa del BCV:', error);
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
  
  // Limpiamos la string del BCV (eliminamos separadores de miles y cambiamos coma por punto decimal)
  tasaNumerica = parseFloat(price.replace(/\./g, '').replace(',', '.'));
  
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
refreshBtn.addEventListener('click', obtenerTasaBCV);

if (swapBtn) {
  swapBtn.addEventListener('click', () => {
    const valUsd = inputUsd.value;
    const valBs = inputBs.value;
    inputUsd.value = valBs;
    calcularDeUsdaBs();
  });
}

// Escuchas en tiempo real para los inputs de la calculadora
inputUsd.addEventListener('input', calcularDeUsdaBs);
inputBs.addEventListener('input', calcularDeBsaUsd);

// Estado de la conexión a internet
window.addEventListener('online', () => offlineMsg.classList.add('hidden'));
window.addEventListener('offline', () => offlineMsg.classList.remove('hidden'));

// Ejecución inicial automática al abrir la aplicación
if (navigator.onLine) {
  obtenerTasaBCV();
} else {
  loadLocalData();
}
