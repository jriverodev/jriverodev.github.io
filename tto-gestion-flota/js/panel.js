// js/panel.js - Controlador Unificado de Patio, Edición Inline, Modales Múltiples y Procesamiento de Imágenes

document.addEventListener("DOMContentLoaded", cargarTablaEditable);

// Almacén local en memoria para mapear registros activos sin saturar de llamadas de lectura a la API
let listaRegistrosPanel = [];

/**
 * Carga y despliega la matriz editable consultando el Endpoint de Google Sheets
 */
async function cargarTablaEditable() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    // Render de precarga visual
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="p-8 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]">
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
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-xs"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || res.unidades || [];
        
        // Normalización estricta de llaves del JSON para blindar contra cambios de mayúsculas/minúsculas en los encabezados de la hoja
        listaRegistrosPanel = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }
            return {
                ID_Registro: normalized["IDREGISTRO"] || normalized["REGISTRO"] || u["ID_Registro"] || "S/I",
                ID_Unidad: normalized["IDUNIDAD"] || normalized["UNIDAD"] || u["ID_Unidad"] || "S/I",
                Nombre_Taller: normalized["NOMBRETALLER"] || normalized["TALLER"] || u["Nombre_Taller"] || "No especificado",
                Nombre_Taller_Ext: normalized["NOMBRETALLEREXT"] || normalized["TALLEREXTERNO"] || u["Nombre_Taller_Ext"] || "",
                Estatus: normalized["ESTATUS"] || u["Estatus"] || "Por Atender",
                Observaciones: normalized["OBSERVACIONES"] || normalized["DETALLE"] || u["Observaciones"] || "",
                Marca: normalized["MARCA"] || u["Marca"] || "",
                Avance: parseInt(normalized["AVANCE"] || normalized["PORCENTAJEAVANCE"] || 0, 10),
                Foto_Antes: normalized["FOTOANTES"] || u["Foto_Antes"] || "",
                Foto_Despues: normalized["FOTODESPUES"] || u["Foto_Despues"] || "",
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || ""
            };
        });

        if (listaRegistrosPanel.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen unidades activas en el historial.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        
        // Despliegue inverso (.reverse) para visualizar los ingresos más recientes al tope de la interfaz
        [...listaRegistrosPanel].reverse().forEach(reg => {
            let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
            
            // Render dinámico del indicador de foto guardada en el servidor
            let badgeFoto = reg.Foto_Antes 
                ? `<a href="${reg.Foto_Antes}" target="_blank" class="text-emerald-400 hover:text-emerald-300 transition-colors block text-[10px] font-bold mt-0.5"><i class="fa-solid fa-image-user mr-1"></i> Ver Foto Inicial</a>` 
                : '<span class="text-slate-600 block text-[9px] mt-0.5 italic">Sin Foto Evidencia</span>';

            let filaHtml = `
                <tr id="fila-${reg.ID_Registro}" class="hover:bg-slate-950/20 border-b border-slate-800/40 transition-colors">
                    <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${reg.ID_Registro}</td>
                    <td class="p-3">
                        <span class="font-black text-white tracking-wider font-mono block text-xs">${reg.ID_Unidad}</span>
                        <input type="text" id="inline-marca-${reg.ID_Registro}" value="${reg.Marca}" 
                               class="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-blue-500 px-0.5 py-0.5 text-[11px] text-slate-400 w-full focus:outline-none uppercase font-medium transition-all" placeholder="Escribir marca...">
                    </td>
                    <td class="p-3 text-slate-300 font-semibold text-[11px] tracking-wide">
                        <div>${fosaFinal}</div>
                        ${badgeFoto}
                    </td>
                    <td class="p-3">
                        <div class="flex items-center gap-2 bg-slate-950/40 p-1.5 rounded-xl border border-slate-800/50">
                            <input type="range" id="inline-avance-${reg.ID_Registro}" min="0" max="100" step="5" value="${reg.Avance}" 
                                   class="w-full accent-blue-500 h-1 rounded cursor-pointer"
                                   oninput="document.getElementById('lbl-avance-${reg.ID_Registro}').textContent = this.value + '%'">
                            <span id="lbl-avance-${reg.ID_Registro}" class="font-mono text-[10px] font-bold text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 w-11 text-center">${reg.Avance}%</span>
                        </div>
                    </td>
                    <td class="p-3">
                        <select id="inline-estatus-${reg.ID_Registro}" 
                                onchange="evaluarEstatusCambio('${reg.ID_Registro}', this.value)"
                                class="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 font-bold text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer transition-all">
                            <option value="Por Atender" ${reg.Estatus === "Por Atender" ? "selected" : ""}>⚠️ Por Atender</option>
                            <option value="En Proceso" ${reg.Estatus === "En Proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                            <option value="Listo" ${reg.Estatus === "Listo" || reg.Estatus === "Reparado" ? "selected" : ""}>✅ Listo</option>
                        </select>
                    </td>
                    <td class="p-2">
                        <input type="text" id="inline-observa-${reg.ID_Registro}" value="${reg.Observaciones}" 
                               class="w-full bg-slate-950/40 border border-slate-800/40 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-700 text-[11px] transition-all" placeholder="Añadir comentario o novedad de patio...">
                        <input type="hidden" id="inline-foto-antes-${reg.ID_Registro}" value="${reg.Foto_Antes}">
                        <input type="hidden" id="inline-foto-despues-${reg.ID_Registro}" value="${reg.Foto_Despues}">
                    </td>
                    <td class="p-2 text-center flex items-center justify-center gap-1.5 h-full">
                        <button onclick="guardarChangeInline('${reg.ID_Registro}')" id="btn-save-${reg.ID_Registro}"
                                class="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl transition-all border border-blue-500/20 cursor-pointer" title="Guardar cambios de la fila">
                            <i class="fa-solid fa-floppy-disk text-xs"></i>
                        </button>
                        <button onclick="abrirModalEditar('${reg.ID_Registro}')"
                                class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl transition-all border border-slate-700 cursor-pointer" title="Ajuste avanzado en formulario">
                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", filaHtml);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-xs">Error crítico de enlace de datos. Verifique consola.</td></tr>`;
    }
}

/**
 * Transforma un elemento de archivo binario (File) en una cadena DataURL Base64 asíncronamente
 */
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
 * Escucha selectores e incrementa automáticamente la barra al 100% si el operador marca la unidad como 'Listo'
 */
function evaluarEstatusCambio(id, valor) {
    if (valor === "Listo") {
        document.getElementById(`inline-avance-${id}`).value = 100;
        document.getElementById(`lbl-avance-${id}`).textContent = "100%";
    }
}

/**
 * Reopila y ejecuta el guardado directo e inline de la fila seleccionada
 */
async function guardarChangeInline(idRegistro) {
    const btn = document.getElementById(`btn-save-${idRegistro}`);
    const estatus = document.getElementById(`inline-estatus-${idRegistro}`).value;
    let avance = document.getElementById(`inline-avance-${idRegistro}`).value;
    
    let fechaSalidaStr = "";
    if (estatus === "Listo") {
        avance = "100";
        const hoy = new Date();
        fechaSalidaStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
    }

    const payload = {
        accion: "editar",
        id_registro: idRegistro,
        marca: document.getElementById(`inline-marca-${idRegistro}`).value.trim(),
        estatus: estatus,
        observaciones: document.getElementById(`inline-observa-${idRegistro}`).value.trim(),
        foto_antes: document.getElementById(`inline-foto-antes-${idRegistro}`).value,
        foto_despues: document.getElementById(`inline-foto-despues-${idRegistro}`).value,
        avance: avance,
        fecha_salida: fechaSalidaStr
    };

    ejecutarEnvioEdicion(payload, btn, idRegistro);
}

/**
 * Despacha los payloads de actualización hacia el servidor Apps Script
 */
async function ejecutarEnvioEdicion(payload, btn, idRegistro) {
    try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i>`;
        
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        
        if (res.status === "SUCCESS") {
            const fila = document.getElementById(`fila-${idRegistro}`);
            fila.classList.add("bg-emerald-950/30");
            btn.className = "bg-emerald-600 text-white p-2 rounded-xl transition-all";
            btn.innerHTML = `<i class="fa-solid fa-check text-xs"></i>`;
            
            setTimeout(() => {
                fila.classList.remove("bg-emerald-950/30");
                cargarTablaEditable(); // Recarga la matriz para acoplar las novedades visuales estructuradas
            }, 1000);
        } else {
            alert("Error del Servidor: " + res.message);
            recargarBotonOriginal(btn);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación de red con el servidor.");
        recargarBotonOriginal(btn);
    }
}

function recargarBotonOriginal(btn) {
    btn.disabled = false;
    btn.className = "bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl border border-blue-500/20";
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk text-xs"></i>`;
}

// ==========================================
// CONTROLADORES DE MODAL 1: NUEVO INGRESO
// ==========================================
function abrirModalNuevo() {
    document.getElementById("formNuevoRegistro").reset(); 
    
    // Autopoblar input tipo fecha con la fecha del calendario local (YYYY-MM-DD)
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("add-fecha-ingreso").value = hoy;
    
    document.getElementById("wrapper-externo").classList.add("hidden"); 
    document.getElementById("modalNuevoRegistro").classList.remove("hidden");
}

function cerrarModalNuevo() {
    document.getElementById("modalNuevoRegistro").classList.add("hidden");
}

function alternarTallerExterno(valor) {
    document.getElementById("wrapper-externo").classList.toggle("hidden", valor !== "TALLER EXTERNO (Terceros)");
}

/**
 * Procesa el envío del modal de registro, serializando la imagen opcional en base64
 */
async function guardarNuevoRegistro(event) {
    event.preventDefault();
    const btn = document.getElementById("btn-crear-submit");
    const fileInput = document.getElementById("add-foto-antes");
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Procesando datos e Imagen...`;

    let fotoBase64 = "";
    if (fileInput.files.length > 0) {
        fotoBase64 = await transformarABase64(fileInput.files[0]);
    }

    // Re-formatear fecha del estándar de input navegador (YYYY-MM-DD) al estándar de tu hoja (DD-MM-YYYY)
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
        observaciones: document.getElementById("add-observa").value.trim(),
        fecha_ingreso: fechaFormateada,
        foto_antes_base64: fotoBase64 // Despacho directo de cadena codificada
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
        } else {
            alert("Error detectado en servidor: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación al registrar entrada.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
    }
}

// ==========================================
// CONTROLADORES DE MODAL 2: FORMULARIO EDICIÓN AVANZADA
// ==========================================
function abrirModalEditar(id) {
    // Buscar los datos históricos cacheados localmente en el mapeo
    const registro = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    if (!registro) return;

    // Poblar de forma inmediata los inputs del formulario del modal expandido
    document.getElementById("edit-id-registro").value = registro.ID_Registro;
    document.getElementById("edit-unidad").value = registro.ID_Unidad;
    document.getElementById("edit-marca").value = registro.Marca;
    document.getElementById("edit-observa").value = registro.Observaciones;

    document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modalEditarRegistro").classList.add("hidden");
}

/**
 * Guarda los cambios realizados desde el formulario avanzado modal
 */
async function guardarEdicionModal(event) {
    event.preventDefault();
    const id = document.getElementById("edit-id-registro").value;
    const btn = document.getElementById("btn-editar-submit");
    
    // Recuperar el estado actual del registro mapeado para no resetear estatus ni avances configurados
    const original = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    
    const payload = {
        accion: "editar",
        id_registro: id,
        marca: document.getElementById("edit-marca").value.trim(),
        observaciones: document.getElementById("edit-observa").value.trim(),
        estatus: original ? original.Estatus : "Por Atender",
        avance: original ? original.Avance : 0,
        foto_antes: original ? original.Foto_Antes : "",
        foto_despues: original ? original.Foto_Despues : "",
        fecha_salida: original ? original.Fecha_Salida : ""
    };

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i> Actualizando...`;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const res = await response.json();
        if (res.status === "SUCCESS") {
            cerrarModalEditar();
            await cargarTablaEditable();
        } else {
            alert("Error de guardado modal: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo crítico de comunicación.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios Formulario`;
    }
}
