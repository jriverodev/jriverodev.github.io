const priceEl = document.getElementById('price-value');
const dateEl = document.getElementById('update-date');
const loadingEl = document.getElementById('loading');
const refreshBtn = document.getElementById('refresh-btn');
const offlineMsg = document.getElementById('offline-message');

// API libre y estable para consultar tasas de Venezuela
const API_URL = 'https://pydolarve.org/api/v1/dollar?page=bcv';

// 1. Registro del Service Worker para soporte PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado con éxito', reg.scope))
      .catch(err => console.error('Error al registrar el Service Worker', err));
  });
}

// 2. Función para obtener los datos
async function fetchTasaBCV() {
  // Mostrar estado de carga
  priceEl.classList.add('hidden');
  loadingEl.style.display = 'block';
  
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error('Error en la respuesta de la red');
    
    const data = await response.json();
    
    // Extraemos el valor del dólar oficial
    const dolarData = data.monitors.usd;
    const precio = dolarData.price;
    const fecha = data.datetime.date;

    // Actualizar interfaz
    updateUI(precio, fecha);
    
    // Guardar en LocalStorage para soporte Offline instantáneo
    localStorage.setItem('last_price', precio);
    localStorage.setItem('last_date', fecha);
    
    offlineMsg.classList.add('hidden');
  } catch (error) {
    console.log('No se pudo refrescar en vivo, usando respaldo local:', error);
    loadLocalData();
  } finally {
    loadingEl.style.display = 'none';
    priceEl.classList.remove('hidden');
  }
}

function updateUI(price, date) {
  // Formateamos para asegurar que muestre decimales con coma si se prefiere, o directo del string
  priceEl.textContent = typeof price === 'number' ? price.toFixed(2).replace('.', ',') : price;
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
    priceEl.textContent = "0.00";
    dateEl.textContent = "No disponible";
  }
}

// 3. Eventos
refreshBtn.addEventListener('click', fetchTasaBCV);

// Escuchar cambios de conexión
window.addEventListener('online', () => offlineMsg.add('hidden'));
window.addEventListener('offline', () => offlineMsg.remove('hidden'));

// Carga inicial al abrir la app
if (navigator.onLine) {
  fetchTasaBCV();
} else {
  loadLocalData();
}
