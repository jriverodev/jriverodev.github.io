// js/panel.js - Controlador Unificado de Patio, Edición Inline, Checklist Automatizado, Manejo de Imágenes en Base64 y Módulo Offline/Respaldo
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    verificarSesion();
    cargarTablaEditable();
    initEventoUnidadFrecuente();
    
    // Escuchador de conectividad para procesar cola offline al reconectar
    window.addEventListener("online", procesarColaOffline);
    
    // Asignar debounce al input de búsqueda para evitar filtrados excesivos en cada pulsación
    const inputBusqueda = document.getElementById("input-busqueda");
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", debounce(filtrarMatriz, 250));
    }

    const inputBusquedaUnidadModal = document.getElementById("input-busqueda-unidad-modal");
    if (inputBusquedaUnidadModal) {
        inputBusquedaUnidadModal.addEventListener("input", debounce(filtrarUnidadesFlotaModal, 250));
    }

    // Esperar a jQuery / Select2
    if (typeof $ !== 'undefined') {
        inicializarSelects();
    } else {
        console.warn("jQuery no detectado de inmediato, reintentando inicialización...");
        setTimeout(inicializarSelects, 100);
    }
});

function inicializarSelects() {
    if (typeof $ === 'undefined') return;

    const configGerencia = {
        placeholder: 'Seleccione o escriba...',
        tags: true,
        width: '100%'
    };

    $('#add-gerencia').select2(Object.assign({}, configGerencia, { dropdownParent: $('#modalNuevoRegistro') }));
    $('#edit-gerencia').select2(Object.assign({}, configGerencia, { dropdownParent: $('#modalEditarRegistro') }));
}

// Almacenes de control en memoria global
var listaRegistrosPanel = [];
var tareasModalActual = [];
var unidadesFlotaCache = [];
var OPERADOR_ACTUAL = "";
var FILTROS_ACTIVOS = {
    busqueda: "",
    estatus: [],
    ubicacion: ""
};

/**
 * LÓGICA DE SELECCIÓN DE UNIDAD DESDE EL MAESTRO DE ACTIVOS
 */
function initEventoUnidadFrecuente() {
    const btn = document.getElementById("btnUnidadFrecuente");
    if (btn) {
        btn.addEventListener("click", abrirModalSeleccionarUnidad);
    }
}

async function abrirModalSeleccionarUnidad() {
    const modal = document.getElementById("modalSeleccionarUnidad");
    if (!modal) return;
    const searchInput = document.getElementById("input-busqueda-unidad-modal");
    if (searchInput) searchInput.value = "";

    modal.classList.remove("hidden");
    await cargarUnidadesFlotaModal();
}

function cerrarModalSeleccionarUnidad() {
    const modal = document.getElementById("modalSeleccionarUnidad");
    if (modal) modal.classList.add("hidden");
}

async function cargarUnidadesFlotaModal() {
    const tbody = document.getElementById("tablaUnidadesFlotaCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="p-4 text-center text-blue-400 font-bold uppercase text-[10px]">
                <i class="fa-solid fa-spinner animate-spin mr-1"></i> Cargando Maestro de Activos...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer_activos" })
        });
        const res = await response.json();

        if (res.status === "SUCCESS") {
            let filasCrudas = res.datos || [];
            unidadesFlotaCache = filasCrudas.map(u => {
                let normalized = {};
                for (let key in u) {
                    normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
                }
                const getV = (terms) => {
                    const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                    return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
                };
                return {
                    ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                    Placa: getV(["PLACA"]) || u["Placa"] || "S/I",
                    VIN: getV(["VIN"]) || u["VIN"] || "S/I",
                    Marca: normalized["MARCA"] || u["Marca"] || "",
                    Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "Liviana"
                };
            });

            renderizarUnidadesFlotaModal(unidadesFlotaCache);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-bold text-xs">${escapeHTML(res.message)}</td></tr>`;
        }
    } catch (e) {
        console.error("Error leyendo activos para modal:", e);
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-bold text-xs">Error de comunicación con la base de datos.</td></tr>`;
    }
}

function renderizarUnidadesFlotaModal(unidades) {
    const tbody = document.getElementById("tablaUnidadesFlotaCuerpo");
    if (!tbody) return;

    if (unidades.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 font-bold text-xs uppercase">No hay unidades registradas o encontradas.</td></tr>`;
        return;
    }

    const htmlArray = unidades.map(u => {
        const idEscaped = escapeHTML(u.ID_Unidad);
        const marcaEscaped = escapeHTML(u.Marca);
        const tipoEscaped = escapeHTML(u.Tipo_Flota);
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td class="p-3 font-mono font-bold text-slate-900 dark:text-white uppercase">${idEscaped}</td>
                <td class="p-3 font-mono text-slate-700 dark:text-slate-300 uppercase">${escapeHTML(u.Placa)}</td>
                <td class="p-3 font-mono text-slate-600 dark:text-slate-400 uppercase">${escapeHTML(u.VIN)}</td>
                <td class="p-3 uppercase font-bold text-slate-800 dark:text-slate-200">${marcaEscaped}</td>
                <td class="p-3 uppercase"><span class="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[9px] font-black">${tipoEscaped}</span></td>
                <td class="p-3 text-center">
                    <button type="button" onclick="seleccionarUnidadFlota('${idEscaped}', '${marcaEscaped}', '${tipoEscaped}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95">
                        Seleccionar
                    </button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlArray.join('');
}

function filtrarUnidadesFlotaModal() {
    const query = (document.getElementById("input-busqueda-unidad-modal")?.value || "").toLowerCase().trim();
    const filtrados = unidadesFlotaCache.filter(u => {
        return !query ||
            String(u.ID_Unidad || "").toLowerCase().includes(query) ||
            String(u.Placa || "").toLowerCase().includes(query) ||
            String(u.VIN || "").toLowerCase().includes(query) ||
            String(u.Marca || "").toLowerCase().includes(query);
    });
    renderizarUnidadesFlotaModal(filtrados);
}

function seleccionarUnidadFlota(idUnidad, marca, tipoFlota) {
    const inputUnidad = document.getElementById("add-unidad");
    const inputMarca = document.getElementById("add-marca");
    const selectFlota = document.getElementById("add-flota");

    if (inputUnidad) inputUnidad.value = idUnidad;
    if (inputMarca) inputMarca.value = marca;
    if (selectFlota) selectFlota.value = tipoFlota;

    cerrarModalSeleccionarUnidad();
    if (window.TTOCC_UI) {
        TTOCC_UI.success("Unidad Seleccionada", `Se cargó la unidad ${idUnidad} (${marca}) al formulario.`);
    }
}

/**
 * LÓGICA DE COLA OFFLINE Y RESPALDO EN LA NUBE / LOCAL
 */
const CLAVE_COLA_OFFLINE = "TTOCC_COLA_PETICIONES_OFFLINE";
const CLAVE_RESPALDO_MATRIZ = "TTOCC_RESPALDO_LOCAL_MATRIZ";

function encolarPeticionOffline(payload) {
    if (typeof encolarOperacionOffline === 'function') {
        encolarOperacionOffline("panel_op", payload, CLAVE_COLA_OFFLINE);
        return;
    }
    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA_OFFLINE) || "[]");
    cola.push({
        id: Date.now(),
        fecha: new Date().toISOString(),
        payload: payload
    });
    localStorage.setItem(CLAVE_COLA_OFFLINE, JSON.stringify(cola));
}

async function procesarColaOffline() {
    if (!navigator.onLine) return;
    if (typeof procesarSincronizacionPendiente === 'function') {
        await procesarSincronizacionPendiente(CLAVE_COLA_OFFLINE);
        await cargarTablaEditable();
        return;
    }
    
    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA_OFFLINE) || "[]");
    if (cola.length === 0) return;

    if (window.TTOCC_UI) {
        TTOCC_UI.info("Sincronizando...", `Enviando ${cola.length} operación(es) guardada(s) sin conexión.`);
    }

    const colaPendiente = [...cola];
    localStorage.setItem(CLAVE_COLA_OFFLINE, JSON.stringify([]));

    for (const item of colaPendiente) {
        try {
            const payloadConToken = Object.assign({}, item.payload, { token: obtenerTokenSesion() });
            const response = await fetch(APP_CONFIG.URL_API, {
                method: "POST",
                body: JSON.stringify(payloadConToken)
            });
            const res = await response.json();
            if (res.status !== "SUCCESS") {
                console.error("Fallo reintentando petición offline:", item, res);
            }
        } catch (e) {
            console.error("Error crítico retransmitiendo petición offline:", e);
            encolarPeticionOffline(item.payload);
        }
    }

    await cargarTablaEditable();
}

/**
 * Lógica de Identificación, Autenticación Backend y Auditoría
 */
async function verificarSesion() {
    const token = obtenerTokenSesion();
    const sesionUser = sessionStorage.getItem("TTOCC_OPERADOR");

    if (token && sesionUser) {
        try {
            const res = await fetch(APP_CONFIG.URL_API, {
                method: "POST",
                body: JSON.stringify({ accion: "validar_token", token: token, modulo_requerido: "TALLERES" })
            });
            const data = await res.json();
            if (data.status === "SUCCESS" && data.valido) {
                OPERADOR_ACTUAL = data.usuario || sesionUser;
                window.operadorActivo = OPERADOR_ACTUAL;
                document.getElementById("modalIdentificacion").classList.add("hidden");
                return;
            }
        } catch (e) {
            console.warn("No se pudo validar el token con el servidor. Se mantendrá sesión local si existe.", e);
            OPERADOR_ACTUAL = sesionUser;
            window.operadorActivo = sesionUser;
            document.getElementById("modalIdentificacion").classList.add("hidden");
            return;
        }
    }

    cerrarSesion();
    if (typeof poblarSelectOperadores === 'function') {
        poblarSelectOperadores('input-operador', 'TALLERES');
    }
    document.getElementById("modalIdentificacion").classList.remove("hidden");
}

async function confirmarIdentidad(event) {
    event.preventDefault();

    const selectOperador = document.getElementById('input-operador');
    const inputPassword = document.getElementById('input-password');
    const divError = document.getElementById('error-identificacion');

    if (!selectOperador || !inputPassword) return;

    const operadorSanitizado = selectOperador.value.toUpperCase().replace(/[^A-Z ]/g, "");
    const passwordSanitizado = inputPassword.value.trim().toLowerCase();

    if (!operadorSanitizado || !passwordSanitizado) {
        if (divError) {
            divError.textContent = "Seleccione operador e ingrese la contraseña.";
            divError.classList.remove('hidden');
        }
        return;
    }

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({
                accion: "login",
                usuario: operadorSanitizado,
                password: passwordSanitizado,
                modulo_requerido: "TALLERES"
            })
        });

        const res = await response.json();

        if (res.status === "SUCCESS" && res.token) {
            guardarSesion(res.token, res.usuario);
            OPERADOR_ACTUAL = res.usuario;
            window.operadorActivo = res.usuario;

            if (divError) divError.classList.add('hidden');
            document.getElementById('modalIdentificacion').classList.add('hidden');

            console.log(`Acceso concedido a: ${res.usuario}`);
            procesarColaOffline();
        } else {
            if (divError) {
                divError.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> ${escapeHTML(res.message || "Credenciales incorrectas")}`;
                divError.classList.remove('hidden');
            }
            inputPassword.value = '';
            inputPassword.focus();
        }
    } catch (err) {
        console.error("Error al autenticar:", err);
        if (divError) {
            divError.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Error de conexión con el servidor de autenticación.`;
            divError.classList.remove('hidden');
        }
    }
}

/**
 * Lógica de Búsqueda y Filtros (Matriz Operativa)
 */
function abrirFiltros() {
    const sheet = document.getElementById("bottomSheetFiltros");
    const content = document.getElementById("sheetContent");
    sheet.classList.remove("hidden");
    setTimeout(() => {
        content.classList.remove("translate-y-full");
    }, 10);
}

function cerrarFiltros(event) {
    const content = document.getElementById("sheetContent");
    content.classList.add("translate-y-full");
    setTimeout(() => {
        document.getElementById("bottomSheetFiltros").classList.add("hidden");
    }, 300);
}

function toggleFiltroBadge(btn, tipo, valor) {
    const index = FILTROS_ACTIVOS[tipo].indexOf(valor);
    if (index > -1) {
        FILTROS_ACTIVOS[tipo].splice(index, 1);
        btn.classList.remove("bg-blue-600", "text-white", "border-blue-600");
    } else {
        FILTROS_ACTIVOS[tipo].push(valor);
        btn.classList.add("bg-blue-600", "text-white", "border-blue-600");
    }
    filtrarMatriz();
}

function limpiarFiltros() {
    FILTROS_ACTIVOS = { busqueda: "", estatus: [], ubicacion: "" };
    document.getElementById("input-busqueda").value = "";
    document.getElementById("filtro-ubicacion").value = "";
    document.querySelectorAll(".filter-badge").forEach(b => {
        b.classList.remove("bg-blue-600", "text-white", "border-blue-600");
    });
    renderizarMatriz(listaRegistrosPanel);
}

function filtrarMatriz() {
    const query = document.getElementById("input-busqueda").value.toLowerCase().trim();
    const ubicacion = document.getElementById("filtro-ubicacion").value;

    const filtrados = listaRegistrosPanel.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query) ||
            String(reg.Nombre_Taller || "").toLowerCase().includes(query) ||
            String(reg.Nombre_Taller_Ext || "").toLowerCase().includes(query) ||
            String(reg.ID_Registro || "").toLowerCase().includes(query);

        const matchesEstatus = FILTROS_ACTIVOS.estatus.length === 0 || FILTROS_ACTIVOS.estatus.includes(reg.Estatus);
        const matchesUbicacion = !ubicacion || reg.Nombre_Taller === ubicacion;

        return matchesBusqueda && matchesEstatus && matchesUbicacion;
    });

    renderizarMatriz(filtrados);
}

/**
 * Consulta y despliega la matriz operativa en tiempo real
 */
async function cargarTablaEditable() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr class="block md:table-row">
            <td colspan="7" class="block md:table-cell p-8 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]">
                <i class="fa-solid fa-spinner animate-spin mr-2 text-xs"></i> Interconectando con Base de Datos Central...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        
        const res = await response.json();
        if (res.status !== "SUCCESS") {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${escapeHTML(res.message)}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || res.unidades || [];
        
        listaRegistrosPanel = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                let val = u[key];
                if (typeof val === 'string' && val.includes('drive.google.com/uc?')) {
                    const id = val.split('id=')[1]?.split('&')[0];
                    if (id) val = `https://drive.google.com/thumbnail?id=${id}&sz=w1200`;
                }
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = val;
            }
            
            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            let tareasRaw = getV(["TAREAS", "CHECKLIST", "TAREA"]) || u["Tareas"] || "";
            let tareasArray = [];
            try {
                if (Array.isArray(tareasRaw)) {
                    tareasArray = tareasRaw;
                } else if (typeof tareasRaw === "object" && tareasRaw !== null) {
                    tareasArray = [tareasRaw];
                } else if (typeof tareasRaw === "string" && tareasRaw.trim()) {
                    tareasArray = JSON.parse(tareasRaw);
                }
            } catch(e) { 
                console.warn("No se pudo parsear tareas de string:", tareasRaw, e);
            }

            return {
                ID_Registro: getV(["IDREGISTRO", "REGISTRO"]) || u["ID_Registro"] || "S/I",
                ID_Unidad: getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "S/I",
                Nombre_Taller: getV(["NOMBRETALLER", "TALLER"]) || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: getV(["TALLEREXT"]) || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: getV(["OBSERVACIONES", "DETALLE", "NOVEDAD", "OBS"]) || u["Observaciones"] || "",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Avance: parseInt(getV(["AVANCE", "PORCENTAJE"]) || 0, 10),
                Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
                Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
                Fecha_Ingreso: getV(["FECHAING", "FECHA"]) || u["Fecha_Ingr"] || u["Fecha_Ingreso"] || "N/A",
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
                Gerencia: getV(["GERENCIA", "USUARIA"]) || u["Gerencia"] || "",
                Usuario: getV(["USUARIO", "CHOFER", "CONDUCTOR"]) || u["Usuario"] || "",
                Tareas: tareasArray
            };
        });

        localStorage.setItem(CLAVE_RESPALDO_MATRIZ, JSON.stringify(listaRegistrosPanel));
        if (typeof guardarMantenimientosLocalSeguro === 'function') {
            await guardarMantenimientosLocalSeguro(listaRegistrosPanel);
        }

        actualizarSelectGerencias();

        if (listaRegistrosPanel.length === 0) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen unidades activas en el historial.</td></tr>`;
            return;
        }

        renderizarMatriz(listaRegistrosPanel);

    } catch (err) {
        console.error("Error al cargar datos remotos, recurriendo a respaldo local:", err);
        
        let respaldoLocal = null;
        if (typeof obtenerMantenimientosLocalSeguro === 'function') {
            respaldoLocal = await obtenerMantenimientosLocalSeguro();
        }
        if (!respaldoLocal || respaldoLocal.length === 0) {
            const localStr = localStorage.getItem(CLAVE_RESPALDO_MATRIZ);
            if (localStr) respaldoLocal = JSON.parse(localStr);
        }

        if (respaldoLocal && respaldoLocal.length > 0) {
            listaRegistrosPanel = respaldoLocal;
            renderizarMatriz(listaRegistrosPanel);
            if (window.TTOCC_UI) {
                TTOCC_UI.warning("Modo Offline Activo", "Mostrando datos guardados localmente en caché.");
            }
        } else {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs">Error crítico de enlace de datos y sin respaldo local.</td></tr>`;
        }
    }
}

/**
 * Renderiza la matriz operativa con sanitización HTML
 */
function renderizarMatriz(datos) {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">Sin registros que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    const htmlFilas = [...datos].reverse().map(reg => {
        let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${escapeHTML(reg.Nombre_Taller_Ext)}` : escapeHTML(reg.Nombre_Taller);

        let badgeFotoAntes = reg.Foto_Antes
            ? `<a href="${escapeHTML(reg.Foto_Antes)}" target="_blank" class="pswp-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors text-[9px] font-bold flex items-center gap-1" data-pswp-width="1200" data-pswp-height="900"><i class="fa-solid fa-image"></i> Antes</a>`
            : '';

        let badgeFotoDespues = reg.Foto_Despues
            ? `<a href="${escapeHTML(reg.Foto_Despues)}" target="_blank" class="pswp-link text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors text-[9px] font-bold flex items-center gap-1" data-pswp-width="1200" data-pswp-height="900"><i class="fa-solid fa-circle-check"></i> Después</a>`
            : '';

        let badgeEstatus = `<span class="bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-500 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">⚠️ Por Atender</span>`;
        let colorFila = "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-950/40";

        if (reg.Estatus === "En Proceso") {
            badgeEstatus = `<span class="bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">⚙️ En Proceso</span>`;
            colorFila = "bg-blue-500/[0.02] dark:bg-blue-900/10 border-blue-500/10 dark:border-blue-500/20 hover:bg-blue-500/[0.05] dark:hover:bg-blue-900/20";
        } else if (reg.Estatus === "Listo" || reg.Estatus === "Reparado") {
            badgeEstatus = `<span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase">✅ Listo</span>`;
            colorFila = "bg-emerald-500/[0.02] dark:bg-emerald-900/10 border-emerald-500/10 dark:border-emerald-500/20 hover:bg-emerald-500/[0.05] dark:hover:bg-emerald-900/20";
        } else if (reg.Estatus === "Por Atender") {
            colorFila = "bg-amber-500/[0.02] dark:bg-amber-900/5 border-amber-500/10 dark:border-amber-500/20 hover:bg-amber-500/[0.05] dark:hover:bg-amber-900/10";
        }

        const regIdEscaped = escapeHTML(reg.ID_Registro);

        return `
             <tr id="fila-${regIdEscaped}"
    class="block md:table-row ${colorFila || 'bg-white dark:bg-transparent'} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">   
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 font-mono text-[10px] font-bold border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 transition-colors">ID Registro:</span>
                    <div class="text-right md:text-left">
                    <span class="text-slate-700 dark:text-slate-400 font-black tracking-widest transition-colors">${regIdEscaped}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 transition-colors">Unidad / Marca:</span>
                    <div class="text-right md:text-left">
                    <span class="font-black text-slate-900 dark:text-white tracking-wider font-mono block text-xs transition-colors">${escapeHTML(reg.ID_Unidad)}</span>
                    <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block tracking-wide transition-colors">${escapeHTML(reg.Marca)}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-right md:text-left text-slate-700 dark:text-slate-300 font-medium text-[11px] transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 transition-colors">Ubicación:</span>
                    <div>
                    <div class="font-semibold text-slate-800 dark:text-slate-200 transition-colors">${fosaFinal}</div>
                    <div class="flex gap-2 justify-end md:justify-start flex-wrap mt-0.5">${badgeFotoAntes} ${badgeFotoDespues}</div>
                    </div>
                 </td>
                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-500 uppercase text-[9px] font-black tracking-widest">Avance</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="font-mono text-[12px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">${reg.Avance}%</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none md:w-40 transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 transition-colors">Estatus</span>
                    <div class="flex justify-end md:justify-start">
                    ${badgeEstatus}
                    </div>
                </td>
                <td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto">
                <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1 block">Novedad</span>
                <p class="text-[11px] text-slate-600 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed" title="${escapeHTML(reg.Observaciones)}">
                ${escapeHTML(reg.Observaciones) || 'Sin novedades registradas.'}
                </p>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 md:w-28 text-center transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 transition-colors">Acciones</span>
    
                    <div class="flex gap-1.5 justify-end md:justify-center">
                    <button onclick="abrirModalEditar('${regIdEscaped}')"
                      class="bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-blue-500 dark:hover:border-blue-500 shadow-sm dark:shadow-md cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95" 
                        title="Planificación y Control Avanzado">
                        <i class="fa-solid fa-list-check"></i> <span class="md:hidden">Gestionar</span>
                    </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlFilas.join('');
}

function transformarABase64(file) {
    return new Promise((resolve, reject) => {
        if (!file) resolve("");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function actualizarSelectGerencias() {
    const opcionesBase = [
        "VP EYP TRANSPORTE TERRESTRE", "VP EYP SUBDIRECCION ADJUNTA DE PRODUCCION OCCIDENTE",
        "VP EYP SERVICIOS LOGISTICOS", "VP EYP SERVICIOS ELECTRICOS", "VP EYP SEGURIDAD INDUSTRIAL E HIGIENE OCUPACIONAL",
        "VP EYP RELACIONES GUBERNAMENTALES PROPIEDADES Y CATASTRO", "VP EYP RECURSOS HUMANOS", "VP EYP PROYECTOS MAYORES",
        "VP EYP PROYECTO UP INJ SOC CAMPO MENE DE ACOSTA", "VP EYP PROCURA Y CONTROL DE INVENTARIO",
        "VP EYP PLANIFICACION, PRESUPUESTO Y GESTION", "VP EYP PDVSA ECUADOR", "VP EYP OFICINA DE APOYO",
        "VP EYP INGENIERIA DE COSTOS", "VP EYP GERENCIA OPERACION INTEGRAL DE PLANTAS",
        "VP EYP GERENCIA CORP DE CONFIGURACION DE PLANES", "VP EYP FINANZAS", "VP EYP DIVISION SUR DEL LAGO TRUJILLO",
        "VP EYP DIVISION LAGO", "VP EYP DIVISION COSTA ORIENTAL DEL LAGO", "VP EYP DIVISION COSTA OCCIDENTAL DEL LAGO",
        "VP EYP DIRECCION EJECUTIVA DE PRODUCCION OCCIDENTE", "VP EYP DIRECCION ADJUNTA DE PRODUCCION OCCIDENTE",
        "VP EYP DESARROLLO SOCIAL", "VP EYP COSTA AFUERA", "VP EYP COORDINACION OPERACIONAL", "VP EYP CONTRATACION",
        "VP EYP CONFIABILIDAD OPERACIONAL", "VP EYP ASUNTOS PUBLICOS", "VP EYP ASUNTOS JURIDICOS", "VP EYP AMBIENTE",
        "VICEPRESIDENCIA EXPLORACION Y PRODUCCION", "PETROQUIMICA DE VENEZUELA, S.A", "PETROLEOS DE VENEZUELA S.A. YACIMIENTO",
        "PDVSA VASSA", "PDVSA SERVICIOS PETROLEROS S.A.", "PDVSA INGENIERIA Y CONSTRUCCION", "PDVSA INDUSTRIAL",
        "PDVSA GAS COMUNAL, S.A", "PDVSA GAS", "PDVSA ENT", "PDV SERVICIOS DE SALUD", "MINPET", "INTEVEP",
        "EM PETROZAMORA", "EM PETROWAYU", "EM PETROWARAO", "EM PETROURDANETA", "EM PETROREGIONAL DEL LAGO",
        "EM PETROQUIRIQUIRE", "EM PETROPERIJA", "EM PETROLERA SINOVENEZOLANA", "EM PETROLERA BIELOVENEZOLANA",
        "EM PETROINDEPENDIENTE", "EM PETROCUMAREBO", "EM PETROCABIMAS", "EM PETROBOSCAN", "EM LAGOPETROL",
        "EM BARIPETROL", "DIRECCION EJECUTIVA CYSN", "DIREC EJEC EXPLOR Y ESTUDIOS INTEG Y YAC",
        "DIR. EJECUTIVA DE SEGURIDAD INTEGRAL", "CVP EEMM OCCIDENTE", "CVP", "BARIVEN"
    ];

    const gerenciasDeDatos = listaRegistrosPanel
        .map(r => String(r.Gerencia || "").trim().toUpperCase())
        .filter(g => g !== "");

    const todasGerencias = [...new Set([...opcionesBase, ...gerenciasDeDatos])].sort();
    const data = todasGerencias.map(g => ({ id: g, text: g }));

    if (typeof $ !== 'undefined') {
        $('#add-gerencia, #edit-gerencia').each(function() {
            const $el = $(this);
            const val = $el.val();
            $el.empty().select2({
                placeholder: 'Seleccione o escriba...',
                tags: true,
                data: data,
                dropdownParent: $el.closest('.fixed')
            }).val(val).trigger('change');
        });
    }
}

/**
 * CONTROLADORES DE MODAL 1: NUEVO INGRESO
 */
function abrirModalNuevo() {
    document.getElementById("formNuevoRegistro").reset(); 
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = String(ahora.getMonth() + 1).padStart(2, '0');
    const dia = String(ahora.getDate()).padStart(2, '0');
    const horas = String(ahora.getHours()).padStart(2, '0');
    const minutos = String(ahora.getMinutes()).padStart(2, '0');
    const valorDefecto = `${anio}-${mes}-${dia}T${horas}:${minutos}`;

    document.getElementById("add-fecha-ingreso").value = valorDefecto;
    document.getElementById("wrapper-externo").classList.add("hidden"); 
    limpiarPrevia('add-foto-antes', 'preview-add-antes');
    document.getElementById("modalNuevoRegistro").classList.remove("hidden");
}

function cerrarModalNuevo() {
    document.getElementById("modalNuevoRegistro").classList.add("hidden");
}

function alternarTallerExterno(valor) {
    document.getElementById("wrapper-externo").classList.toggle("hidden", valor !== "TALLER EXTERNO (Terceros)");
}

function previsualizarImagen(input, idContenedor) {
    if (window.TTOCC_UI_UTILS && typeof window.TTOCC_UI_UTILS.previsualizarImagen === 'function') {
        return window.TTOCC_UI_UTILS.previsualizarImagen(input, idContenedor);
    }
    // Fallback: original behavior if util not loaded
    const container = document.getElementById(idContenedor);
    if (!container) return;
    const img = container.querySelector("img");

    if (input.files && input.files[0]) {
        const valRes = typeof validarArchivoAdjunto === 'function' ? validarArchivoAdjunto(input.files[0]) : { valido: true };
        if (!valRes.valido) {
            if (window.TTOCC_UI && typeof TTOCC_UI.error === 'function') {
                TTOCC_UI.error("Archivo no válido", valRes.mensaje);
            }
            input.value = "";
            if (img) img.src = "";
            container.classList.add("hidden");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (img) img.src = e.result;
            container.classList.remove("hidden");
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        if (img) img.src = "";
        container.classList.add("hidden");
    }
}

function limpiarPrevia(idInput, idContenedor) {
    if (window.TTOCC_UI_UTILS && typeof window.TTOCC_UI_UTILS.limpiarPrevia === 'function') {
        return window.TTOCC_UI_UTILS.limpiarPrevia(idInput, idContenedor);
    }
    const input = document.getElementById(idInput);
    if (input) input.value = "";
    const container = document.getElementById(idContenedor);
    if (container) {
        const img = container.querySelector("img");
        if (img) img.src = "";
        container.classList.add("hidden");
    }
}

async function guardarNuevoRegistro(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-crear-submit");
    const fileInput = document.getElementById("add-foto-antes");
    
    if (fileInput.files.length > 0) {
        const valRes = validarArchivoAdjunto(fileInput.files[0]);
        if (!valRes.valido) {
            TTOCC_UI.error("Archivo adjunto no válido", valRes.mensaje);
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Procesando Imagen...`;

    let fotoBase64 = "";
    if (fileInput.files.length > 0) {
        fotoBase64 = await transformarABase64(fileInput.files[0]);
    }

    let fechaRaw = document.getElementById("add-fecha-ingreso").value;
    let fechaFormateada = "";
    if(fechaRaw) {
        const [fechaParte, horaParte] = fechaRaw.split("T");
        if (fechaParte) {
            const parts = fechaParte.split("-");
            fechaFormateada = `${parts[2]}-${parts[1]}-${parts[0]}`;
            if (horaParte) {
                fechaFormateada += ` ${horaParte}`;
            }
        }
    }

    const payload = {
        accion: "crear",
        token: obtenerTokenSesion(),
        unidad: document.getElementById("add-unidad").value.trim(),
        marca: document.getElementById("add-marca").value.trim(),
        flota: document.getElementById("add-flota").value,
        nombre_taller: document.getElementById("add-taller").value,
        nombre_taller_ext: document.getElementById("add-taller-ext").value.trim(),
        gerencia: $('#add-gerencia').val(),
        usuario: document.getElementById("add-chofer").value.trim(),
        observaciones: document.getElementById("add-observa").value.trim(),
        fecha_ingreso: fechaFormateada,
        foto_antes_base64: fotoBase64,
        modificado_por: OPERADOR_ACTUAL
    };

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalNuevo();
        TTOCC_UI.warning("Sin Conexión", "El registro se guardó en la cola offline y se subirá automáticamente cuando vuelvas a tener internet.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
        return;
    }

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            cerrarModalNuevo();
            await cargarTablaEditable();
            TTOCC_UI.success("Registro Exitoso", "La unidad ha sido ingresada correctamente a la base de datos central.");
        } else {
            TTOCC_UI.error("Error de Servidor", res.message);
        }
    } catch (err) {
        console.warn("Fallo de red durante guardado. Encolando offline...", err);
        encolarPeticionOffline(payload);
        cerrarModalNuevo();
        TTOCC_UI.warning("Modo Offline Activado", "Error de comunicación. La solicitud fue encolada para respaldarse en la nube al conectarse.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
    }
}

/**
 * CONTROLADORES DE MODAL 2: DIAGNÓSTICO & CHECKLIST
 */
function abrirModalEditar(id) {
    const registro = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    if (!registro) return;

    limpiarPrevia('edit-foto-despues', 'preview-edit-despues');

    document.getElementById("edit-id-registro").value = registro.ID_Registro;
    document.getElementById("edit-unidad").value = registro.ID_Unidad;
    document.getElementById("edit-marca").value = registro.Marca;

    $('#edit-gerencia').val(registro.Gerencia).trigger('change');

    document.getElementById("edit-flota").value = registro.Tipo_Flota || "Liviana";
    document.getElementById("edit-chofer").value = registro.Usuario;
    document.getElementById("edit-observa").value = registro.Observaciones;
    document.getElementById("edit-estatus").value = registro.Estatus;

    tareasModalActual = Array.isArray(registro.Tareas) ? [...registro.Tareas] : [];
    
    renderizarTareasModal();
    document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modalEditarRegistro").classList.add("hidden");
}

function renderizarTareasModal() {
    const container = document.getElementById("edit-container-tareas");
    if (!container) return;

    if (tareasModalActual.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-600 italic py-2 text-center">No hay tareas de diagnóstico asignadas.</p>`;
    } else {
        const htmlArray = tareasModalActual.map((tarea, index) => {
            return `
                <div class="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800/60 gap-2 transition-colors">
                <label class="flex items-center gap-2 flex-1 cursor-pointer select-none">
                <input type="checkbox" ${tarea.hecho ? "checked" : ""} 
                onchange="alternarTareaModal(${index})"
               class="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer">
               <span class="text-xs ${tarea.hecho ? "line-through text-slate-400 dark:text-slate-500 font-medium" : "text-slate-700 dark:text-slate-200 font-medium"} truncate max-w-[280px]">
            ${escapeHTML(tarea.texto)}
            </span>
            </label>
            <button type="button" onclick="eliminarTareaModal(${index})" class="text-slate-400 dark:text-slate-600 hover:text-red-500 p-1 transition-colors">
            <i class="fa-solid fa-trash-can text-[10px]"></i>
            </button>
            </div>
            `;
        });
        container.innerHTML = htmlArray.join('');
    }
   
    let avanceCalculado = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceCalculado = Math.round((completadas / total) * 100);
    }

    const selectorEstatus = document.getElementById("edit-estatus");
    
    if (selectorEstatus) {
        if (tareasModalActual.length > 0 && avanceCalculado === 100) {
            selectorEstatus.value = "Listo";
        } 
        else if (avanceCalculado < 100 && (selectorEstatus.value === "Listo" || selectorEstatus.value === "Reparado")) {
            selectorEstatus.value = "En Proceso";
        }
        
        if (selectorEstatus.value === "Listo") {
            avanceCalculado = 100;
        }
    }
    
    actualizarInterfazAvanceModal(avanceCalculado);
}

function agregarTareaModal() {
    const input = document.getElementById("edit-nueva-tarea");
    if (!input) return;
    const texto = input.value.trim();
    if (!texto) return;

    tareasModalActual.push({ texto: texto, hecho: false });
    input.value = "";
    renderizarTareasModal();
}

function alternarTareaModal(index) {
    if (tareasModalActual[index]) {
        tareasModalActual[index].hecho = !tareasModalActual[index].hecho;
        renderizarTareasModal();
    }
}

function eliminarTareaModal(index) {
    tareasModalActual.splice(index, 1);
    renderizarTareasModal();
}

function evaluarEstatusModal(valor) {
    if (valor === "Listo") {
        actualizarInterfazAvanceModal(100);
    } else {
        renderizarTareasModal(); 
    }
}

function actualizarInterfazAvanceModal(porcentaje) {
    const lblAvance = document.getElementById("edit-lbl-avance-calculado");
    if (lblAvance) lblAvance.textContent = porcentaje + "%";
    
    const wrapperFoto = document.getElementById("wrapper-foto-despues");
    if (!wrapperFoto) return;

    if (porcentaje === 100) {
        wrapperFoto.classList.remove("hidden");
    } else {
        wrapperFoto.classList.add("hidden");
        const inputFoto = document.getElementById("edit-foto-despues");
        if (inputFoto) inputFoto.value = ""; 
    }
}

async function guardarEdicionModal(event) {
    event.preventDefault();
    const id = document.getElementById("edit-id-registro").value;
    const btn = document.getElementById("btn-editar-submit");
    const fileInput = document.getElementById("edit-foto-despues");
    
    if (fileInput && fileInput.files.length > 0) {
        const valRes = validarArchivoAdjunto(fileInput.files[0]);
        if (!valRes.valido) {
            TTOCC_UI.error("Archivo adjunto no válido", valRes.mensaje);
            return;
        }
    }

    const original = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    const estatus = document.getElementById("edit-estatus").value;
    
    let avanceFinal = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceFinal = Math.round((completadas / total) * 100);
    }
    if (estatus === "Listo") avanceFinal = 100;

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Actualizando registros...`;

    let fotoDespuesBase64 = "";
    let fotoDespuesUrl = "";
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (navigator.onLine && (typeof ensureSupabaseClient === 'function')) {
            try {
                const client = ensureSupabaseClient();
                if (client && window.TTOCC_SUPABASE_SYNC && typeof window.TTOCC_SUPABASE_SYNC.uploadFileToStorage === 'function') {
                    const path = `mantenimientos/${id}/${file.name}`;
                    const publicUrl = await window.TTOCC_SUPABASE_SYNC.uploadFileToStorage(client, 'ttocc-archivos', path, file);
                    if (publicUrl) {
                        fotoDespuesUrl = publicUrl;
                    } else {
                        fotoDespuesBase64 = await transformarABase64(file);
                    }
                } else {
                    fotoDespuesBase64 = await transformarABase64(file);
                }
            } catch (e) {
                console.warn('[Upload] Falló upload directo, usando base64 como fallback', e);
                fotoDespuesBase64 = await transformarABase64(file);
            }
        } else {
            fotoDespuesBase64 = await transformarABase64(file);
        }
    }

    let fechaSalidaStr = original ? original.Fecha_Salida : "";
    if (estatus === "Listo" && !fechaSalidaStr) {
        const hoy = new Date();
        fechaSalidaStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    }

    const payload = {
        accion: "editar",
        token: obtenerTokenSesion(),
        id_registro: id,
        id_unidad: original ? original.ID_Unidad : document.getElementById("edit-unidad").value,
        unidad: original ? original.ID_Unidad : document.getElementById("edit-unidad").value,
        nombre_taller: original ? original.Nombre_Taller : "Taller",
        nombre_taller_ext: original ? original.Nombre_Taller_Ext : "",
        fecha_ingreso: original ? original.Fecha_Registro : "",
        marca: document.getElementById("edit-marca").value.trim(),
        flota: document.getElementById("edit-flota").value,
        tipo_flota: document.getElementById("edit-flota").value,
        gerencia: $('#edit-gerencia').val(),
        usuario: document.getElementById("edit-chofer").value.trim(),
        observaciones: document.getElementById("edit-observa").value.trim(),
        estatus: estatus,
        avance: avanceFinal,
        tareas: JSON.stringify(tareasModalActual), 
        foto_antes: original ? original.Foto_Antes : "",
        foto_despues: original ? original.Foto_Despues : "",
        fecha_salida: fechaSalidaStr,
        modificado_por: OPERADOR_ACTUAL
    };

    if (fotoDespuesUrl) {
        payload.foto_despues = fotoDespuesUrl;
    } else {
        payload.foto_despues_base64 = fotoDespuesBase64;
    }

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        TTOCC_UI.warning("Sin Conexión", "La edición se guardó localmente. Se respaldará en la nube automáticamente al restablecerse la conexión.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
        return;
    }

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            cerrarModalEditar();
            await cargarTablaEditable();
            TTOCC_UI.success("Actualización Correcta", "Los cambios en el diagnóstico han sido sincronizados.");
        } else {
            TTOCC_UI.error("Error al Guardar", res.message);
        }
    } catch (err) {
        console.warn("Fallo de red en edición. Guardando en cola offline...", err);
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        TTOCC_UI.warning("Sin Conexión", "Cambios retenidos en dispositivo. Se sincronizarán en la nube al detectar internet.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    }
}

/**
 * ELIMINACIÓN DE REGISTROS
 */
async function confirmarEliminarRegistro() {
    const id = document.getElementById("edit-id-registro").value;
    const unidad = document.getElementById("edit-unidad").value;

    const confirmacion = await TTOCC_UI.confirm(
        "¿Eliminar Registro?",
        `Esta acción borrará la unidad ${escapeHTML(unidad)} (ID #${escapeHTML(id)}) de la base de datos y sus fotos en Drive.`,
        "Eliminar",
        "Cancelar"
    );

    if (!confirmacion) return;

    const confirmacionFinal = await TTOCC_UI.confirm(
        "Confirmación Final",
        "¿Está absolutamente seguro? Esta operación no se puede deshacer.",
        "SÍ, ELIMINAR",
        "VOLVER"
    );

    if (!confirmacionFinal) return;

    const modalContent = document.querySelector("#modalEditarRegistro > div");
    const originalContentHtml = modalContent.innerHTML;

    modalContent.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <i class="fa-solid fa-trash-can animate-bounce text-red-500 text-5xl mb-4"></i>
            <h3 class="text-white font-black uppercase tracking-widest">Eliminando Registro...</h3>
            <p class="text-slate-500 text-[10px] mt-2 uppercase tracking-tighter">Limpiando Base de Datos y Archivos en Drive</p>
        </div>
    `;

    const payload = {
        accion: "eliminar",
        token: obtenerTokenSesion(),
        id_registro: id,
        modificado_por: OPERADOR_ACTUAL
    };

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        modalContent.innerHTML = originalContentHtml;
        TTOCC_UI.warning("Eliminación Encolada", "Se procesará el borrado en cuanto se restablezca el acceso a la red.");
        return;
    }

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const res = await response.json();

        if (res.status === "SUCCESS") {
            cerrarModalEditar();
            setTimeout(() => { modalContent.innerHTML = originalContentHtml; }, 500);
            await cargarTablaEditable();
            TTOCC_UI.success("Registro Eliminado", "La unidad y sus archivos asociados han sido removidos con éxito.");
        } else {
            TTOCC_UI.error("Error al Eliminar", res.message);
            modalContent.innerHTML = originalContentHtml;
        }
    } catch (err) {
        console.warn("Fallo de red en borrado. Guardando en cola offline...", err);
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        modalContent.innerHTML = originalContentHtml;
        TTOCC_UI.warning("Sin Conexión", "La eliminación se enviará automáticamente al reconectarse a internet.");
    }
}
