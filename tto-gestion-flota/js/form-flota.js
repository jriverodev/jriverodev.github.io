// js/form-flota.js - Controlador Unificado de Administración de Flota / Maestro de Activos
"use strict";

document.addEventListener("DOMContentLoaded", () => {
    verificarSesion();
    cargarTablaActivos();

    // Sincronizar cola offline al volver a tener red
    window.addEventListener("online", procesarColaOffline);

    const inputBusqueda = document.getElementById("input-busqueda");
    if (inputBusqueda) {
        inputBusqueda.addEventListener("input", debounce(filtrarActivos, 250));
    }
});

// Almacenes de control en memoria global
var listaActivosGlobal = [];
var mapaUltimoTaller = {};
var OPERADOR_ACTUAL = "";
var FILTROS_ACTIVOS = {
    busqueda: "",
    flota: ""
};
var documentoEliminarFlag = false;

const CLAVE_COLA_OFFLINE_FLOTA = "TTOCC_COLA_PETICIONES_OFFLINE_FLOTA";
const CLAVE_RESPALDO_FLOTA = "TTOCC_RESPALDO_LOCAL_FLOTA";

function encolarPeticionOffline(payload) {
    if (typeof encolarOperacionOffline === 'function') {
        encolarOperacionOffline("flota_op", payload, CLAVE_COLA_OFFLINE_FLOTA);
        return;
    }
    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA_OFFLINE_FLOTA) || "[]");
    cola.push({
        id: Date.now(),
        fecha: new Date().toISOString(),
        payload: payload
    });
    localStorage.setItem(CLAVE_COLA_OFFLINE_FLOTA, JSON.stringify(cola));
}

async function procesarColaOffline() {
    if (!navigator.onLine) return;
    if (typeof procesarSincronizacionPendiente === 'function') {
        await procesarSincronizacionPendiente(CLAVE_COLA_OFFLINE_FLOTA);
        await cargarTablaActivos();
        return;
    }

    const cola = JSON.parse(localStorage.getItem(CLAVE_COLA_OFFLINE_FLOTA) || "[]");
    if (cola.length === 0) return;

    if (window.TTOCC_UI) {
        TTOCC_UI.info("Sincronizando...", `Enviando ${cola.length} operación(es) de activos guardada(s) sin conexión.`);
    }

    const colaPendiente = [...cola];
    localStorage.setItem(CLAVE_COLA_OFFLINE_FLOTA, JSON.stringify([]));

    for (const item of colaPendiente) {
        try {
            const payloadConToken = Object.assign({}, item.payload, { token: obtenerTokenSesion() });
            const response = await fetch(APP_CONFIG.URL_API, {
                method: "POST",
                body: JSON.stringify(payloadConToken)
            });
            const res = await response.json();
            if (res.status !== "SUCCESS") {
                console.error("Fallo reintentando petición offline de activos:", item, res);
            }
        } catch (e) {
            console.error("Error crítico retransmitiendo activos offline:", e);
            encolarPeticionOffline(item.payload);
        }
    }

    await cargarTablaActivos();
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
                body: JSON.stringify({ accion: "validar_token", token: token })
            });
            const data = await res.json();
            if (data.status === "SUCCESS" && data.valido) {
                OPERADOR_ACTUAL = data.usuario || sesionUser;
                document.getElementById("modalIdentificacion").classList.add("hidden");
                return;
            }
        } catch (e) {
            console.warn("No se pudo validar token en backend. Manteniendo estado local.", e);
            OPERADOR_ACTUAL = sesionUser;
            document.getElementById("modalIdentificacion").classList.add("hidden");
            return;
        }
    }

    cerrarSesion();
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

    if (!operadorSanitizado || !passwordSanitizado) return;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({
                accion: "login",
                usuario: operadorSanitizado,
                password: passwordSanitizado
            })
        });

        const res = await response.json();

        if (res.status === "SUCCESS" && res.token) {
            guardarSesion(res.token, res.usuario);
            OPERADOR_ACTUAL = res.usuario;

            if (divError) divError.classList.add('hidden');
            document.getElementById('modalIdentificacion').classList.add('hidden');

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
            divError.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1"></i> Error de conexión con el servidor.`;
            divError.classList.remove('hidden');
        }
    }
}

/**
 * Lógica de Búsqueda y Filtros
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
    if (FILTROS_ACTIVOS[tipo] === valor) {
        FILTROS_ACTIVOS[tipo] = "";
        btn.classList.remove("bg-emerald-600", "text-white", "border-emerald-600");
    } else {
        document.querySelectorAll(".filter-badge").forEach(b => {
            b.classList.remove("bg-emerald-600", "text-white", "border-emerald-600");
        });
        FILTROS_ACTIVOS[tipo] = valor;
        btn.classList.add("bg-emerald-600", "text-white", "border-emerald-600");
    }
    filtrarActivos();
}

function limpiarFiltros() {
    FILTROS_ACTIVOS = { busqueda: "", flota: "" };
    document.getElementById("input-busqueda").value = "";
    document.querySelectorAll(".filter-badge").forEach(b => {
        b.classList.remove("bg-emerald-600", "text-white", "border-emerald-600");
    });
    renderizarActivos(listaActivosGlobal);
}

function filtrarActivos() {
    const query = document.getElementById("input-busqueda").value.toLowerCase().trim();
    const flota = FILTROS_ACTIVOS.flota;

    const filtrados = listaActivosGlobal.filter(reg => {
        const matchesBusqueda = !query ||
            String(reg.ID_Unidad || "").toLowerCase().includes(query) ||
            String(reg.Placa || "").toLowerCase().includes(query) ||
            String(reg.Serial || "").toLowerCase().includes(query) ||
            String(reg.Marca || "").toLowerCase().includes(query) ||
            String(reg.Modelo || "").toLowerCase().includes(query) ||
            String(reg.Gerencia || "").toLowerCase().includes(query) ||
            String(reg.Responsable_Usuario || "").toLowerCase().includes(query);

        const matchesFlota = !flota || reg.Tipo_Flota === flota;

        return matchesBusqueda && matchesFlota;
    });

    renderizarActivos(filtrados);
}

/**
 * Obtiene el historial de registros de taller para calcular el último taller visitado por cada unidad
 */
async function obtenerMapaUltimoTaller() {
    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            const historial = res.datos || res.unidades || [];
            const mapa = {};
            historial.forEach(item => {
                let normalized = {};
                for (let key in item) {
                    normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = item[key];
                }
                const getV = (terms) => {
                    const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                    return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
                };

                const idUnidad = (getV(["IDUNIDAD", "UNIDAD"]) || item["ID_Unidad"] || "").toUpperCase();
                const taller = getV(["NOMBRETALLER", "TALLER"]) || item["Nombre_Taller"] || "";
                const tallerExt = getV(["TALLEREXT"]) || item["Nombre_Taller_Ext"] || "";
                const tallerFinal = taller === "TALLER EXTERNO (Terceros)" && tallerExt ? `EXT: ${tallerExt}` : taller;
                const fecha = getV(["FECHAING", "FECHA"]) || item["Fecha_Ingr"] || item["Fecha_Ingreso"] || "";

                if (idUnidad) {
                    mapa[idUnidad] = tallerFinal ? `${tallerFinal} (${fecha || 'S/F'})` : "Sin Historial Taller";
                }
            });
            mapaUltimoTaller = mapa;
        }
    } catch (e) {
        console.warn("No se pudo cargar historial de talleres para ubicación:", e);
    }
}

/**
 * Consulta y despliega la matriz de activos
 */
async function cargarTablaActivos() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `
        <tr class="block md:table-row">
            <td colspan="8" class="block md:table-cell p-8 text-center text-emerald-400 font-bold uppercase tracking-widest text-[10px]">
                <i class="fa-solid fa-spinner animate-spin mr-2 text-xs"></i> Interconectando con Base de Datos Central...
            </td>
        </tr>
    `;

    await obtenerMapaUltimoTaller();

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer_activos" })
        });

        const res = await response.json();
        if (res.status !== "SUCCESS") {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="8" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${escapeHTML(res.message)}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || [];

        listaActivosGlobal = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }

            const getV = (terms) => {
                const key = Object.keys(normalized).find(k => terms.some(t => k.includes(t)));
                return (key !== undefined && normalized[key] !== null) ? normalized[key] : "";
            };

            const idUnidad = getV(["IDUNIDAD", "UNIDAD"]) || u["ID_Unidad"] || "S/I";
            const idKey = idUnidad.toUpperCase();

            return {
                ID_Unidad: idUnidad,
                Placa: getV(["PLACA"]) || u["Placa"] || "S/I",
                Serial: getV(["SERIAL"]) || u["Serial"] || "S/I",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Modelo: normalized["MODELO"] || u["Modelo"] || "",
                Color: normalized["COLOR"] || u["Color"] || "",
                Tipo_Vehiculo: getV(["TIPOVEHICULO", "TIPOVEH", "CLASE"]) || u["Tipo_Vehiculo"] || "",
                Tipo_Flota: getV(["TIPOFLOTA", "FLOTA"]) || u["Tipo_Flota"] || "Liviana",
                Estatus_Final: getV(["ESTATUSFINAL", "ESTATUS"]) || u["Estatus_Final"] || "",
                Situacion_Actual: getV(["SITUACIONACTUAL", "SITUACION"]) || u["Situacion_Actual"] || "",
                Gerencia: getV(["GERENCIA"]) || u["Gerencia"] || "",
                Responsable_Usuario: getV(["RESPONSABLEUSUARIO", "RESPONSABLE", "USUARIO"]) || u["Responsable_Usuario"] || "",
                Cargo_Usuario: getV(["CARGOUSUARIO", "CARGO"]) || u["Cargo_Usuario"] || "",
                Ubicacion_Taller: mapaUltimoTaller[idKey] || getV(["UBICACIONTALLER", "UBICACION"]) || u["Ubicacion_Taller"] || "Sin Historial Taller",
                Documento_Url: getV(["DOCUMENTO", "DOC", "PDF"]) || u["Documento_Url"] || ""
            };
        });

        localStorage.setItem(CLAVE_RESPALDO_FLOTA, JSON.stringify(listaActivosGlobal));
        if (typeof guardarActivosLocalSeguro === 'function') {
            await guardarActivosLocalSeguro(listaActivosGlobal);
        }

        if (listaActivosGlobal.length === 0) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="8" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen activos registrados.</td></tr>`;
            return;
        }

        renderizarActivos(listaActivosGlobal);

    } catch (err) {
        console.error("Error al cargar activos remotos, recurriendo a respaldo local:", err);

        let respaldoLocal = null;
        if (typeof obtenerActivosLocalSeguro === 'function') {
            respaldoLocal = await obtenerActivosLocalSeguro();
        }
        if (!respaldoLocal || respaldoLocal.length === 0) {
            const localStr = localStorage.getItem(CLAVE_RESPALDO_FLOTA);
            if (localStr) respaldoLocal = JSON.parse(localStr);
        }

        if (respaldoLocal && respaldoLocal.length > 0) {
            listaActivosGlobal = respaldoLocal;
            renderizarActivos(listaActivosGlobal);
            if (window.TTOCC_UI) {
                TTOCC_UI.warning("Modo Offline Activo", "Mostrando activos guardados localmente.");
            }
        } else {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="8" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs">Error de enlace y sin respaldo local.</td></tr>`;
        }
    }
}

/**
 * Renderiza la lista de activos con sanitización y enlace a documento
 */
function renderizarActivos(datos) {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="8" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">Sin activos que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    const htmlFilas = [...datos].reverse().map(reg => {
        let colorFila = "bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-950/20";

        let badgeDocumento = reg.Documento_Url
            ? `<a href="${escapeHTML(reg.Documento_Url)}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-[9px] font-black uppercase tracking-wider hover:underline transition-all">
                <i class="fa-solid fa-file-pdf"></i> Ver / Descargar
               </a>`
            : `<span class="text-[9px] text-slate-400 dark:text-slate-600 italic">Sin Documento</span>`;

        const idEscaped = escapeHTML(reg.ID_Unidad);

        return `
             <tr id="fila-${idEscaped}"
                 class="block md:table-row ${colorFila} border border-slate-200 dark:border-slate-800/40 md:border-none md:border-b md:border-slate-200 md:dark:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 shadow-sm dark:shadow-none transition-colors">

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 font-mono text-[11px] font-bold border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">ID Unidad:</span>
                    <span class="text-slate-800 dark:text-white font-black tracking-widest text-xs uppercase">${idEscaped}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 font-mono text-[11px] border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Placa / Serial:</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold uppercase block">${escapeHTML(reg.Placa)}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.Serial)}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Marca / Modelo:</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold text-xs uppercase block">${escapeHTML(reg.Marca)} ${escapeHTML(reg.Modelo)}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.Tipo_Vehiculo)} - ${escapeHTML(reg.Color)}</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Flota / Estatus:</span>
                    <div>
                        <span class="bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase inline-block mb-1">${escapeHTML(reg.Tipo_Flota)}</span>
                        <div class="text-[9px] font-bold text-slate-700 dark:text-slate-300 uppercase">${escapeHTML(reg.Estatus_Final || 'S/E')} - ${escapeHTML(reg.Situacion_Actual || 'S/S')}</div>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Gerencia / Usuario:</span>
                    <div>
                        <span class="text-slate-800 dark:text-slate-200 font-bold text-[10px] uppercase block">${escapeHTML(reg.Gerencia || 'SIN GERENCIA')}</span>
                        <span class="text-slate-500 dark:text-slate-400 text-[9px] uppercase block">${escapeHTML(reg.Responsable_Usuario || 'S/R')} (${escapeHTML(reg.Cargo_Usuario || 'S/C')})</span>
                    </div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Último Taller:</span>
                    <span class="text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase block">${escapeHTML(reg.Ubicacion_Taller)}</span>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b border-slate-100 dark:border-slate-800/30 md:border-none transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Documentación:</span>
                    <div>${badgeDocumento}</div>
                </td>

                <td class="flex justify-between items-center md:table-cell p-2 md:p-4 text-center transition-colors">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Acciones</span>
                    <div class="flex gap-1.5 justify-end md:justify-center">
                        <button onclick="abrirModalEditar('${idEscaped}')"
                          class="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 text-slate-700 dark:text-slate-300 hover:text-white dark:hover:text-white p-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-emerald-500 dark:hover:border-emerald-500 shadow-sm dark:shadow-md cursor-pointer flex items-center gap-1 text-[10px] font-bold transition-all active:scale-95"
                            title="Editar Activo Técnico">
                            <i class="fa-solid fa-pen-to-square"></i> <span class="md:hidden">Editar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlFilas.join('');
}

function previsualizarDocumento(input, idContenedor) {
    const container = document.getElementById(idContenedor);
    if (!container) return;

    if (input.files && input.files[0]) {
        const file = input.files[0];
        const valRes = validarArchivoAdjunto(file);
        if (!valRes.valido) {
            TTOCC_UI.error("Documento no válido", valRes.mensaje);
            input.value = "";
            container.classList.add("hidden");
            return;
        }

        const nombreSpan = container.querySelector("span");
        if (nombreSpan) nombreSpan.textContent = file.name;
        container.classList.remove("hidden");
    } else {
        container.classList.add("hidden");
    }
}

function limpiarPreviaDocumento(idInput, idContenedor) {
    const input = document.getElementById(idInput);
    if (input) input.value = "";
    const container = document.getElementById(idContenedor);
    if (container) container.classList.add("hidden");
}

function marcarEliminarDocumento() {
    documentoEliminarFlag = true;
    document.getElementById("wrapper-doc-actual").classList.add("hidden");
    TTOCC_UI.info("Documento Marcado", "El documento actual se eliminará al guardar los cambios.");
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

/**
 * CONTROLADORES DE MODAL 1: NUEVO ACTIVO
 */
function abrirModalNuevo() {
    document.getElementById("formNuevoRegistro").reset();
    limpiarPreviaDocumento('add-documento', 'preview-add-doc');
    document.getElementById("modalNuevoRegistro").classList.remove("hidden");
}

function cerrarModalNuevo() {
    document.getElementById("modalNuevoRegistro").classList.add("hidden");
}

async function guardarNuevoRegistro(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-crear-submit");
    const docInput = document.getElementById("add-documento");

    if (docInput && docInput.files.length > 0) {
        const valRes = validarArchivoAdjunto(docInput.files[0]);
        if (!valRes.valido) {
            TTOCC_UI.error("Documento no válido", valRes.mensaje);
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Guardando...`;

    let docBase64 = "";
    let docNombre = "";
    if (docInput && docInput.files.length > 0) {
        docBase64 = await transformarABase64(docInput.files[0]);
        docNombre = docInput.files[0].name;
    }

    const payload = {
        accion: "crear_activo",
        token: obtenerTokenSesion(),
        id_unidad: document.getElementById("add-unidad").value.trim().toUpperCase(),
        placa: document.getElementById("add-placa").value.trim().toUpperCase(),
        serial: document.getElementById("add-serial").value.trim().toUpperCase(),
        marca: document.getElementById("add-marca").value.trim().toUpperCase(),
        modelo: document.getElementById("add-modelo").value.trim().toUpperCase(),
        color: document.getElementById("add-color").value.trim().toUpperCase(),
        tipo_vehiculo: document.getElementById("add-tipo-vehiculo").value.trim().toUpperCase(),
        flota: document.getElementById("add-flota").value,
        estatus_final: document.getElementById("add-estatus-final").value.trim().toUpperCase(),
        situacion_actual: document.getElementById("add-situacion-actual").value.trim().toUpperCase(),
        gerencia: document.getElementById("add-gerencia").value.trim().toUpperCase(),
        responsable_usuario: document.getElementById("add-responsable-usuario").value.trim().toUpperCase(),
        cargo_usuario: document.getElementById("add-cargo-usuario").value.trim().toUpperCase(),
        documento_base64: docBase64,
        documento_nombre: docNombre,
        modificado_por: OPERADOR_ACTUAL
    };

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalNuevo();
        TTOCC_UI.warning("Sin Conexión", "El activo se guardó localmente. Se subirá automáticamente al recuperar internet.");
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Guardar Activo`;
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
            await cargarTablaActivos();
            TTOCC_UI.success("Activo Creado", "El vehículo ha sido registrado con éxito en el Maestro de Activos.");
        } else {
            TTOCC_UI.error("Error de Servidor", res.message);
        }
    } catch (err) {
        console.warn("Fallo de red al crear activo. Encolando offline...", err);
        encolarPeticionOffline(payload);
        cerrarModalNuevo();
        TTOCC_UI.warning("Modo Offline", "La solicitud fue guardada en el dispositivo.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Guardar Activo`;
    }
}

/**
 * CONTROLADORES DE MODAL 2: EDICIÓN DE ACTIVO
 */
function abrirModalEditar(idUnidad) {
    const reg = listaActivosGlobal.find(r => String(r.ID_Unidad) === String(idUnidad));
    if (!reg) return;

    documentoEliminarFlag = false;
    limpiarPreviaDocumento('edit-documento', 'preview-edit-doc');

    document.getElementById("edit-id-unidad").value = reg.ID_Unidad;
    document.getElementById("edit-placa").value = reg.Placa;
    document.getElementById("edit-serial").value = reg.Serial;
    document.getElementById("edit-marca").value = reg.Marca;
    document.getElementById("edit-modelo").value = reg.Modelo || "";
    document.getElementById("edit-color").value = reg.Color || "";
    document.getElementById("edit-tipo-vehiculo").value = reg.Tipo_Vehiculo || "";
    document.getElementById("edit-flota").value = reg.Tipo_Flota;
    document.getElementById("edit-estatus-final").value = reg.Estatus_Final || "";
    document.getElementById("edit-situacion-actual").value = reg.Situacion_Actual || "";
    document.getElementById("edit-gerencia").value = reg.Gerencia || "";
    document.getElementById("edit-responsable-usuario").value = reg.Responsable_Usuario || "";
    document.getElementById("edit-cargo-usuario").value = reg.Cargo_Usuario || "";
    document.getElementById("edit-ubicacion-taller").value = reg.Ubicacion_Taller || "Sin Historial Taller";

    const wrapperDoc = document.getElementById("wrapper-doc-actual");
    const linkDoc = document.getElementById("link-doc-actual");

    if (reg.Documento_Url) {
        linkDoc.href = reg.Documento_Url;
        wrapperDoc.classList.remove("hidden");
    } else {
        wrapperDoc.classList.add("hidden");
    }

    document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modalEditarRegistro").classList.add("hidden");
}

async function guardarEdicionModal(event) {
    event.preventDefault();
    const idUnidad = document.getElementById("edit-id-unidad").value;
    const btn = document.getElementById("btn-editar-submit");
    const docInput = document.getElementById("edit-documento");

    if (docInput && docInput.files.length > 0) {
        const valRes = validarArchivoAdjunto(docInput.files[0]);
        if (!valRes.valido) {
            TTOCC_UI.error("Documento no válido", valRes.mensaje);
            return;
        }
    }

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Guardando...`;

    let docBase64 = "";
    let docNombre = "";
    if (docInput && docInput.files.length > 0) {
        docBase64 = await transformarABase64(docInput.files[0]);
        docNombre = docInput.files[0].name;
    }

    const payload = {
        accion: "editar_activo",
        token: obtenerTokenSesion(),
        id_unidad: idUnidad,
        placa: document.getElementById("edit-placa").value.trim().toUpperCase(),
        serial: document.getElementById("edit-serial").value.trim().toUpperCase(),
        marca: document.getElementById("edit-marca").value.trim().toUpperCase(),
        modelo: document.getElementById("edit-modelo").value.trim().toUpperCase(),
        color: document.getElementById("edit-color").value.trim().toUpperCase(),
        tipo_vehiculo: document.getElementById("edit-tipo-vehiculo").value.trim().toUpperCase(),
        flota: document.getElementById("edit-flota").value,
        estatus_final: document.getElementById("edit-estatus-final").value.trim().toUpperCase(),
        situacion_actual: document.getElementById("edit-situacion-actual").value.trim().toUpperCase(),
        gerencia: document.getElementById("edit-gerencia").value.trim().toUpperCase(),
        responsable_usuario: document.getElementById("edit-responsable-usuario").value.trim().toUpperCase(),
        cargo_usuario: document.getElementById("edit-cargo-usuario").value.trim().toUpperCase(),
        documento_base64: docBase64,
        documento_nombre: docNombre,
        documento_eliminar: documentoEliminarFlag,
        modificado_por: OPERADOR_ACTUAL
    };

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        TTOCC_UI.warning("Sin Conexión", "La edición se guardó localmente. Se sincronizará automáticamente.");
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
            await cargarTablaActivos();
            TTOCC_UI.success("Activo Actualizado", "Los datos técnicos del vehículo han sido actualizados.");
        } else {
            TTOCC_UI.error("Error al Guardar", res.message);
        }
    } catch (err) {
        console.warn("Fallo de red en edición de activo. Encolando...", err);
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        TTOCC_UI.warning("Sin Conexión", "Cambios retenidos en dispositivo.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    }
}

/**
 * ELIMINACIÓN DE ACTIVOS
 */
async function confirmarEliminarRegistro() {
    const idUnidad = document.getElementById("edit-id-unidad").value;

    const confirmacion = await TTOCC_UI.confirm(
        "¿Eliminar Activo?",
        `Esta acción borrará definitivamente la unidad ${escapeHTML(idUnidad)} y sus documentos asociados del Maestro de Activos.`,
        "Eliminar",
        "Cancelar"
    );

    if (!confirmacion) return;

    const confirmacionFinal = await TTOCC_UI.confirm(
        "Confirmación Final",
        "¿Está seguro de querer remover este activo de la flota de manera permanente?",
        "SÍ, ELIMINAR",
        "VOLVER"
    );

    if (!confirmacionFinal) return;

    const modalContent = document.querySelector("#modalEditarRegistro > div");
    const originalContentHtml = modalContent.innerHTML;

    modalContent.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <i class="fa-solid fa-trash-can animate-bounce text-red-500 text-5xl mb-4"></i>
            <h3 class="text-white font-black uppercase tracking-widest">Eliminando Activo...</h3>
            <p class="text-slate-500 text-[10px] mt-2 uppercase tracking-tighter">Limpiando Base de Datos y Archivos en Drive</p>
        </div>
    `;

    const payload = {
        accion: "eliminar_activo",
        token: obtenerTokenSesion(),
        id_unidad: idUnidad,
        modificado_por: OPERADOR_ACTUAL
    };

    if (!navigator.onLine) {
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        modalContent.innerHTML = originalContentHtml;
        TTOCC_UI.warning("Eliminación Encolada", "Se procesará el borrado al restablecerse la conexión.");
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
            await cargarTablaActivos();
            TTOCC_UI.success("Activo Eliminado", "La unidad ha sido removida con éxito.");
        } else {
            TTOCC_UI.error("Error al Eliminar", res.message);
            modalContent.innerHTML = originalContentHtml;
        }
    } catch (err) {
        console.warn("Fallo de red en borrado. Encolando...", err);
        encolarPeticionOffline(payload);
        cerrarModalEditar();
        modalContent.innerHTML = originalContentHtml;
        TTOCC_UI.warning("Sin Conexión", "La eliminación se enviará automáticamente al reconectarse.");
    }
}
