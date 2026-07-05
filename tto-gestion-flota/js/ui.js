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
            .m3-dialog-enter { transform: translateY(20px) scale(0.95); opacity: 0; }
            .m3-dialog-enter-active { transform: translateY(0) scale(1); opacity: 1; transition: transform 0.4s cubic-bezier(0.2, 0.0, 0, 1.0), opacity 0.2s linear; }
            .m3-dialog-exit { transform: scale(1); opacity: 1; }
            .m3-dialog-exit-active { transform: scale(0.95); opacity: 0; transition: transform 0.2s cubic-bezier(0.2, 0.0, 0, 1.0), opacity 0.15s linear; }
            .m3-scrim-enter { opacity: 0; }
            .m3-scrim-enter-active { opacity: 1; transition: opacity 0.4s linear; }
            .m3-scrim-exit { opacity: 1; }
            .m3-scrim-exit-active { opacity: 0; transition: opacity 0.3s linear; }
            .m3-rounded-28 { border-radius: 28px; }
        `;
        document.head.appendChild(style);
    };

    const createScrim = () => {
        const scrim = document.createElement('div');
        scrim.className = 'fixed inset-0 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-sm m3-scrim-enter pointer-events-auto';
        return scrim;
    };

    const show = ({ title, message, confirmText = 'Aceptar', cancelText = null, type = 'info' }) => {
        init();
        return new Promise((resolve) => {
            const scrim = createScrim();
            
            const dialog = document.createElement('div');
            // M3 Dialog Background en Dark Mode suele ser Surface Container (un poco más claro que el fondo puro)
            dialog.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 m3-rounded-28 shadow-2xl w-full max-w-[320px] overflow-hidden m3-dialog-enter pointer-events-auto transition-colors';
            
            let iconHtml = '';
            let titleColor = 'text-slate-900 dark:text-slate-100';
            
            if (type === 'error') {
                iconHtml = '<i class="fa-solid fa-circle-exclamation text-red-600 dark:text-red-500 mb-4 text-2xl"></i>';
                titleColor = 'text-red-600 dark:text-red-400';
            } else if (type === 'success') {
                iconHtml = '<i class="fa-solid fa-circle-check text-emerald-600 dark:text-emerald-500 mb-4 text-2xl"></i>';
            } else if (type === 'warning') {
                iconHtml = '<i class="fa-solid fa-triangle-exclamation text-amber-600 dark:text-amber-500 mb-4 text-2xl"></i>';
            } else {
                iconHtml = '<i class="fa-solid fa-circle-info text-blue-600 dark:text-blue-400 mb-4 text-2xl"></i>';
            }

            dialog.innerHTML = `
                <div class="p-6">
                    <div class="flex flex-col items-center text-center">
                        <div class="opacity-90 mb-1">${iconHtml}</div>
                        <h3 class="${titleColor} text-[22px] font-black tracking-tight mb-3 leading-tight transition-colors uppercase">${title}</h3>
                        <p class="text-slate-600 dark:text-slate-400 text-[13px] font-medium leading-relaxed transition-colors px-1">${message}</p>
                    </div>
                    <div class="mt-8 flex justify-center gap-2">
                        ${cancelText ? `
                            <button id="m3-cancel" class="flex-1 px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all cursor-pointer border border-transparent active:scale-95">
                                ${cancelText}
                            </button>
                        ` : ''}
                        <button id="m3-confirm" class="flex-1 px-4 py-3 text-[11px] font-black uppercase tracking-[0.15em] bg-blue-600 text-white hover:bg-blue-500 rounded-full transition-all cursor-pointer shadow-lg shadow-blue-600/20 active:scale-95">
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
