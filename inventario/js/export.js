class ExcelExporter {
    exportToExcel() {
        // Asegurarse de que el objeto app está disponible y tiene datos
        if (typeof app === 'undefined' || !app.filteredData) {
            console.error('La aplicación no está inicializada o no hay datos.');
            // Usamos una notificación o un modal simple en lugar de alert()
            app.showNotification('Error: Aplicación no inicializada o sin datos.', 'error');
            return;
        }

        const data = app.filteredData.map(item => {
            // Limpiar claves internas antes de exportar
            const cleanItem = { ...item };
            delete cleanItem._modified;
            delete cleanItem._new;
            delete cleanItem._modifiedAt;
            return cleanItem;
        });
        
        if (data.length === 0) {
            app.showNotification('No hay datos para exportar.', 'warning');
            return;
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventario");
        
        // Generar nombre de archivo con fecha
        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `inventario_equipos_${date}.xlsx`);
        app.showNotification(`✅ Exportación completada: inventario_equipos_${date}.xlsx`, 'success');
    }
}

// Configurar botón de exportación
document.getElementById('exportBtn').addEventListener('click', () => {
    // Crear una instancia y exportar
    new ExcelExporter().exportToExcel();
});
