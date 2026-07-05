/**
 * TTOCC_UI - Componentes Material 3 para Aplicaciones Web Móviles
 * Emula diálogos de Android 13+ (Material Design 3)
 */

const TTOCC_UI = (() => {
    let dialogContainer = null;

    const init = () => {
        if (dialogContainer) return;
        dialogContainer = document.createElement('div');
        dialogContainer.id = 'ttocc-ui-dialog-root';
        dialogContainer.className = 'fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none overflow-hidden';
        document.body.appendChild(dialogContainer);

        const style = document.createElement('style');
        style.textContent = `
            .m3-dialog-enter { transform: scale(0.9); opacity: 0; }
            .m3-dialog-enter-active { transform: scale(1); opacity: 1; transition: transform 0.3s cubic-bezier(0.05, 0.7, 0.1, 1), opacity 0.2s linear; }
            .m3-dialog-exit { transform: scale(1); opacity: 1; }
            .m3-dialog-exit-active { transform: scale(0.95); opacity: 0; transition: transform 0.2s ease-in, opacity 0.15s linear; }
            .m3-scrim-enter { opacity: 0; }
            .m3-scrim-enter-active { opacity: 1; transition: opacity 0.3s linear; }
            .m3-scrim-exit { opacity: 1; }
            .m3-scrim-exit-active { opacity: 0; transition: opacity 0.2s linear; }
            .m3-rounded-28 { border-radius: 28px; }
        `;
        document.head.appendChild(style);
    };

    const createScrim = () => {
        const scrim = document.createElement('div');
        scrim.className = 'fixed inset-0 bg-slate-950/80 backdrop-blur-sm m3-scrim-enter pointer-events-auto';
        return scrim;
    };

    const show = ({ title, message, confirmText = 'Aceptar', cancelText = null, type = 'info' }) => {
        init();
        return new Promise((resolve) => {
            const scrim = createScrim();

            const dialog = document.createElement('div');
            dialog.className = 'bg-slate-900 border border-slate-800 m3-rounded-28 shadow-2xl w-full max-w-sm overflow-hidden m3-dialog-enter pointer-events-auto';

            let iconHtml = '';
            let titleColor = 'text-slate-100';

            if (type === 'error') {
                iconHtml = '<i class="fa-solid fa-circle-exclamation text-red-500 mb-4 text-xl"></i>';
                titleColor = 'text-red-400';
            } else if (type === 'success') {
                iconHtml = '<i class="fa-solid fa-circle-check text-emerald-500 mb-4 text-xl"></i>';
            } else if (type === 'warning') {
                iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber-500 mb-4 text-xl"></i>';
            }

            dialog.innerHTML = `
                <div class="p-6">
                    <div class="flex flex-col items-center text-center">
                        ${iconHtml}
                        <h3 class="${titleColor} text-lg font-bold tracking-tight mb-3 leading-tight">${title}</h3>
                        <p class="text-slate-400 text-sm leading-relaxed">${message}</p>
                    </div>
                    <div class="mt-6 flex justify-end gap-2">
                        ${cancelText ? `
                            <button id="m3-cancel" class="px-4 py-2.5 text-sm font-black uppercase tracking-widest text-blue-400 hover:bg-blue-400/10 rounded-full transition-colors cursor-pointer">
                                ${cancelText}
                            </button>
                        ` : ''}
                        <button id="m3-confirm" class="px-4 py-2.5 text-sm font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 rounded-full transition-colors cursor-pointer">
                            ${confirmText}
                        </button>
                    </div>
                </div>
            `;

            dialogContainer.appendChild(scrim);
            dialogContainer.appendChild(dialog);

            // Animate In
            requestAnimationFrame(() => {
                scrim.classList.add('m3-scrim-enter-active');
                dialog.classList.add('m3-dialog-enter-active');
            });

            const close = (result) => {
                scrim.classList.replace('m3-scrim-enter-active', 'm3-scrim-exit-active');
                dialog.classList.replace('m3-dialog-enter-active', 'm3-dialog-exit-active');

                setTimeout(() => {
                    dialogContainer.removeChild(scrim);
                    dialogContainer.removeChild(dialog);
                    resolve(result);
                }, 200);
            };

            dialog.querySelector('#m3-confirm').onclick = () => close(true);
            if (cancelText) {
                dialog.querySelector('#m3-cancel').onclick = () => close(false);
            }
        });
    };

    return {
        alert: (title, message) => show({ title, message }),
        success: (title, message) => show({ title, message, type: 'success' }),
        error: (title, message) => show({ title, message, type: 'error' }),
        confirm: (title, message, confirmText = 'Aceptar', cancelText = 'Cancelar') =>
            show({ title, message, confirmText, cancelText, type: 'warning' })
    };
})();
