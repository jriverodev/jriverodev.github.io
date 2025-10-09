/**
 * Exporta un array de objetos a un archivo Excel.
 * Esta función depende de la librería SheetJS (XLSX), que debe estar
 * cargada globalmente desde el CDN.
 *
 * @param {Array<Object>} data - El array de datos (JSON) a exportar.
 * @param {string} filename - El nombre del archivo Excel que se generará.
 */
function exportToExcel(data, filename) {
  // La validación para datos vacíos es manejada por el llamador (app.js).

  // Limpiar cualquier clave interna o temporal antes de la exportación.
  const cleanedData = data.map(item => {
    const { _modified, _new, _modifiedAt, ...rest } = item;
    return rest;
  });

  // Crear la hoja de cálculo y el libro de trabajo
  const ws = XLSX.utils.json_to_sheet(cleanedData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");

  // Escribir y descargar el archivo
  XLSX.writeFile(wb, filename);
}