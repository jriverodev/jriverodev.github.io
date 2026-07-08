const { createApp } = Vue;

createApp({
    data() {
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const savedConfig = JSON.parse(localStorage.getItem('nexus_final_cfg') || '{}');
        return {
            trabajadores: JSON.parse(localStorage.getItem('nexus_workers') || localStorage.getItem('nexus_final_db') || '[]'),
            asistencias: JSON.parse(localStorage.getItem('nexus_attendance') || '{}'),
            fechaSeleccionada: hoy,
            config: {
                googleSheetUrl: '',
                ...savedConfig
            },
            searchQuery: '',
            filtroArea: 'Todos',
            menuConfig: false,
            menuAcciones: false, // Variable reactiva para controlar el panel inferior de acciones
            isSyncing: false,
            lastSync: null
        }
    },
    mounted() {
        if (this.config.googleSheetUrl) {
            this.fetchFromSheets();
            // Sincronización pasiva en tiempo real (Polling cada 30 segundos)
            setInterval(() => this.fetchFromSheets(), 30000);
        }
    },
    computed: {
        fechaLegible() {
            const d = new Date(this.fechaSeleccionada + 'T12:00:00');
            return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        },
        areas() {
            return [...new Set(this.trabajadores.map(t => t.area))];
        },
        filtrados() {
            return this.trabajadores.filter(t => {
                const s = this.searchQuery.toLowerCase();
                const cumpleBusqueda = t.nombre.toLowerCase().includes(s) ||
                                     t.cedula.toString().includes(s) ||
                                     (t.ubicacion || '').toLowerCase().includes(s) ||
                                     (t.nomina || '').toLowerCase().includes(s);
                const cumpleArea = this.filtroArea === 'Todos' || t.area === this.filtroArea;
                return cumpleBusqueda && cumpleArea;
            });
        },
        conteoPresentes() {
            const hoyAsis = this.asistencias[this.fechaSeleccionada] || {};
            return this.trabajadores.filter(t => hoyAsis[t.cedula]).length;
        },
        conteoAusentes() { 
            return this.trabajadores.length - this.conteoPresentes; 
        },
        porcentajeAsistencia() { 
            if(this.trabajadores.length === 0) return 0;
            return Math.round((this.conteoPresentes / this.trabajadores.length) * 100);
        }
    },
    methods: {
        cambiarDia(delta) {
            const d = new Date(this.fechaSeleccionada + 'T12:00:00');
            d.setDate(d.getDate() + delta);
            this.fechaSeleccionada = d.toISOString().slice(0, 10);
        },
        estaPresente(cedula) {
            return !!(this.asistencias[this.fechaSeleccionada] && this.asistencias[this.fechaSeleccionada][cedula]);
        },
        async toggleAsistencia(cedula) {
            if (!this.asistencias[this.fechaSeleccionada]) {
                this.asistencias[this.fechaSeleccionada] = {};
            }
            const nuevoEstado = !this.asistencias[this.fechaSeleccionada][cedula];
            this.asistencias[this.fechaSeleccionada][cedula] = nuevoEstado;
            this.save();

            // Sincronización inmediata al cambiar estado
            const t = this.trabajadores.find(x => x.cedula === cedula);
            if (this.config.googleSheetUrl && t) {
                await this.syncToSheets('attendance', {
                    ...t,
                    fecha: this.fechaSeleccionada,
                    asistencia: nuevoEstado ? 'PRESENTE' : 'AUSENTE'
                });
            }
        },
        marcarAreaPresente() {
            if(this.filtroArea === 'Todos') return;

            const confirmacion = confirm(`¿Marcar como PRESENTES a todos los trabajadores de ${this.filtroArea} para el día ${this.fechaSeleccionada}?`);

            if(confirmacion) {
                if (!this.asistencias[this.fechaSeleccionada]) {
                    this.asistencias[this.fechaSeleccionada] = {};
                }
                const aSincronizar = [];
                this.trabajadores.forEach(t => {
                    if(t.area === this.filtroArea) {
                        this.asistencias[this.fechaSeleccionada][t.cedula] = true;
                        aSincronizar.push({
                            ...t,
                            fecha: this.fechaSeleccionada,
                            asistencia: 'PRESENTE'
                        });
                    }
                });
                this.save();

                if (this.config.googleSheetUrl && aSincronizar.length > 0) {
                    this.syncToSheets('attendance', aSincronizar);
                }

                alert(`Personal de ${this.filtroArea} actualizado.`);
            }
        },
        async importar(e) {
            const reader = new FileReader();
            reader.onload = async (f) => {
                const wb = XLSX.read(f.target.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
                this.trabajadores = json.map(r => ({
                    nombre: r.Nombre || r.nombre,
                    cedula: r.Cedula || r.cedula,
                    cargo: r.Cargo || r.cargo,
                    area: r.Area || r.area,
                    ubicacion: r['Ubicación laboral'] || r.ubicacion || r.Ubicacion || '',
                    nomina: r['Tipo de nómina'] || r.nomina || r.Nomina || ''
                }));
                this.save();

                if (this.config.googleSheetUrl) {
                    await this.syncToSheets('workers', this.trabajadores);
                }
            };
            reader.readAsArrayBuffer(e.target.files[0]);
        },
        async fetchFromSheets() {
            if (!this.config.googleSheetUrl || this.isSyncing) return;
            this.isSyncing = true;
            try {
                const res = await fetch(`${this.config.googleSheetUrl}?action=all`);
                const data = await res.json();

                if (data.workers && data.workers.length > 0) {
                    this.trabajadores = data.workers;
                }

                if (data.attendance) {
                    const formatted = {};
                    data.attendance.forEach(a => {
                        if (!formatted[a.fecha]) formatted[a.fecha] = {};
                        formatted[a.fecha][a.cedula] = (a.asistencia === 'PRESENTE');
                    });
                    this.asistencias = formatted;
                }
                this.lastSync = new Date().toLocaleTimeString();
                this.save();
            } catch (e) {
                console.error("Error fetching data:", e);
            } finally {
                this.isSyncing = false;
            }
        },
        async syncToSheets(type, data) {
            if (!this.config.googleSheetUrl) return;
            this.isSyncing = true;
            try {
                await fetch(this.config.googleSheetUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type, data })
                });
            } catch (e) {
                console.error("Error syncing data:", e);
            } finally {
                this.isSyncing = false;
            }
        },
        async sincronizarGoogleSheets() {
            if(!this.config.googleSheetUrl) return alert("Configura la URL de Google Sheets primero");

            const dataToSync = this.trabajadores.map(t => ({
                ...t,
                asistencia: this.estaPresente(t.cedula) ? 'PRESENTE' : 'AUSENTE',
                fecha: this.fechaSeleccionada
            }));

            await this.syncToSheets('attendance', dataToSync);
            alert("✅ Sincronización completa");
        },
        exportarExcel() {
            const dataExport = this.trabajadores.map(t => ({
                ...t,
                asistencia: this.estaPresente(t.cedula) ? 'PRESENTE' : 'AUSENTE',
                fecha: this.fechaSeleccionada
            }));
            const ws = XLSX.utils.json_to_sheet(dataExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
            XLSX.writeFile(wb, `Reporte_Nexus_${this.fechaSeleccionada}.xlsx`);
        },
        save() {
            localStorage.setItem('nexus_workers', JSON.stringify(this.trabajadores));
            localStorage.setItem('nexus_attendance', JSON.stringify(this.asistencias));
        },
        resetearDatos() {
            if(confirm("¿Estás seguro de eliminar TODOS los trabajadores y el historial de asistencia? Esta acción no se puede deshacer.")) {
                this.trabajadores = [];
                this.asistencias = {};
                localStorage.removeItem('nexus_workers');
                localStorage.removeItem('nexus_attendance');
                localStorage.removeItem('nexus_final_db');
                alert("Datos eliminados correctamente.");
                location.reload();
            }
        },
        guardarConfig() { 
            localStorage.setItem('nexus_final_cfg', JSON.stringify(this.config));
            this.menuConfig = false;
            if (this.config.googleSheetUrl) this.fetchFromSheets();
        }
    }
}).mount('#app');
