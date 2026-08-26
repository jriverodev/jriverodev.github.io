// Shared UI utilities: image preview and cleanup
// Expose as window.TTOCC_UI_UTILS so existing code can call via globals
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
            if (url && url.trim()) {
                img.src = url;
                container.classList.remove("hidden");
            } else {
                img.src = "";
                container.classList.add("hidden");
            }
            return;
        }

        if (input && input.files && input.files[0]) {
            const valRes = typeof validarArchivoAdjunto === 'function' ? validarArchivoAdjunto(input.files[0]) : { valido: true };
            if (!valRes.valido) {
                if (window.TTOCC_UI && typeof TTOCC_UI.error === 'function') {
                    TTOCC_UI.error("Archivo no válido", valRes.mensaje);
                }
                input.value = "";
                img.src = "";
                container.classList.add("hidden");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.result;
                container.classList.remove("hidden");
            };
            reader.readAsDataURL(input.files[0]);
        } else {
            img.src = "";
            container.classList.add("hidden");
        }
    }

    function limpiarPreviaImpl(idInput, idContenedor) {
        const input = document.getElementById(idInput);
        if (input) input.value = "";
        const container = document.getElementById(idContenedor);
        if (container) {
            const img = container.querySelector("img");
            if (img) img.src = "";
            container.classList.add("hidden");
        }
    }

    // Expose a namespaced util and also define globals for backward compatibility
    window.TTOCC_UI_UTILS = window.TTOCC_UI_UTILS || {};
    window.TTOCC_UI_UTILS.previsualizarImagen = previsualizarImagenImpl;
    window.TTOCC_UI_UTILS.limpiarPrevia = limpiarPreviaImpl;

    // Backwards-compatible globals (some code calls these functions directly)
    if (typeof window.previsualizarImagen !== 'function') {
        window.previsualizarImagen = function(input, idContenedor) {
            return window.TTOCC_UI_UTILS.previsualizarImagen(input, idContenedor);
        };
    }

    if (typeof window.limpiarPrevia !== 'function') {
        window.limpiarPrevia = function(idInput, idContenedor) {
            return window.TTOCC_UI_UTILS.limpiarPrevia(idInput, idContenedor);
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
        // Only show debug buttons in dev-like environments or when explicitly enabled.
        // Recommended: keep hidden in production. Enable via URL ?dev or by setting window.TTOCC_DEBUG_UI = true.
        if (!(isDevMode() || window.TTOCC_DEBUG_UI === true)) return;

        const pair = findPreviewPair();
        const footer = document.querySelector('footer');
        const containerEl = footer || document.body;

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
                    } else if (window.TTOCC_UI_UTILS && window.TTOCC_UI_UTILS.previsualizarImagen) {
                        window.TTOCC_UI_UTILS.previsualizarImagen(tempInput, p.container);
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
            } else if (window.TTOCC_UI_UTILS && window.TTOCC_UI_UTILS.limpiarPrevia) {
                window.TTOCC_UI_UTILS.limpiarPrevia(p.input, p.container);
            } else {
                alert('Función limpiarPrevia no disponible.');
            }
        });

        wrapper.appendChild(btnPreview);
        wrapper.appendChild(btnClear);

        // style wrapper lightly so it doesn't break layout
        wrapper.style.padding = '6px';

        if (footer) {
            // append to footer's right side
            const right = document.createElement('div');
            right.style.display = 'flex';
            right.style.justifyContent = 'flex-end';
            right.style.alignItems = 'center';
            right.appendChild(wrapper);
            right.className = 'dev-debug-wrapper';
            footer.appendChild(right);
        } else {
            // floating small panel
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
