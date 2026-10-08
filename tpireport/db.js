/**
 * TPI Reportes - Base de datos IndexedDB con Dexie.js (Versión 2 con soporte de Fotos GPS)
 */

// Inicialización de la base de datos Dexie
const db = new Dexie('TPIReportDB');

db.version(1).stores({
  reports: '++id, timestamp, fecha, hora, lugar, turno, tpi, ci, tlf, radio, bateria, asunto, observaciones, notificado',
  profile: 'id, tpi, ci, tlf, radio, bateria, lugarDefault, notificadoDefault, turnoDefault'
});

db.version(2).stores({
  reports: '++id, timestamp, fecha, hora, lugar, turno, tpi, ci, tlf, radio, bateria, asunto, observaciones, notificado, fotoId, gpsCoords',
  profile: 'id, tpi, ci, tlf, radio, bateria, lugarDefault, notificadoDefault, turnoDefault',
  photos: '++id, timestamp, reportId, dataUrl, latitude, longitude, altitude, accuracy, lugar, tpi'
});

/**
 * Guarda o actualiza un reporte en IndexedDB
 */
async function guardarReporteDB(reporte) {
  try {
    const payload = {
      ...reporte,
      timestamp: reporte.timestamp || new Date().toISOString()
    };
    const id = await db.reports.put(payload);
    return id;
  } catch (error) {
    console.error('Error al guardar reporte en IndexedDB:', error);
    guardarReporteLocalStorage(reporte);
    return Date.now();
  }
}

/**
 * Obtiene todos los reportes guardados con opción de filtro
 */
async function obtenerReportesDB(busqueda = '') {
  try {
    let coleccion = await db.reports.orderBy('id').reverse().toArray();
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      coleccion = coleccion.filter(r =>
        (r.lugar && r.lugar.toLowerCase().includes(q)) ||
        (r.asunto && r.asunto.toLowerCase().includes(q)) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(q)) ||
        (r.fecha && r.fecha.toLowerCase().includes(q)) ||
        (r.tpi && r.tpi.toLowerCase().includes(q)) ||
        (r.notificado && r.notificado.toLowerCase().includes(q))
      );
    }
    return coleccion;
  } catch (error) {
    console.error('Error al obtener reportes de IndexedDB:', error);
    return obtenerReportesLocalStorage(busqueda);
  }
}

/**
 * Obtiene un reporte por su ID
 */
async function obtenerReportePorIdDB(id) {
  try {
    return await db.reports.get(Number(id));
  } catch (error) {
    console.error('Error al obtener reporte por ID:', error);
    const reportes = obtenerReportesLocalStorage();
    return reportes.find(r => r.id === Number(id)) || null;
  }
}

/**
 * Elimina un reporte por ID
 */
async function eliminarReporteDB(id) {
  try {
    await db.reports.delete(Number(id));
    return true;
  } catch (error) {
    console.error('Error al eliminar reporte de IndexedDB:', error);
    return false;
  }
}

/**
 * Vacía todo el historial de reportes
 */
async function vaciarHistorialDB() {
  try {
    await db.reports.clear();
    localStorage.removeItem('tpi_reports_backup');
    return true;
  } catch (error) {
    console.error('Error al vaciar historial:', error);
    return false;
  }
}

/**
 * Guarda una foto capturada con marca de agua y GPS
 */
async function guardarFotoDB(fotoData) {
  try {
    const payload = {
      ...fotoData,
      timestamp: fotoData.timestamp || new Date().toISOString()
    };
    const id = await db.photos.put(payload);
    return id;
  } catch (error) {
    console.error('Error al guardar foto en IndexedDB:', error);
    return Date.now();
  }
}

/**
 * Obtiene todas las fotos guardadas
 */
async function obtenerFotosDB() {
  try {
    return await db.photos.orderBy('id').reverse().toArray();
  } catch (error) {
    console.error('Error al leer fotos de IndexedDB:', error);
    return [];
  }
}

/**
 * Elimina una foto por ID
 */
async function eliminarFotoDB(id) {
  try {
    await db.photos.delete(Number(id));
    return true;
  } catch (error) {
    console.error('Error al eliminar foto:', error);
    return false;
  }
}

/**
 * Guarda la configuración del perfil del TPI (Operador)
 */
async function guardarPerfilTPI(perfil) {
  try {
    const data = {
      id: 1,
      ...perfil,
      actualizadoEl: new Date().toISOString()
    };
    await db.profile.put(data);
    localStorage.setItem('tpi_perfil_cache', JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error al guardar perfil en IndexedDB:', error);
    localStorage.setItem('tpi_perfil_cache', JSON.stringify(perfil));
    return false;
  }
}

/**
 * Obtiene la configuración guardada del perfil del TPI
 */
async function obtenerPerfilTPI() {
  try {
    const perfil = await db.profile.get(1);
    if (perfil) return perfil;
  } catch (error) {
    console.warn('Error al leer perfil de IndexedDB, buscando en localStorage:', error);
  }

  const cache = localStorage.getItem('tpi_perfil_cache');
  if (cache) {
    try {
      return JSON.parse(cache);
    } catch (e) {
      console.error('Cache de perfil inválido:', e);
    }
  }

  return {
    tpi: 'Miguel Rivero',
    ci: '20.458.588',
    tlf: '0412 1052752',
    radio: 'S/R',
    bateria: 'S/B',
    lugarDefault: 'Edificio Principal PDVSA el Menito. (COA)',
    notificadoDefault: 'Supervisor de Guardia Jorge Sara',
    turnoDefault: '12 hrs.'
  };
}

// Fallback localStorage Helpers
function guardarReporteLocalStorage(reporte) {
  const lista = obtenerReportesLocalStorage();
  reporte.id = reporte.id || Date.now();
  lista.unshift(reporte);
  localStorage.setItem('tpi_reports_backup', JSON.stringify(lista));
}

function obtenerReportesLocalStorage(busqueda = '') {
  const data = localStorage.getItem('tpi_reports_backup');
  if (!data) return [];
  try {
    let lista = JSON.parse(data);
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      lista = lista.filter(r =>
        (r.lugar && r.lugar.toLowerCase().includes(q)) ||
        (r.asunto && r.asunto.toLowerCase().includes(q)) ||
        (r.fecha && r.fecha.toLowerCase().includes(q))
      );
    }
    return lista;
  } catch (e) {
    return [];
  }
}
