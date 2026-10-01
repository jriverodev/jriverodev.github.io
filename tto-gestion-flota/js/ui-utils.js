// Shared UI utilities: image preview and cleanup
// Expose as window.SIAGOP_UI_UTILS so existing code can call via globals
(function () {
    function previsualizarImagenImpl(input, idContenedor) {
        const container = document.getElementById(idContenedor);
        if (!container) return;
        let img = container.querySelector("img");

        if (!img) {
            img = document.createElement("img");
            img.className = "w-full h-full object-contain";
            container.appendChild(img);
        }

        if (typeof input === 'string') {
            const url = typeof normalizarUrlStorage === 'function' ? normalizarUrlStorage(input) : input;
            if (url && url.trim() && url !== 'undefined' && url !== 'null') {
                img.setAttribute("src", url);
                container.classList.remove("hidden");
            } else {
                img.removeAttribute("src");
                container.classList.add("hidden");
            }
            return;
        }

        if (input && input.files && input.files[0]) {
            const valRes = typeof validarArchivoAdjunto === 'function' ? validarArchivoAdjunto(input.files[0]) : { valido: true };
            if (!valRes.valido) {
                if (window.SIAGOP_UI && typeof SIAGOP_UI.error === 'function') {
                    SIAGOP_UI.error("Archivo no válido", valRes.mensaje);
                }
                input.value = "";
                img.removeAttribute("src");
                container.classList.add("hidden");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                if (e && e.target && e.target.result) {
                    img.setAttribute("src", e.target.result);
                    container.classList.remove("hidden");
                }
            };
            reader.readAsDataURL(input.files[0]);
        } else {
            img.removeAttribute("src");
            container.classList.add("hidden");
        }
    }

    function limpiarPreviaImpl(idInput, idContenedor) {
        const input = document.getElementById(idInput);
        if (input) input.value = "";
        const container = document.getElementById(idContenedor);
        if (container) {
            const img = container.querySelector("img");
            if (img) img.removeAttribute("src");
            container.classList.add("hidden");
        }
    }

    function renderizarSkeletonTablaImpl(filas = 5, columnas = 6) {
        let rowsHtml = '';
        for (let r = 0; r < filas; r++) {
            let colsHtml = '';
            for (let c = 0; c < columnas; c++) {
                colsHtml += `<td class="p-4"><div class="h-4 bg-slate-200 dark:bg-slate-700/80 rounded-lg animate-pulse w-full"></div></td>`;
            }
            rowsHtml += `<tr class="border-b border-slate-200 dark:border-slate-800">${colsHtml}</tr>`;
        }
        return rowsHtml;
    }

    function renderizarSkeletonTarjetasImpl(cantidad = 4) {
        let cardsHtml = '';
        for (let i = 0; i < cantidad; i++) {
            cardsHtml += `
                <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-5 shadow-sm space-y-3 animate-pulse">
                    <div class="h-3 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/2"></div>
                    <div class="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-1/3"></div>
                    <div class="h-2 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4"></div>
                </div>
            `;
        }
        return cardsHtml;
    }

    // Expose a namespaced util and also define globals for backward compatibility
    window.SIAGOP_UI_UTILS = window.SIAGOP_UI_UTILS || {};
    window.SIAGOP_UI_UTILS.previsualizarImagen = previsualizarImagenImpl;
    window.SIAGOP_UI_UTILS.limpiarPrevia = limpiarPreviaImpl;
    window.SIAGOP_UI_UTILS.renderizarSkeletonTabla = renderizarSkeletonTablaImpl;
    window.SIAGOP_UI_UTILS.renderizarSkeletonTarjetas = renderizarSkeletonTarjetasImpl;

    // Backwards-compatible globals (some code calls these functions directly)
    if (typeof window.previsualizarImagen !== 'function') {
        window.previsualizarImagen = function(input, idContenedor) {
            return window.SIAGOP_UI_UTILS.previsualizarImagen(input, idContenedor);
        };
    }

    if (typeof window.limpiarPrevia !== 'function') {
        window.limpiarPrevia = function(idInput, idContenedor) {
            return window.SIAGOP_UI_UTILS.limpiarPrevia(idInput, idContenedor);
        };
    }

    // Debug helpers: inject small dev-only buttons into footer to test preview/cleanup
    function findPreviewPair() {
        const pairs = [
            { input: 'add-foto-antes', container: 'preview-add-antes' },
            { input: 'edit-foto-despues', container: 'preview-edit-despues' },
            { input: 'add-documento', container: 'preview-add-doc' },
            { input: 'edit-documento', container: 'preview-edit-doc' }
        ];
        for (const p of pairs) {
            if (document.getElementById(p.container) || document.getElementById(p.input)) return p;
        }
        return null;
    }

    function isDevMode() {
        try {
            const params = new URLSearchParams(window.location.search);
            if (params.has('dev')) return true;
        } catch (e) {}
        const host = window.location.hostname;
        if (!host) return true; // file:// may have empty hostname
        return host === 'localhost' || host === '127.0.0.1' || host === '';
    }

    function addDebugFooterButtons() {
        if (!(isDevMode() || window.SIAGOP_DEBUG_UI === true)) return;

        const pair = findPreviewPair();
        const footer = document.querySelector('footer');

        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '8px';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginLeft = '10px';

        const btnPreview = document.createElement('button');
        btnPreview.type = 'button';
        btnPreview.textContent = 'Debug: Seleccionar Imagen (Preview)';
        btnPreview.title = 'Abrir selector de archivos para probar previsualización (dev)';
        btnPreview.style.fontSize = '11px';
        btnPreview.style.padding = '6px 8px';
        btnPreview.style.borderRadius = '6px';
        btnPreview.style.border = '1px solid rgba(0,0,0,0.08)';
        btnPreview.style.background = 'rgba(255,255,255,0.9)';

        btnPreview.addEventListener('click', () => {
            const p = findPreviewPair();
            if (!p) {
                alert('No se encontró un contenedor de preview en esta página.');
                return;
            }
            const tempInput = document.createElement('input');
            tempInput.type = 'file';
            tempInput.accept = 'image/*';
            tempInput.style.display = 'none';
            tempInput.addEventListener('change', async () => {
                try {
                    if (typeof window.previsualizarImagen === 'function') {
                        window.previsualizarImagen(tempInput, p.container);
                    } else if (window.SIAGOP_UI_UTILS && window.SIAGOP_UI_UTILS.previsualizarImagen) {
                        window.SIAGOP_UI_UTILS.previsualizarImagen(tempInput, p.container);
                    } else {
                        alert('Función de previsualización no disponible.');
                    }
                } finally {
                    setTimeout(() => { try { document.body.removeChild(tempInput); } catch (e) {} }, 1000);
                }
            });
            document.body.appendChild(tempInput);
            tempInput.click();
        });

        const btnClear = document.createElement('button');
        btnClear.type = 'button';
        btnClear.textContent = 'Debug: Limpiar Preview';
        btnClear.title = 'Limpiar el preview asociado (dev)';
        btnClear.style.fontSize = '11px';
        btnClear.style.padding = '6px 8px';
        btnClear.style.borderRadius = '6px';
        btnClear.style.border = '1px solid rgba(0,0,0,0.08)';
        btnClear.style.background = 'rgba(255,255,255,0.9)';

        btnClear.addEventListener('click', () => {
            const p = findPreviewPair();
            if (!p) {
                alert('No se encontró un contenedor de preview en esta página.');
                return;
            }
            if (typeof window.limpiarPrevia === 'function') {
                window.limpiarPrevia(p.input, p.container);
            } else if (window.SIAGOP_UI_UTILS && window.SIAGOP_UI_UTILS.limpiarPrevia) {
                window.SIAGOP_UI_UTILS.limpiarPrevia(p.input, p.container);
            } else {
                alert('Función limpiarPrevia no disponible.');
            }
        });

        wrapper.appendChild(btnPreview);
        wrapper.appendChild(btnClear);

        wrapper.style.padding = '6px';

        if (footer) {
            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.justifyContent = 'flex-end';
            right.style.alignItems = 'center';
            right.appendChild(wrapper);
            right.className = 'dev-debug-wrapper';
            footer.appendChild(right);
        } else {
            const floatDiv = document.createElement('div');
            floatDiv.style.position = 'fixed';
            floatDiv.style.right = '12px';
            floatDiv.style.bottom = '12px';
            floatDiv.style.zIndex = '9999';
            floatDiv.style.background = 'rgba(0,0,0,0.6)';
            floatDiv.style.color = '#fff';
            floatDiv.style.padding = '8px';
            floatDiv.style.borderRadius = '10px';
            floatDiv.style.fontSize = '12px';
            floatDiv.appendChild(wrapper);
            document.body.appendChild(floatDiv);
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(addDebugFooterButtons, 50);
    } else {
        document.addEventListener('DOMContentLoaded', () => addDebugFooterButtons());
    }
})();


function obtenerEstatusTrans80Html(fechaInput, avisosInput) {
    const avisosStr = String(avisosInput || '').trim().toUpperCase();
    const fechaStr = String(fechaInput || '').trim().toUpperCase();

    if (avisosStr === 'NO APLICA' || fechaStr === 'NO APLICA') {
        return `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-400">No Aplica</span></div>`;
    }
    if (avisosStr.includes('SIN SOLICITUD') || fechaStr.includes('SIN SOLICITUD')) {
        return `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-400">Sin Solicitud</span></div>`;
    }

    if (!fechaInput) {
        return `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-500">Sin Fecha</span></div>`;
    }

    let str = String(fechaInput).trim();
    if (!str || str === 'S/F' || str === 'N/A' || str === 'null' || str === 'undefined' || str === 'NULL') {
        return `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase"><span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-500">Sin Fecha</span></div>`;
    }

    let fecha;
    if (str.includes('T') || /^\d{4}-\d{2}-\d{2}/.test(str)) {
        fecha = new Date(str);
    } else {
        const partes = str.split('-');
        if (partes.length === 3) {
            if (partes[0].length === 4) {
                fecha = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10));
            } else {
                fecha = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
            }
        } else {
            fecha = new Date(str);
        }
    }

    if (isNaN(fecha.getTime())) {
        return `<div class="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase">${typeof escapeHTML === 'function' ? escapeHTML(str) : str} <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-500/10 border border-slate-500/30 text-slate-500">Sin Fecha</span></div>`;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const target = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const diffMs = target - hoy;
    const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

    const fechaFormateada = fecha.toISOString().slice(0, 10);

    let badge = '';
    if (diffDias > 30) {
        badge = `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">Vigente</span>`;
    } else if (diffDias >= 0) {
        const texto = diffDias === 0 ? 'Vence hoy' : (diffDias === 1 ? 'Queda 1 día' : `Quedan ${diffDias} días`);
        badge = `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">${texto}</span>`;
    } else {
        const diasVencidos = Math.abs(diffDias);
        let vencioTexto = '';
        if (diasVencidos < 30) {
            vencioTexto = `Venció hace ${diasVencidos} ${diasVencidos === 1 ? 'día' : 'días'}`;
        } else if (diasVencidos < 365) {
            const meses = Math.floor(diasVencidos / 30);
            vencioTexto = `Venció hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
        } else {
            const anios = Math.floor(diasVencidos / 365);
            vencioTexto = `Venció hace ${anios} ${anios === 1 ? 'año' : 'años'}`;
        }
        badge = `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400">${vencioTexto}</span>`;
    }

    return `<div class="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200"><i class="fa-solid fa-calendar-check text-[10px] mr-1 text-slate-400"></i>${fechaFormateada}</div><div class="mt-0.5">${badge}</div>`;
}

window.obtenerEstatusTrans80Html = obtenerEstatusTrans80Html;
if (window.SIAGOP_UI_UTILS) {
    window.SIAGOP_UI_UTILS.obtenerEstatusTrans80Html = obtenerEstatusTrans80Html;
}
