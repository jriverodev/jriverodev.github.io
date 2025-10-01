class ExcelExporter {
    exportToExcel() {
        const data = app.filteredData;
        
        if (data.length === 0) {
            alert('No hay datos para exportar');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        
        // Generar nombre de archivo con fecha
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `inventario_equipos_${date}.xlsx`);
    }
}

// Configurar botón de exportación
document.getElementById('exportBtn').addEventListener('click', () => {
    new ExcelExporter().exportToExcel();
});
