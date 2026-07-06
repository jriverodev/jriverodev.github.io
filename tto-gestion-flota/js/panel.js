// js/panel.js - Controlador Unificado de Patio, Edición Inline, Checklist Automatizado y Manejo de Imágenes en Base64

document.addEventListener("DOMContentLoaded", () => {
    verificarSesion();
    // initTheme(); // Ahora manejado por tema.js
    cargarTablaEditable();
    // Esperar un breve instante para asegurar que Select2 esté disponible si hay latencia en carga defer
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
var OPERADOR_ACTUAL = "";
var FILTROS_ACTIVOS = {
    busqueda: "",
    estatus: [],
    ubicacion: ""
};

// Base de datos de usuarios autorizados
const USUARIOS_AUTORIZADOS = {
    "WILLIAM RIOS": "wr123", 
    "VANNESA ROMERO": "vr456",
    "PEDRO POLANCO": "pp789"
};

/**
 * Lógica de Identificación y Auditoría
 */
function verificarSesion() {
    const sesion = sessionStorage.getItem("TTOCC_OPERADOR");
    if (sesion) {
        OPERADOR_ACTUAL = sesion;
        window.operadorActivo = sesion;
        document.getElementById("modalIdentificacion").classList.add("hidden");
    }
}

function confirmarIdentidad(event) {
    event.preventDefault();

    const selectOperador = document.getElementById('input-operador');
    const inputPassword = document.getElementById('input-password');
    const divError = document.getElementById('error-identificacion');

    if (!selectOperador || !inputPassword) return;

    // Sanitización estricta contra inyección de código
    const operadorSanitizado = selectOperador.value.toUpperCase().replace(/[^A-Z ]/g, "");
    const passwordSanitizado = inputPassword.value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    // Validación de credenciales
    if (USUARIOS_AUTORIZADOS[operadorSanitizado] && USUARIOS_AUTORIZADOS[operadorSanitizado] === passwordSanitizado) {
        OPERADOR_ACTUAL = operadorSanitizado;
        window.operadorActivo = operadorSanitizado; 
        sessionStorage.setItem("TTOCC_OPERADOR", operadorSanitizado);
        
        if (divError) divError.classList.add('hidden');
        document.getElementById('modalIdentificacion').classList.add('hidden');
        
        console.log(`Acceso concedido a: ${operadorSanitizado}`);

    } else {
        if (divError) divError.classList.remove('hidden');
        inputPassword.value = ''; 
        inputPassword.focus();
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
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.message}</td></tr>`;
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
                if (tareasRaw) {
                    tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
                }
            } catch(e) { 
                console.error("Error parseando JSON de tareas en registro", e); 
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

        actualizarSelectGerencias();

        if (listaRegistrosPanel.length === 0) {
            tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen unidades activas en el historial.</td></tr>`;
            return;
        }

        renderizarMatriz(listaRegistrosPanel);

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-red-500 font-bold text-xs">Error crítico de enlace de datos.</td></tr>`;
    }
}

/**
 * Renderiza la matriz operativa basándose en un set de datos
 */
function renderizarMatriz(datos) {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    if (datos.length === 0) {
        tbody.innerHTML = `<tr class="block md:table-row"><td colspan="7" class="block md:table-cell p-6 text-center text-slate-500 text-xs font-bold uppercase">Sin registros que coincidan con la búsqueda.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    [...datos].reverse().forEach(reg => {
        let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;

        let badgeFotoAntes = reg.Foto_Antes
            ? `<a href="${reg.Foto_Antes}" target="_blank" class="pswp-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors text-[9px] font-bold flex items-center gap-1" data-pswp-width="1200" data-pswp-height="900"><i class="fa-solid fa-image"></i> Antes</a>`
            : '';

        let badgeFotoDespues = reg.Foto_Despues
            ? `<a href="${reg.Foto_Despues}" target="_blank" class="pswp-link text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors text-[9px] font-bold flex items-center gap-1" data-pswp-width="1200" data-pswp-height="900"><i class="fa-solid fa-circle-check"></i> Después</a>`
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

        let filaHtml = `
            <tr id="fila-${reg.ID_Registro}" class="block md:table-row ${colorFila} md:bg-transparent border md:border-b md:border-slate-200 dark:md:border-slate-800/20 rounded-xl mb-3 md:mb-0 p-3 md:p-0 transition-colors shadow-sm dark:shadow-none">
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 text-slate-400 dark:text-slate-500 font-mono text-[10px] font-bold border-b border-slate-100 dark:border-slate-800/30 md:border-none">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">ID Registro:</span>
                    <span>${reg.ID_Registro}</span>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Unidad / Marca:</span>
                    <div class="text-right md:text-left">
                        <span class="font-black text-slate-900 dark:text-white tracking-wider font-mono block text-xs">${reg.ID_Unidad}</span>
                        <span class="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block tracking-wide">${reg.Marca}</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-right md:text-left text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Ubicación:</span>
                    <div>
                        <div class="font-semibold text-slate-800 dark:text-slate-300">${fosaFinal}</div>
                        <div class="flex gap-2 justify-end md:justify-start flex-wrap mt-0.5">${badgeFotoAntes} ${badgeFotoDespues}</div>
                     </div>
                </td>
                 <td class="flex justify-between items-center md:table-cell p-2 md:p-4 border-b md:border-b-0 border-slate-800/20">
                    <span class="md:hidden text-slate-500 uppercase text-[9px] font-black tracking-widest">Avance</span>
                    <div class="flex items-center justify-end md:justify-start">
                        <span class="font-mono text-[12px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">${reg.Avance}%</span>
                    </div>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none md:w-40">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Estatus</span>
                    <div class="flex justify-end md:justify-start">
                        ${badgeEstatus}
                    </div>
                </td>
                <td class="flex flex-col md:table-cell p-2 md:p-1.5 border-b border-slate-100 dark:border-slate-800/30 md:border-none text-left min-w-0 w-full md:w-auto">
                <span class="md:hidden text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-1 block">Novedad</span>
                <p class="text-[11px] text-slate-600 dark:text-slate-300 font-medium break-words whitespace-normal normal-case block leading-relaxed" title="${reg.Observaciones}">
                ${reg.Observaciones || 'Sin novedades registradas.'}
                </p>
                </td>
                <td class="flex justify-between items-center md:table-cell p-2 md:p-1.5 md:w-28 text-center">
                    <span class="md:hidden text-[10px] uppercase font-bold text-slate-400">Acciones</span>
                    <div class="flex gap-1.5 justify-end md:justify-center">
                        <button onclick="abrirModalEditar('${reg.ID_Registro}')" class="bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white p-1.5 rounded-lg transition-all border border-slate-700/60 hover:border-blue-500 shadow-md cursor-pointer flex items-center gap-1 text-[10px] font-bold" title="Planificación y Control Avanzado">
                            <i class="fa-solid fa-list-check"></i> <span class="md:hidden">Gestionar</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML("beforeend", filaHtml);
    });
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
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("add-fecha-ingreso").value = hoy;
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
    const container = document.getElementById(idContenedor);
    if (!container) return;
    const img = container.querySelector("img");

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            container.classList.remove("hidden");
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        img.src = "";
        container.classList.add("hidden");
    }
}

function limpiarPrevia(idInput, idContenedor) {
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
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Procesando Imagen...`;

    let fotoBase64 = "";
    if (fileInput.files.length > 0) {
        fotoBase64 = await transformarABase64(fileInput.files[0]);
    }

    let fechaRaw = document.getElementById("add-fecha-ingreso").value;
    let fechaFormateada = "";
    if(fechaRaw) {
        const parts = fechaRaw.split("-");
        fechaFormateada = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const payload = {
        accion: "crear",
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
        console.error(err);
        TTOCC_UI.error("Fallo de Red", "No se pudo establecer comunicación con el servidor. Verifique su conexión.");
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
    container.innerHTML = "";

    if (tareasModalActual.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-600 italic py-2 text-center">No hay tareas de diagnóstico asignadas.</p>`;
    } else {
        tareasModalActual.forEach((tarea, index) => {
            const itemHtml = `
                <div class="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60 gap-2 transition-colors">
                    <label class="flex items-center gap-2 flex-1 cursor-pointer select-none">
                        <input type="checkbox" ${tarea.hecho ? "checked" : ""} 
                               onchange="alternarTareaModal(${index})"
                               class="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer">
                        <span class="text-xs ${tarea.hecho ? "line-through text-slate-400 dark:text-slate-500 font-medium" : "text-slate-100 dark:text-slate-200 font-medium"} truncate max-w-[280px]">
                            ${tarea.texto}
                        </span>
                    </label>
                    <button type="button" onclick="eliminarTareaModal(${index})" class="text-slate-500 dark:text-slate-600 hover:text-red-400 p-1 transition-colors">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", itemHtml);
        });
    }
    
    // 1. Calcular el avance real según las tareas
    let avanceCalculado = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceCalculado = Math.round((completadas / total) * 100);
    }

    const selectorEstatus = document.getElementById("edit-estatus");
    
    if (selectorEstatus) {
        // 2. Si el avance llegó a 100% de forma natural, asegurar que pase a "Listo"
        if (tareasModalActual.length > 0 && avanceCalculado === 100) {
            selectorEstatus.value = "Listo";
        } 
        // 3. ¡La clave! Si el usuario desmarcó una tarea y el estatus quedó huérfano en "Listo"
        else if (avanceCalculado < 100 && (selectorEstatus.value === "Listo" || selectorEstatus.value === "Reparado")) {
            selectorEstatus.value = "En Proceso";
        }
        
        // 4. Si el operador fuerza manualmente "Listo" sin tareas, el avance se da por completado
        if (selectorEstatus.value === "Listo") {
            avanceCalculado = 100;
        }
    }
    
    // 5. Actualizar los gráficos y la visibilidad de la foto "Después"
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
    if (fileInput && fileInput.files.length > 0) {
        fotoDespuesBase64 = await transformarABase64(fileInput.files[0]);
    }

    let fechaSalidaStr = original ? original.Fecha_Salida : "";
    if (estatus === "Listo" && !fechaSalidaStr) {
        const hoy = new Date();
        fechaSalidaStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    }

    const payload = {
        accion: "editar",
        id_registro: id,
        marca: document.getElementById("edit-marca").value.trim(),
        flota: document.getElementById("edit-flota").value,
        gerencia: $('#edit-gerencia').val(),
        usuario: document.getElementById("edit-chofer").value.trim(),
        observaciones: document.getElementById("edit-observa").value.trim(),
        estatus: estatus,
        avance: avanceFinal.toString(),
        tareas: JSON.stringify(tareasModalActual), 
        foto_antes: original ? original.Foto_Antes : "",
        foto_despues: original ? original.Foto_Despues : "", 
        foto_despues_base64: fotoDespuesBase64, 
        fecha_salida: fechaSalidaStr,
        modificado_por: OPERADOR_ACTUAL
    };

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
        console.error(err);
        TTOCC_UI.error("Error Crítico", "Fallo de comunicación durante la sincronización de datos.");
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
        `Esta acción borrará la unidad ${unidad} (ID #${id}) de la base de datos y sus fotos en Drive.`,
        "Eliminar",
        "Cancelar"
    );

    if (!confirmacion) return;

    // Segundo paso de seguridad para acciones críticas
    const confirmacionFinal = await TTOCC_UI.confirm(
        "Confirmación Final",
        "¿Está absolutamente seguro? Esta operación no se puede deshacer.",
        "SÍ, ELIMINAR",
        "VOLVER"
    );

    if (!confirmacionFinal) return;

    const modalContent = document.querySelector("#modalEditarRegistro > div");
    const originalContentHtml = modalContent.innerHTML;

    // Bloqueo visual del modal durante la eliminación
    modalContent.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center">
            <i class="fa-solid fa-trash-can animate-bounce text-red-500 text-5xl mb-4"></i>
            <h3 class="text-white font-black uppercase tracking-widest">Eliminando Registro...</h3>
            <p class="text-slate-500 text-[10px] mt-2 uppercase tracking-tighter">Limpiando Base de Datos y Archivos en Drive</p>
        </div>
    `;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({
                accion: "eliminar",
                id_registro: id,
                modificado_por: OPERADOR_ACTUAL
            })
        });

        const res = await response.json();

        if (res.status === "SUCCESS") {
            cerrarModalEditar();
            // Restaurar el contenido original para el siguiente uso del modal
            setTimeout(() => { modalContent.innerHTML = originalContentHtml; }, 500);
            await cargarTablaEditable();
            TTOCC_UI.success("Registro Eliminado", "La unidad y sus archivos asociados han sido removidos con éxito.");
        } else {
            TTOCC_UI.error("Error al Eliminar", res.message);
            modalContent.innerHTML = originalContentHtml;
        }
    } catch (err) {
        console.error(err);
        TTOCC_UI.error("Error de Red", "No se pudo completar la eliminación debido a un fallo de conexión.");
        modalContent.innerHTML = originalContentHtml;
    }
}
