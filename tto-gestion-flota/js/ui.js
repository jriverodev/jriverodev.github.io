/**
 * SIAGOP_UI - Componentes UI Unificados para Aplicaciones Web
 */

const SIAGOP_UI = (() => {
    let dialogContainer = null;

    const init = () => {
        if (dialogContainer) return;
        dialogContainer = document.createElement('div');
        dialogContainer.id = 'siagop-ui-dialog-root';
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
        `;
        document.head.appendChild(style);
    };

    const createScrim = () => {
        const scrim = document.createElement('div');
        scrim.className = 'fixed inset-0 bg-slate-950/80 m3-scrim-enter pointer-events-auto';
        return scrim;
    };

    const show = ({ title, message, confirmText = 'Aceptar', cancelText = null, type = 'info' }) => {
        init();
        return new Promise((resolve) => {
            const scrim = createScrim();

            const dialog = document.createElement('div');
            dialog.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-[320px] overflow-hidden m3-dialog-enter pointer-events-auto transition-colors';

            let iconHtml = '';
            let titleColor = 'text-slate-900 dark:text-slate-50';

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
                        <h3 class="${titleColor} text-[20px] font-black tracking-tight mb-3 leading-tight transition-colors uppercase">${title}</h3>
                        <p class="text-slate-600 dark:text-slate-400 text-[13px] font-medium leading-relaxed transition-colors px-1">${message}</p>
                    </div>
                    <div class="mt-8 flex justify-center gap-2">
                        ${cancelText ? `
                            <button id="m3-cancel" class="flex-1 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-all cursor-pointer active:scale-95">
                                ${cancelText}
                            </button>
                        ` : ''}
                        <button id="m3-confirm" class="flex-1 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all cursor-pointer active:scale-95">
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

// Manejo del botón físico Atrás en Android (Capacitor)
document.addEventListener('DOMContentLoaded', () => {
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
        const { App } = window.Capacitor.Plugins;

        App.addListener('backButton', ({ canGoBack }) => {
            const paginaActual = window.location.pathname.split('/').pop() || 'index.html';

            // 1. Si hay un modal abierto, cerrarlo primero en lugar de navegar
            const modalAbierto = document.querySelector('.modal-container:not(.hidden), [dialog][open], [id^="modal"]:not(.hidden)');
            if (modalAbierto) {
                modalAbierto.classList.add('hidden');
                return;
            }

            // 2. Si estamos en una vista secundaria, regresar al panel principal
            if (paginaActual !== 'panel.html' && paginaActual !== 'index.html' && paginaActual !== '') {
                window.location.href = 'panel.html';
                return;
            }

            // 3. Si ya estamos en panel.html, mostrar diálogo de confirmación para salir
            if (paginaActual === 'panel.html') {
                mostrarModalConfirmarSalida(App);
            }
        });
    }
});

function mostrarModalConfirmarSalida(CapacitorApp) {
    if (document.getElementById('modal-salir-app')) return;

    const modalHTML = `
    <div id="modal-salir-app" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full text-center shadow-2xl animate-fade-in">
        <div class="w-12 h-12 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/20">
          <i class="fa-solid fa-right-from-bracket text-xl"></i>
        </div>
        <h3 class="text-lg font-bold text-white mb-2 uppercase tracking-tight">¿Salir de SIAGOP Móvil?</h3>
        <p class="text-slate-400 text-xs mb-6">¿Estás seguro de que deseas cerrar la aplicación?</p>
        <div class="flex gap-3">
          <button id="btn-cancelar-salida" class="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase rounded-lg transition active:scale-95 cursor-pointer">
            Cancelar
          </button>
          <button id="btn-confirmar-salida" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase rounded-lg transition active:scale-95 cursor-pointer">
            Salir
          </button>
        </div>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-cancelar-salida').addEventListener('click', () => {
        document.getElementById('modal-salir-app').remove();
    });

    document.getElementById('btn-confirmar-salida').addEventListener('click', () => {
        if (CapacitorApp && typeof CapacitorApp.exitApp === 'function') {
            CapacitorApp.exitApp();
        }
    });
}
