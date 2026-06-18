// js/panel.js - Controlador de Edición Inline para el Centro de Operación de Patio

document.addEventListener("DOMContentLoaded", cargarTablaEditable);

let listaRegistrosPanel = [];

async function cargarTablaEditable() {
    const tbody = document.getElementById("tablaEditableCuerpo");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-blue-400 font-bold uppercase tracking-widest text-[10px]"><i class="fa-solid fa-spinner animate-spin mr-1"></i> Desplegando Matriz Editable...</td></tr>`;

    try {
        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify({ accion: "leer" })
        });
        
        const res = await response.json();
        if (res.status !== "SUCCESS") {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-[10px]">Error: ${res.message}</td></tr>`;
            return;
        }

        let filasCrudas = res.datos || res.unidades || [];
        
        // Mapeador de datos tolerante
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
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-500 text-[10px] uppercase font-bold">No existen registros en la base de datos</td></tr>`;
            return;
        }

        tbody.innerHTML = "";
        
        // Renderizar de más nuevo a más viejo
        [...listaRegistrosPanel].reverse().forEach(reg => {
            let fosaFinal = reg.Nombre_Taller === "TALLER EXTERNO (Terceros)" ? `EXT: ${reg.Nombre_Taller_Ext}` : reg.Nombre_Taller;
            
            let filaHtml = `
                <tr id="fila-${reg.ID_Registro}" class="hover:bg-slate-950/20 border-b border-slate-800/30 transition-colors">
                    
                    <td class="p-3 text-slate-500 font-mono text-[11px] font-bold">${reg.ID_Registro}</td>
                    
                    <td class="p-3">
                        <span class="font-black text-white tracking-wider font-mono block">${reg.ID_Unidad}</span>
                        <input type="text" id="inline-marca-${reg.ID_Registro}" value="${reg.Marca}" 
                               class="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-blue-500 px-1 py-0.5 text-[10px] text-slate-400 w-full focus:outline-none uppercase" placeholder="Marca...">
                    </td>
                    
                    <td class="p-3 text-slate-400 font-medium text-[11px]">${fosaFinal}</td>
                    
                    <td class="p-3">
                        <div class="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/60">
                            <input type="range" id="inline-avance-${reg.ID_Registro}" min="0" max="100" step="5" value="${reg.Avance}" 
                                   class="w-full accent-blue-500 h-1 rounded cursor-pointer"
                                   oninput="document.getElementById('lbl-avance-${reg.ID_Registro}').textContent = this.value + '%'">
                            <span id="lbl-avance-${reg.ID_Registro}" class="font-mono text-[10px] font-bold text-blue-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 w-10 text-center">${reg.Avance}%</span>
                        </div>
                    </td>
                    
                    <td class="p-3">
                        <select id="inline-estatus-${reg.ID_Registro}" 
                                onchange="evaluarEstatusCambio('${reg.ID_Registro}', this.value)"
                                class="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 font-bold text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer">
                            <option value="Por Atender" ${reg.Estatus === "Por Atender" ? "selected" : ""}>⚠️ Por Atender</option>
                            <option value="En Proceso" ${reg.Estatus === "En Proceso" ? "selected" : ""}>⚙️ En Proceso</option>
                            <option value="Listo" ${reg.Estatus === "Listo" || reg.Estatus === "Reparado" ? "selected" : ""}>✅ Listo</option>
                        </select>
                    </td>
                    
                    <td class="p-2">
                        <input type="text" id="inline-observa-${reg.ID_Registro}" value="${reg.Observaciones}" 
                               class="w-full bg-slate-950/40 border border-slate-800/60 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-blue-500 font-medium placeholder:text-slate-700 text-[11px]" placeholder="Añadir novedad de patio...">
                        
                        <input type="hidden" id="inline-foto-antes-${reg.ID_Registro}" value="${reg.Foto_Antes}">
                        <input type="hidden" id="inline-foto-despues-${reg.ID_Registro}" value="${reg.Foto_Despues}">
                    </td>
                    
                    <td class="p-2 text-center">
                        <button onclick="guardarCambioFila('${reg.ID_Registro}')" id="btn-save-${reg.ID_Registro}"
                                class="bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl transition-all border border-blue-500/20 cursor-pointer shadow-sm" title="Guardar Fila">
                            <i class="fa-solid fa-floppy-disk text-xs"></i>
                        </button>
                    </td>
                </tr>
            `;
            tbody.insertAdjacentHTML("beforeend", filaHtml);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-red-500 font-bold text-[10px]">Error de enlace de datos.</td></tr>`;
    }
}

// Interacción lógica inteligente al cambiar estatus inline
function evaluarEstatusCambio(id, valor) {
    if (valor === "Listo") {
        // Si el operador selecciona Listo, forzamos visualmente el slider al 100%
        document.getElementById(`inline-avance-${id}`).value = 100;
        document.getElementById(`lbl-avance-${id}`).textContent = "100%";
    }
}

// Despachar los cambios de la fila directo a Google Apps Script
async function guardarCambioFila(idRegistro) {
    const btn = document.getElementById(`btn-save-${idRegistro}`);
    const estatus = document.getElementById(`inline-estatus-${idRegistro}`).value;
    let avance = document.getElementById(`inline-avance-${idRegistro}`).value;
    
    let fechaSalidaStr = "";
    if (estatus === "Listo") {
        avance = "100";
        // Helper para estampar la fecha de salida hoy
        const hoy = new Date();
        let dd = String(hoy.getDate()).padStart(2, '0');
        let mm = String(hoy.getMonth() + 1).padStart(2, '0');
        fechaSalidaStr = `${dd}-${mm}-${hoy.getFullYear()}`;
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

    try {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin text-xs"></i>`;
        btn.className = "bg-amber-600 text-white p-2 rounded-xl border border-amber-500";

        const response = await fetch(APP_CONFIG.URL_API, {
            method: "POST",
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        
        if (res.status === "SUCCESS") {
            // Animación de éxito momentánea en la fila
            const fila = document.getElementById(`fila-${idRegistro}`);
            fila.classList.add("bg-emerald-950/20");
            
            btn.className = "bg-emerald-600 text-white p-2 rounded-xl border border-emerald-500";
            btn.innerHTML = `<i class="fa-solid fa-check text-xs"></i>`;
            
            setTimeout(() => {
                fila.classList.remove("bg-emerald-950/20");
                btn.className = "bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl transition-all border border-blue-500/20 cursor-pointer";
                btn.innerHTML = `<i class="fa-solid fa-floppy-disk text-xs"></i>`;
                btn.disabled = false;
            }, 1500);
        } else {
            alert("Error: " + res.message);
            recargarBotonOriginal(btn);
        }
    } catch (err) {
        console.error(err);
        alert("Fallo de comunicación con la base de datos.");
        recargarBotonOriginal(btn);
    }
}

function recargarBotonOriginal(btn) {
    btn.disabled = false;
    btn.className = "bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white p-2 rounded-xl border border-blue-500/20";
    btn.innerHTML = `<i class="fa-solid fa-floppy-disk text-xs"></i>`;
}
