// Configuración de la fecha por defecto al cargar
document.addEventListener('DOMContentLoaded', () => {
    const fechaInput = document.getElementById('fecha');
    const hoy = new Date().toISOString().split('T')[0];
    fechaInput.value = hoy;
});

// Manejo del Formulario
document.getElementById('formReporte').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 1. Recopilación de datos
    const formData = new FormData(this);
    const data = {
        fecha: formData.get('fecha'),
        institucion: formData.get('institucion'),
        actividad: formData.get('actividad'),
        hora_inicio: formData.get('hora_inicio'),
        hora_fin: formData.get('hora_fin'),
        impactada: formData.get('impactada'),
        atendida: formData.get('atendida'),
        equipo: formData.get('equipo'),
        instructores: formData.get('instructores')
    };

    console.log("Datos capturados:", data);
    
    // Aquí puedes llamar a tu función de Google Apps Script
    // enviarASheets(data);
    
    alert("Datos guardados localmente. Usa el botón de WhatsApp para reportar.");
});

// Lógica para compartir en WhatsApp
document.getElementById('btnWhatsApp').addEventListener('click', function() {
    const form = document.getElementById('formReporte');
    const f = new FormData(form);

    // Formateo de horas (de X a Y)
    const horaFormateada = `de ${f.get('hora_inicio')} a ${f.get('hora_fin')}`;

    // Construcción del mensaje según tu plantilla
    const mensaje = `*Formato para reporte diario* -Fecha : ${f.get('fecha')}

-(Institución/Escuela de Gaita)
${f.get('institucion')}

-Actividad Realizada : ${f.get('actividad')}

-Hora : ${horaFormateada}

-Población Impactada: ${f.get('impactada')}

-Población Atendida : ${f.get('atendida')}

-Equipo De Trabajo : ${f.get('equipo')}
Instructores
${f.get('instructores')}`;

    // Codificar para URL
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    
    // Abrir WhatsApp
    window.open(url, '_blank');
});

// Lógica de Instalación PWA (Opcional)
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btnInstall = document.getElementById('btnInstall');
    if(btnInstall) btnInstall.style.display = 'block';
});

document.getElementById('btnInstall')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('btnInstall').style.display = 'none';
        }
        deferredPrompt = null;
    }
});
      
