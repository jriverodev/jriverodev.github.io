const { createApp } = Vue;

createApp({
    data() {
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const savedConfig = JSON.parse(localStorage.getItem('nexus_final_cfg') || '{}');
        return {
            // Base de datos de autenticación configurada para tus 3 operadores (claves de 5 caracteres alfanuméricos)
            usuariosAutorizados: {
                "ORLANDO VELAZQUEZ": "ov123",
                "EDECIO QUERO": "eq456",
                "MERVIN GUTIERREZ": "mg789"
            },
            operadorActual: sessionStorage.getItem("TTOCC_OPERADOR") || null,
            loginForm: {
                operador: "",
                password: "",
                error: false
            },
            trabajadores: JSON.parse(localStorage.getItem('nexus_workers') || localStorage.getItem('nexus_final_db') || '[]'),
            // Estructura de asistencia: { "YYYY-MM-DD": { "CEDULA": { estado: true/false, modificado_por: "OPERADOR" } } }
            asistencias: JSON.parse(localStorage.getItem('nexus_attendance') || '{}'),
            fechaSeleccionada: hoy,
            config: {
                googleSheetUrl: 'https://script.google.com/macros/s/AKfycbw0Z3-EtLTWgW9aQvwhYfyx6BqnViK8K8gn3HiYc6g7VEZmrQH77-Iup8Ik-qd7sC1hEw/exec',
                ...savedConfig
            },
            searchQuery: '',
            filtroArea: 'Todos',
            menuConfig: false,
            menuAcciones: false, 
            isSyncing: false,
            lastSync: null
        }
    },
    mounted() {
        if (this.operadorActual && this.config.googleSheetUrl) {
            this.fetchFromSheets();
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
            return this.trabajadores.filter(t => {
                const registro = hoyAsis[t.cedula];
                return registro && (registro === true || registro.estado === true);
            }).length;
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
        confirmarIdentidad() {
            const opSanitizado = this.loginForm.operador.toUpperCase().trim();
            const passSanitizado = this.loginForm.password.toLowerCase().trim();

            if (this.usuariosAutorizados[opSanitizado] && this.usuariosAutorizados[opSanitizado] === passSanitizado) {
                this.operadorActual = opSanitizado;
                sessionStorage.setItem("TTOCC_OPERADOR", opSanitizado);
                this.loginForm.error = false;
                this.loginForm.password = "";
                
                // Ejecutar sincronización inicial tras loguearse
                if (this.config.googleSheetUrl) {
                    this.fetchFromSheets();
                }
            } else {
                this.loginForm.error = true;
                this.loginForm.password = "";
            }
        },
        cerrarSesion() {
            sessionStorage.removeItem("TTOCC_OPERADOR");
            this.operadorActual = null;
            this.menuAcciones = false;
        },
        abrirMenuAcciones() {
            const password = prompt("Por favor, introduce la clave de acceso de administrador para gestionar las acciones:");
            if (password === "Raida1") {
                this.menuAcciones = true;
            } else if (password !== null) {
                alert("❌ Clave incorrecta. Acceso denegado.");
            }
        },
        cambiarDia(delta) {
            const d = new Date(this.fechaSeleccionada + 'T12:00:00');
            d.setDate(d.getDate() + delta);
            this.fechaSeleccionada = d.toISOString().slice(0, 10);
        },
        estaPresente(cedula) {
            const hoyAsis = this.asistencias[this.fechaSeleccionada] || {};
            const registro = hoyAsis[cedula];
            if (!registro) return false;
            return registro === true || registro.estado === true;
        },
        obtenerOperadorModifico(cedula) {
            const hoyAsis = this.asistencias[this.fechaSeleccionada] || {};
            const registro = hoyAsis[cedula];
            if (registro && registro.modificado_por) return registro.modificado_por;
            return null;
        },
        async toggleAsistencia(cedula) {
            if (!this.asistencias[this.fechaSeleccionada]) {
                this.asistencias[this.fechaSeleccionada] = {};
            }
            
            const estadoActual = this.estaPresente(cedula);
            const nuevoEstado = !estadoActual;
            
            // Se encapsula el estado junto con el Operador Auditor
            this.asistencias[this.fechaSeleccionada][cedula] = {
                estado: nuevoEstado,
                modificado_por: this.operadorActual
            };
            this.save();

            const t = this.trabajadores.find(x => x.cedula === cedula);
            if (this.config.googleSheetUrl && t) {
                await this.syncToSheets('attendance', {
                    ...t,
                    fecha: this.fechaSeleccionada,
                    asistencia: nuevoEstado ? 'PRESENTE' : 'AUSENTE',
                    modificado_por: this.operadorActual // Columna enviada a la nube
                });
            }
        },
        marcarAreaPresente() {
            if(this.filtroArea === 'Todos' || !this.operadorActual) return;

            const confirmacion = confirm(`¿Marcar como PRESENTES a todos los trabajadores de ${this.filtroArea} para el día ${this.fechaSeleccionada}?`);

            if(confirmacion) {
                if (!this.asistencias[this.fechaSeleccionada]) {
                    this.asistencias[this.fechaSeleccionada] = {};
                }
                const aSincronizar = [];
                this.trabajadores.forEach(t => {
                    if(t.area === this.filtroArea) {
                        this.asistencias[this.fechaSeleccionada][t.cedula] = {
                            estado: true,
                            modificado_por: this.operadorActual
                        };
                        aSincronizar.push({
                            ...t,
                            fecha: this.fechaSeleccionada,
                            asistencia: 'PRESENTE',
                            modificado_por: this.operadorActual
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
            if (!this.config.googleSheetUrl || this.isSyncing || !this.operadorActual) return;
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
                        formatted[a.fecha][a.cedula] = {
                            estado: (a.asistencia === 'PRESENTE'),
                            modificado_por: a.modificado_por || 'SISTEMA'
                        };
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
                fecha: this.fechaSeleccionada,
                modificado_por: this.obtenerOperadorModifico(t.cedula) || 'SIN ESPECIFICAR'
            }));

            await this.syncToSheets('attendance', dataToSync);
            alert("✅ Sincronización completa");
        },
        exportarExcel() {
            // Se añade la columna 'modificado_por' explícitamente en el mapa del excel
            const dataExport = this.trabajadores.map(t => ({
                Fecha: this.fechaSeleccionada,
                Cedula: t.cedula,
                Nombre: t.nombre,
                Cargo: t.cargo,
                Area: t.area,
                Ubicacion: t.ubicacion,
                Nomina: t.nomina,
                Asistencia: this.estaPresente(t.cedula) ? 'PRESENTE' : 'AUSENTE',
                modificado_por: this.obtenerOperadorModifico(t.cedula) || 'SIN MODIFICACIÓN'
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
