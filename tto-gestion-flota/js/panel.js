// js/panel.js - Controlador Unificado de Patio, Edición Inline, Checklist Automatizado y Manejo de Imágenes en Base64

document.addEventListener("DOMContentLoaded", cargarTablaEditable);

// Almacenes de control en memoria global
let listaRegistrosPanel = [];
let tareasModalActual = []; 

/**
 * Consulta y despliega la matriz operativa en tiempo real
 */
async function cargarTablaEditable() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

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
        
        // Mapeo y normalización estricta de cabeceras
        listaRegistrosPanel = filasCrudas.map(u => {
            let normalized = {};
            for (let key in u) {
                normalized[key.toUpperCase().replace(/_/g, "").replace(/\s/g, "")] = u[key];
            }
            
            // Deserialización segura del string de tareas (JSON)
            let tareasRaw = normalized["TAREAS"] || normalized["CHECKLIST"] || u["Tareas"] || "";
            let tareasArray = [];
            try {
                if (tareasRaw) {
                    tareasArray = typeof tareasRaw === "string" ? JSON.parse(tareasRaw) : tareasRaw;
                }
            } catch(e) { 
                console.error("Error parseando JSON de tareas en registro", e); 
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
                Fecha_Salida: normalized["FECHASALIDA"] || u["Fecha_Salida"] || "",
                Tareas: tareasArray
            };
        });

        if (listaRegistrosPanel.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 text-xs font-bold uppercase">No existen unidades activas en el historial.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        
        // Renderizado inverso (últimos ingresos arriba)
        [...listaRegistrosPanel].reverse().forEach(reg => {
            let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
            
            let badgeFotoAntes = reg.Foto_Antes 
                ? `<a href="${reg.Foto_Antes}" target="_blank" class="text-blue-400 hover:text-blue-300 transition-colors text-[10px] font-bold block mt-0.5"><i class="fa-solid fa-image mr-1"></i> Foto Inicial</a>` 
                : '<span class="text-slate-600 block text-[9px] mt-0.5 italic">Sin foto inicial</span>';

            let badgeFotoDespues = reg.Foto_Despues
                ? `<a href="${reg.Foto_Despues}" target="_blank" class="text-emerald-400 hover:text-emerald-300 transition-colors text-[10px] font-bold block mt-0.5"><i class="fa-solid fa-square-check mr-1"></i> Foto Final</a>`
                : '';

            let filaHtml = `
                <tr id="fila-${reg.ID_Registro}" class="hover:bg-slate-950/20 border-b border-slate-800/40 transition-colors">
                    <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${reg.ID_Registro}</td>
                    <td class="p-3">
                        <span class="font-black text-white tracking-wider font-mono block text-xs">${reg.ID_Unidad}</span>
                        <input type="text" id="inline-marca-${reg.ID_Registro}" value="${reg.Marca}" 
                               class="bg-transparent border-b border-transparent hover:border-slate-800 focus:border-blue-500 px-0.5 py-0.5 text-[11px] text-slate-400 w-full focus:outline-none uppercase font-medium transition-all" placeholder="Marca...">
                    </td>
                    <td class="p-3 text-slate-300 font-semibold text-[11px] tracking-wide">
                        <div>${fosaFinal}</div>
                        <div class="flex gap-2 flex-wrap">${badgeFotoAntes} ${badgeFotoDespues}</div>
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
                               class="w-full bg-slate-950/40 border border-slate-800/40 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-700 text-[11px] transition-all" placeholder="Añadir novedad de patio...">
                        
                        <input type="hidden" id="inline-foto-antes-${reg.ID_Registro}" value="${reg.Foto_Antes}">
                        <input type="hidden" id="inline-foto-despues-${reg.ID_Registro}" value="${reg.Foto_Despues}">
                    </td>
                    <td class="p-2 text-center flex items-center justify-center gap-1.5 h-full">
                        <button onclick="guardarChangeInline('${reg.ID_Registro}')" id="btn-save-${reg.ID_Registro}"
                                class="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl transition-all border border-blue-500/20 cursor-pointer" title="Guardar fila">
                            <i class="fa-solid fa-floppy-disk text-xs"></i>
                        </button>
                        <button onclick="abrirModalEditar('${reg.ID_Registro}')"
                                class="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl transition-all border border-slate-700 cursor-pointer" title="Planificación Avanzada">
                            <i class="fa-solid fa-list-check text-xs"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", filaHtml);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-xs">Error crítico de enlace de datos.</td></tr>`;
    }
}

/**
 * Convierte archivos binarios a cadenas DataURL Base64
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
 * Escucha cambios rápidos de estatus en celdas
 */
function evaluarEstatusCambio(id, valor) {
    if (valor === "Listo") {
        document.getElementById(`inline-avance-${id}`).value = 100;
        document.getElementById(`lbl-avance-${id}`).textContent = "100%";
    }
}

/**
 * Ejecuta el guardado rápido desde la tabla (Protege y reenvía el JSON de tareas existente)
 */
async function guardarChangeInline(idRegistro) {
    const btn = document.getElementById(`btn-save-${idRegistro}`);
    const estatus = document.getElementById(`inline-estatus-${idRegistro}`).value;
    let avance = document.getElementById(`inline-avance-${idRegistro}`).value;
    
    const original = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(idRegistro));

    let fechaSalidaStr = original ? original.Fecha_Salida : "";
    if (estatus === "Listo") {
        avance = "100";
        if (!fechaSalidaStr) {
            const hoy = new Date();
            fechaSalidaStr = `${String(hoy.getDate()).padStart(2,'0')}-${String(hoy.getMonth()+1).padStart(2,'0')}-${hoy.getFullYear()}`;
        }
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
        tareas: original && original.Tareas ? JSON.stringify(original.Tareas) : "[]", // Resguardo de checklist
        fecha_salida: fechaSalidaStr
    };

    ejecutarEnvioEdicion(payload, btn, idRegistro);
}

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
                cargarTablaEditable();
            }, 1000);
        } else {
            alert("Error: " + res.message);
            recargarBotonOriginal(btn);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación de red.");
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
        observaciones: document.getElementById("add-observa").value.trim(),
        fecha_ingreso: fechaFormateada,
        foto_antes_base64: fotoBase64
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
            alert("Error: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación al registrar.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-square-check"></i> Registrar Ingreso`;
    }
}

// ==========================================
// CONTROLADORES DE MODAL 2: DIAGNÓSTICO & CHECKLIST
// ==========================================
function abrirModalEditar(id) {
    const registro = listaRegistrosPanel.find(r => String(r.ID_Registro) === String(id));
    if (!registro) return;

    document.getElementById("edit-id-registro").value = registro.ID_Registro;
    document.getElementById("edit-unidad").value = registro.ID_Unidad;
    document.getElementById("edit-marca").value = registro.Marca;
    document.getElementById("edit-observa").value = registro.Observaciones;
    document.getElementById("edit-estatus").value = registro.Estatus;

    // Duplicamos en memoria local las tareas del registro
    tareasModalActual = Array.isArray(registro.Tareas) ? [...registro.Tareas] : [];
    
    renderizarTareasModal();
    document.getElementById("modalEditarRegistro").classList.remove("hidden");
}

function cerrarModalEditar() {
    document.getElementById("modalEditarRegistro").classList.add("hidden");
}

/**
 * Procesa el render de elementos del checklist y gestiona los estados del motor Plan vs Real
 */
function renderizarTareasModal() {
    const container = document.getElementById("edit-container-tareas");
    container.innerHTML = "";

    if (tareasModalActual.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-600 italic py-2 text-center">No hay tareas de diagnóstico asignadas.</p>`;
    } else {
        tareasModalActual.forEach((tarea, index) => {
            const itemHtml = `
                <div class="flex items-center justify-between bg-slate-950 p-2 rounded-lg border border-slate-800/60 gap-2">
                    <label class="flex items-center gap-2 flex-1 cursor-pointer select-none">
                        <input type="checkbox" ${tarea.hecho ? "checked" : ""} 
                               onchange="alternarTareaModal(${index})"
                               class="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer">
                        <span class="text-xs ${tarea.hecho ? "line-through text-slate-500 font-medium" : "text-slate-200 font-medium"} truncate max-w-[280px]">
                            ${tarea.texto}
                        </span>
                    </label>
                    <button type="button" onclick="eliminarTareaModal(${index})" class="text-slate-600 hover:text-red-400 p-1 transition-colors">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", itemHtml);
        });
    }

    // Evaluación matemática del avance real
    let avanceCalculado = 0;
    if (tareasModalActual.length > 0) {
        const total = tareasModalActual.length;
        const completadas = tareasModalActual.filter(t => t.hecho).length;
        avanceCalculado = Math.round((completadas / total) * 100);
    }

    const selectorEstatus = document.getElementById("edit-estatus");
    
    // Regla automática: Si existen tareas y todas se marcaron completas, forzar 'Listo'
    if (tareasModalActual.length > 0 && avanceCalculado === 100) {
        selectorEstatus.value = "Listo";
    }

    // Regla manual: Si el operador fuerza estatus a 'Listo', el avance se asume al 100%
    if (selectorEstatus.value === "Listo") {
        avanceCalculado = 100;
    }
    
    actualizarInterfazAvanceModal(avanceCalculado);
}

function agregarTareaModal() {
    const input = document.getElementById("edit-nueva-tarea");
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
    document.getElementById("edit-lbl-avance-calculado").textContent = porcentaje + "%";
    const wrapperFoto = document.getElementById("wrapper-foto-despues");
    
    // Habilita o bloquea la carga de la foto final según el avance real
    if (porcentaje === 100) {
        wrapperFoto.classList.remove("hidden");
    } else {
        wrapperFoto.classList.add("hidden");
        document.getElementById("edit-foto-despues").value = ""; 
    }
}

/**
 * Empaqueta el diagnóstico final, calcula cierres de fecha y procesa base64 de salida
 */
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
        observaciones: document.getElementById("edit-observa").value.trim(),
        estatus: estatus,
        avance: avanceFinal.toString(),
        tareas: JSON.stringify(tareasModalActual), // Matriz serializada para persistencia en una sola celda
        foto_antes: original ? original.Foto_Antes : "",
        foto_despues: original ? original.Foto_Despues : "", 
        foto_despues_base64: fotoDespuesBase64, 
        fecha_salida: fechaSalidaStr
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
        } else {
            alert("Error: " + res.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo crítico de comunicación.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    }
}
