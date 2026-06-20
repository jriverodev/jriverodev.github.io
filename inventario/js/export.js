/* export.js - pequeña utilidad para exportar a Excel usando SheetJS (XLSX) */
window.exportToExcel = function(rows, filename = 'export.xlsx') {
  if (!rows || rows.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  // Construir hoja a partir de objetos
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  XLSX.writeFile(wb, filename);
};
