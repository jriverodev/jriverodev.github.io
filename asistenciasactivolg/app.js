const { createApp } = Vue;

createApp({
    data() {
        const now = new Date();
        const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const savedConfig = JSON.parse(localStorage.getItem('asistenciasactlg_final_cfg') || '{}');
        return {
            operadorActual: sessionStorage.getItem("TTOCC_OPERADOR") || null,
            rolActual: sessionStorage.getItem("TTOCC_ROL") || null, // Almacena el rol ('editor' o 'lector')
            loginForm: {
                operador: "",
                password: "",
                error: false
            },
            trabajadores: JSON.parse(localStorage.getItem('asistenciasactlg_workers') || '[]'),
            // Estructura de asistencia: { "YYYY-MM-DD": { "CEDULA": { estado: true/false, modificado_por: "OPERADOR" } } }
            asistencias: JSON.parse(localStorage.getItem('asistenciasactlg_attendance') || '{}'),
            fechaSeleccionada: hoy,
            config: {
                // Reemplaza esta URL con la dirección de tu nueva Web App de Google Apps Script tras publicar el nuevo codigo.gs
                googleSheetUrl: 'https://script.google.com/macros/s/AKfycbxSarc2i1wsUzBwjH7Lon1asPuoEwaZTy8uNQ3e01T5jUDSD9hxdmV7mL4TjJDTzFaLjQ/exec',
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
        esLector() {
            return this.rolActual === 'lector';
        },
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
        async confirmarIdentidad() {
            const opSanitizado = this.loginForm.operador.toUpperCase().trim();
            const passSanitizado = this.loginForm.password.toLowerCase().trim();

            if (!this.config.googleSheetUrl) {
                Swal.fire({
                    title: 'Falta Configuración',
                    text: 'Configura la URL de Google Sheets primero.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                });
                return;
            }

            Swal.fire({
                title: 'Verificando...',
                text: 'Comprobando credenciales con el servidor...',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            try {
                const res = await fetch(this.config.googleSheetUrl, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'login',
                        operador: opSanitizado,
                        password: passSanitizado
                    })
                });
                const data = await res.json();

                if (data && data.autorizado) {
                    this.operadorActual = opSanitizado;
                    this.rolActual = data.rol || 'lector'; // Asigna el rol recibido (por defecto 'lector')
                    
                    sessionStorage.setItem("TTOCC_OPERADOR", opSanitizado);
                    sessionStorage.setItem("TTOCC_ROL", this.rolActual); // Guarda el rol en la sesión
                    
                    this.loginForm.error = false;
                    this.loginForm.password = "";

                    this.fetchFromSheets();

                    // Aviso de bienvenida elegante con SweetAlert2 mostrando el rol asignado
                    Swal.fire({
                        title: `¡Bienvenido!`,
                        text: `Sesión iniciada como ${opSanitizado} (${this.rolActual.toUpperCase()})`,
                        icon: 'success',
                        timer: 2500,
                        showConfirmButton: false
                    });
                } else {
                    this.loginForm.error = true;
                    this.loginForm.password = "";
                    Swal.fire({
                        title: 'Error de acceso',
                        text: '❌ Contraseña incorrecta para el operador.',
                        icon: 'error',
                        confirmButtonColor: '#4f46e5'
                    });
                }
            } catch (error) {
                console.error("Error en login:", error);
                this.loginForm.password = "";
                Swal.fire({
                    title: 'Error de conexión',
                    text: 'No se pudo conectar con el servidor de de autenticación.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
            }
        },
        cerrarSesion() {
            sessionStorage.removeItem("TTOCC_OPERADOR");
            sessionStorage.removeItem("TTOCC_ROL"); // Limpia el rol de la sesión
            this.operadorActual = null;
            this.rolActual = null;
            this.menuAcciones = false;
            
            Swal.fire({
                title: 'Sesión Cerrada',
                text: 'Has salido del sistema correctamente.',
                icon: 'info',
                timer: 1500,
                showConfirmButton: false
            });
        },
        async abrirMenuAcciones() {
            // Reemplazo del prompt nativo por un modal input de SweetAlert2 para la clave Raida1
            const { value: password } = await Swal.fire({
                title: 'Acceso de Administrador',
                input: 'password',
                inputLabel: 'Introduce la clave para gestionar las acciones:',
                inputPlaceholder: '•••••',
                showCancelButton: true,
                confirmButtonColor: '#4f46e5',
                cancelButtonText: 'Cancelar',
                confirmButtonText: 'Verificar',
                inputAttributes: {
                    autocapitalize: 'off',
                    autocorrect: 'off'
                }
            });

            if (password !== undefined && password !== "") {
                if (!this.config.googleSheetUrl) {
                    Swal.fire({
                        title: 'Falta Configuración',
                        text: 'Configura la URL de Google Sheets primero.',
                        icon: 'warning',
                        confirmButtonColor: '#4f46e5'
                    });
                    return;
                }

                Swal.fire({
                    title: 'Verificando...',
                    text: 'Comprobando clave de administrador...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                try {
                    const res = await fetch(this.config.googleSheetUrl, {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'verificarAdmin',
                            password: password
                        })
                    });
                    const data = await res.json();

                    if (data && data.autorizado) {
                        Swal.close();
                        this.menuAcciones = true;
                    } else {
                        Swal.fire({
                            title: 'Error de acceso',
                            text: '❌ Clave incorrecta. Acceso denegado.',
                            icon: 'error',
                            confirmButtonColor: '#4f46e5'
                        });
                    }
                } catch (error) {
                    console.error("Error en verificación de admin:", error);
                    Swal.fire({
                        title: 'Error de conexión',
                        text: 'No se pudo conectar con el servidor de autenticación.',
                        icon: 'error',
                        confirmButtonColor: '#ef4444'
                    });
                }
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
            // Protección: Bloquear la edición si el rol es 'lector'
            if (this.esLector) {
              /*  Swal.fire({
                    title: 'Acceso Denegado',
                    text: 'Tu cuenta tiene un rol de solo lectura. No puedes cambiar la asistencia.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                }); */
                return;
            }

            if (!this.asistencias[this.fechaSeleccionada]) {
                this.asistencias[this.fechaSeleccionada] = {};
            }
            
            const estadoActual = this.estaPresente(cedula);
            const nuevoEstado = !estadoActual;
            
            // Se encapsula el estado junto con el Operador Auditor activo
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
                    modificado_por: this.operadorActual
                });
            }
        },
        async marcarAreaPresente() {
            // Protección: Bloquear acciones grupales si el rol es 'lector'
            if (this.esLector) {
              /*  Swal.fire({
                    title: 'Acceso Denegado',
                    text: 'No tienes permisos para modificar asistencias en bloque.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                }); */
                return;
            }

            if(this.filtroArea === 'Todos' || !this.operadorActual) return;

            // Reemplazo del confirm nativo por SweetAlert2
            const resultado = await Swal.fire({
                title: `¿Marcar todo ${this.filtroArea}?`,
                text: `Se registrará como PRESENTE a todo el personal del área para el día ${this.fechaSeleccionada}.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#10b981',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, marcar todos',
                cancelButtonText: 'Cancelar'
            });

            if (resultado.isConfirmed) {
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
                
                Swal.fire({
                    title: 'Actualizado',
                    text: `Personal de ${this.filtroArea} actualizado con éxito.`,
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
            }
        },
        async importar(e) {
            // Protección: Impedir importar bases de datos si es lector
            if (this.esLector) {
                Swal.fire({
                    title: 'Acceso Denegado',
                    text: 'No tienes permisos para importar bases de datos.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                });
                // Limpiar el input file
                e.target.value = '';
                return;
            }

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
                
                Swal.fire({
                    title: 'Plantilla Importada',
                    text: `Se han cargado ${this.trabajadores.length} trabajadores a la base de datos.`,
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
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
        // Al enviar como 'text/plain', el navegador evita el Preflight de CORS,
        // pero el servidor de Google igual recibirá el JSON de forma correcta.
        await fetch(this.config.googleSheetUrl, {
            method: 'POST',
            headers: { "Content-Type": "text/plain" }, 
            body: JSON.stringify({ type, data })
        });
    } catch (e) {
        console.error("Error syncing data:", e);
    } finally {
        this.isSyncing = false;
    }
},
        async sincronizarGoogleSheets() {
            // Protección: Impedir sincronización manual destructiva desde clientes lectores
            if (this.esLector) {
             /*   Swal.fire({
                    title: 'Acceso Denegado',
                    text: 'Los lectores no pueden sincronizar ni sobrescribir datos en el servidor.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                }); */
                return;
            }

            if(!this.config.googleSheetUrl) {
                return Swal.fire({
                    title: 'Falta Configuración',
                    text: 'Configura la URL de Google Sheets primero.',
                    icon: 'warning',
                    confirmButtonColor: '#4f46e5'
                });
            }

            // Alerta visual de loading interactivo de SweetAlert2 durante el envío
            Swal.fire({
                title: 'Sincronizando...',
                text: 'Enviando datos de asistencia a la nube.',
                allowOutsideClick: false,
                didOpen: () => { Swal.showLoading(); }
            });

            const dataToSync = this.trabajadores.map(t => ({
                ...t,
                asistencia: this.estaPresente(t.cedula) ? 'PRESENTE' : 'AUSENTE',
                fecha: this.fechaSeleccionada,
                modificado_por: this.operadorActual || 'SISTEMA'
            }));

            await this.syncToSheets('attendance', dataToSync);
            
            Swal.fire({
                title: '¡Sincronizado!',
                text: 'Los datos en la nube están al día.',
                icon: 'success',
                confirmButtonColor: '#4f46e5'
            });
        },
        exportarExcel() {
            // Los lectores SÍ pueden descargar reportes en Excel de manera local
            const dataExport = this.trabajadores.map(t => ({
                Fecha: this.fechaSeleccionada,
                Cedula: t.cedula,
                Nombre: t.nombre,
                Cargo: t.cargo,
                Area: t.area,
                Ubicacion: t.ubicacion,
                Nomina: t.nomina,
                Asistencia: this.estaPresente(t.cedula) ? 'PRESENTE' : 'AUSENTE',
                'Modificado Por': this.obtenerOperadorModifico(t.cedula) || 'SIN MODIFICACIÓN'
            }));
            const ws = XLSX.utils.json_to_sheet(dataExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
            XLSX.writeFile(wb, `Reporte_Nexus_${this.fechaSeleccionada}.xlsx`);

            Swal.fire({
                title: 'Reporte Descargado',
                text: 'El archivo Excel se generó correctamente de forma local.',
                icon: 'success',
                confirmButtonColor: '#10b981'
            });
        },
        save() {
            localStorage.setItem('asistenciasactlg_workers', JSON.stringify(this.trabajadores));
            localStorage.setItem('asistenciasactlg_attendance', JSON.stringify(this.asistencias));
        },
        async resetearDatos() {
            // Protección: Evitar limpieza de datos local por parte de lectores
            if (this.esLector) {
                Swal.fire({
                    title: 'Acceso Denegado',
                    text: 'No tienes permisos de administrador para limpiar las bases de datos.',
                    icon: 'warning',
                    confirmButtonColor: '#ef4444'
                });
                return;
            }

            // Cuadro de diálogo de confirmación crítica de seguridad
            const resultado = await Swal.fire({
                title: '¿Estás completamente seguro?',
                text: "Se eliminarán TODOS los trabajadores y el historial local. ¡Esta acción no se puede deshacer!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'Sí, borrar todo',
                cancelButtonText: 'Cancelar'
            });

            if (resultado.isConfirmed) {
                this.trabajadores = [];
                this.asistencias = {};
                localStorage.removeItem('asistenciasactlg_workers');
                localStorage.removeItem('asistenciasactlg_attendance');
                localStorage.removeItem('asistenciasactlg_final_db');
                
                await Swal.fire({
                    title: 'Datos Eliminados',
                    text: 'La base de datos se ha limpiado por completo.',
                    icon: 'success',
                    confirmButtonColor: '#ef4444'
                });
                location.reload();
            }
        },
        guardarConfig() { 
            // Los lectores pueden guardar configuraciones locales técnicas si es necesario, pero proteges la escritura global
            localStorage.setItem('asistenciasactlg_final_cfg', JSON.stringify(this.config));
            this.menuConfig = false;
            if (this.config.googleSheetUrl) this.fetchFromSheets();
            
            Swal.fire({
                title: 'Configuración Guardada',
                text: 'La URL de la Web App se actualizó correctamente.',
                icon: 'success',
                confirmButtonColor: '#4f46e5'
            });
        }
    }
}).mount('#app');
