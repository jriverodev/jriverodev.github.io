// Inicialización e indexación de la Base de Datos Localhouse con Dexie.js
const db = new Dexie('GestionPersonalDB');
db.version(10).stores({
    trabajadores: '++id, N_PERSONAL, CEDULA, NOMBRES, APELLIDOS, CONDICION, STATUS_FL, GERENCIA_1',
    vacaciones: '++id, MES, NOMINA, CEDULA, SAP, APELLIDOS, NOMBRES, PERIODO, PROCESADA_STATUS, COD_AREA'
});

let tPersonal, tVacaciones;
let fotoBlobTemp = null;
let pdfBlobTemp = null;

const FOTO_PLACEHOLDER = "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=400&h=400&fit=crop";

const modPersonal = new bootstrap.Modal(document.getElementById('modalPersonal'));
const modVacaciones = new bootstrap.Modal(document.getElementById('modalVacaciones'));

const dropZoneFoto = document.getElementById('dropZoneFoto');
const fileInputFoto = document.getElementById('p-foto-input');
const avatarPreview = document.getElementById('p-avatar-preview');
const btnRemoveFoto = document.getElementById('btnRemoveFoto');
const btnLogin = document.getElementById('btnLogin');
const btnCerrarSesionNav = document.getElementById('btnCerrarSesionNav');
const dropZoneBackup = document.getElementById('dropZoneBackup');
const fileBackupRestore = document.getElementById('fileBackupRestore');
const btnBackupDB = document.getElementById('btnBackupDB');
const btnRestaurarBackup = document.getElementById('btnRestaurarBackup');
const backupStatus = document.getElementById('backupStatus');

const HASH_MAESTRO = '284c97d6da921aa6828d2782841596be8e40454badd837d760ad54a6295a769c';
const LOGIN_USER = 'admin';
const SESSION_KEY = 'session_active';
const SESSION_USER_KEY = 'session_user';

async function calcularSHA256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verificarAcceso() {
    const user = document.getElementById('login-user').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;
    const hashInput = await calcularSHA256(pass);

    if (user === LOGIN_USER && hashInput === HASH_MAESTRO) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        sessionStorage.setItem(SESSION_USER_KEY, user);
        document.getElementById('panel-login').classList.add('hidden-panel');
        btnCerrarSesionNav.classList.remove('d-none');
        cambiarVista('menu');
        cargarDatosLocales();
    } else {
        swalError('Credenciales inválidas. Acceso denegado.');
    }
}

function swalToast(message, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon,
        title: message,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
        background: '#ffffff',
        color: '#0f172a'
    });
}

function swalSuccess(message, title = 'Listo') {
    return Swal.fire({
        icon: 'success',
        title,
        text: message,
        confirmButtonColor: '#10b981'
    });
}

function swalError(message, title = 'Error') {
    return Swal.fire({
        icon: 'error',
        title,
        text: message,
        confirmButtonColor: '#ef4444'
    });
}

function swalWarning(message, title = 'Atención') {
    return Swal.fire({
        icon: 'warning',
        title,
        text: message,
        confirmButtonColor: '#f59e0b'
    });
}

function swalInfo(message, title = 'Información') {
    return Swal.fire({
        icon: 'info',
        title,
        text: message,
        confirmButtonColor: '#3b82f6'
    });
}

async function swalConfirm(message, title = 'Confirmar', confirmText = 'Sí, continuar', cancelText = 'Cancelar') {
    const result = await Swal.fire({
        title,
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        reverseButtons: true,
        focusCancel: true,
        customClass: { popup: 'swal2-border-radius' }
    });
    return result.isConfirmed;
}

function enforceDigitsOnly(event) {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowedKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
        return;
    }
    if (!/^[0-9]$/.test(event.key)) {
        event.preventDefault();
    }
}

function sanitizeNumericInput(element) {
    const numericValue = element.value.replace(/\D+/g, '');
    if (element.value !== numericValue) {
        element.value = numericValue;
    }
}

function configureNumericFields(selectors) {
    document.querySelectorAll(selectors).forEach((input) => {
        input.setAttribute('inputmode', 'numeric');
        input.setAttribute('pattern', '[0-9]*');
        input.addEventListener('keydown', enforceDigitsOnly);
        input.addEventListener('keypress', enforceDigitsOnly);
        input.addEventListener('input', () => sanitizeNumericInput(input));
    });
}

// Safe DOM helpers to avoid null .value errors
function getInputValue(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`getInputValue: missing element #${id}`);
        return '';
    }
    return (el.value || '').trim();
}


function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function serializeRecord(record) {
    const copy = {};
    for (const key in record) {
        const value = record[key];
        if (value instanceof Blob) {
            copy[key] = {
                __type: 'blob',
                mime: value.type || 'application/octet-stream',
                data: await blobToBase64(value)
            };
        } else {
            copy[key] = value;
        }
    }
    return copy;
}

function deserializeRecord(record) {
    const copy = {};
    for (const key in record) {
        const value = record[key];
        if (value && value.__type === 'blob') {
            const byteCharacters = atob(value.data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            copy[key] = new Blob([new Uint8Array(byteNumbers)], { type: value.mime });
        } else {
            copy[key] = value;
        }
    }
    return copy;
}

async function exportDatabaseBackup() {
    try {
        const trabajadores = await db.trabajadores.toArray();
        const vacaciones = await db.vacaciones.toArray();
        const serialized = {
            meta: {
                name: db.name,
                version: db.verno,
                exportedAt: new Date().toISOString()
            },
            data: {
                trabajadores: await Promise.all(trabajadores.map(serializeRecord)),
                vacaciones: await Promise.all(vacaciones.map(serializeRecord))
            }
        };

        const backupJson = JSON.stringify(serialized, null, 2);
        const blob = new Blob([backupJson], { type: 'application/json' });
        const fileName = `${db.name}_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        backupStatus.innerText = `✅ Respaldo generado: ${fileName}`;
        swalToast('Respaldo generado correctamente.', 'success');
    } catch (error) {
        console.error('Error exportando respaldo:', error);
        swalError('Error al generar el respaldo. Revise la consola para más detalles.');
    }
}

function parseDatabaseBackup(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !parsed.data || !parsed.data.trabajadores || !parsed.data.vacaciones) {
        throw new Error('Archivo de respaldo inválido o con formato incorrecto.');
    }
    return parsed;
}

async function restoreDatabaseBackup(file) {
    try {
        if (!file) return;
        const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });

        const backup = parseDatabaseBackup(text);
        const confirmRestore = await swalConfirm('Se va a restaurar la base de datos localhouse. Los datos actuales se eliminarán. ¿Desea continuar?', 'Restaurar respaldo', 'Sí, restaurar', 'Cancelar');
        if (!confirmRestore) {
            return;
        }

        await db.transaction('rw', db.trabajadores, db.vacaciones, async () => {
            await db.trabajadores.clear();
            await db.vacaciones.clear();
            const trabajadores = backup.data.trabajadores.map(deserializeRecord);
            const vacaciones = backup.data.vacaciones.map(deserializeRecord);
            if (trabajadores.length) await db.trabajadores.bulkAdd(trabajadores);
            if (vacaciones.length) await db.vacaciones.bulkAdd(vacaciones);
        });

        cargarDatosLocales();
        backupStatus.innerText = `✅ Respaldo restaurado: ${file.name}`;
        swalSuccess('Restauración completada. La base de datos local ha sido cargada.');
    } catch (error) {
        console.error('Error restaurando respaldo:', error);
        swalError('No se pudo restaurar el respaldo. Asegúrese de seleccionar un archivo válido.');
    }
}

function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
    btnCerrarSesionNav.classList.add('d-none');
    document.getElementById('panel-login').classList.remove('hidden-panel');
    document.getElementById('vista-menu').classList.add('hidden-panel');
    document.getElementById('panel-personal').classList.add('hidden-panel');
    document.getElementById('panel-vacaciones').classList.add('hidden-panel');
    document.getElementById('login-pass').value = '';
    document.getElementById('login-user').focus();
}

function verificarSesionAlCargar() {
    if (sessionStorage.getItem(SESSION_KEY) === 'true') {
        document.getElementById('panel-login').classList.add('hidden-panel');
        btnCerrarSesionNav.classList.remove('d-none');
        cambiarVista('menu');
    } else {
        document.getElementById('panel-login').classList.remove('hidden-panel');
        btnCerrarSesionNav.classList.add('d-none');
        document.getElementById('vista-menu').classList.add('hidden-panel');
        document.getElementById('panel-personal').classList.add('hidden-panel');
        document.getElementById('panel-vacaciones').classList.add('hidden-panel');
    }
}

// Cambios de Vista Controlados con Redraw Seguro para Tabulator
function cambiarVista(modulo) {
    document.getElementById('vista-menu').classList.add('hidden-panel');
    document.getElementById('panel-personal').classList.add('hidden-panel');
    document.getElementById('panel-vacaciones').classList.add('hidden-panel');

    if (modulo === 'menu') {
        document.getElementById('vista-menu').classList.remove('hidden-panel');
    } else if (modulo === 'personal') {
        document.getElementById('panel-personal').classList.remove('hidden-panel');
        setTimeout(() => { tPersonal.redraw(true); }, 30);
    } else if (modulo === 'vacaciones') {
        document.getElementById('panel-vacaciones').classList.remove('hidden-panel');
        setTimeout(() => { tVacaciones.redraw(true); }, 30);
    }
}

// Configuración de Tablas Maestras
function inicializarTablas() {
    tPersonal = new Tabulator("#tabla-personal", {
        height: "540px",
        layout: "fitColumns",
        pagination: "local",
        paginationSize: 50,
        placeholder: "No hay registros cargados en la base localhouse.",
        columns: [
            { title: "N° Personal", field: "N_PERSONAL", width: 110 },
            { title: "Cédula", field: "CEDULA", width: 100 },
            { title: "Nombres", field: "NOMBRES", width: 130 },
            { title: "Apellidos", field: "APELLIDOS", width: 130 },
            { title: "Puesto Funcional", field: "PUESTO_FUNCIONAL", width: 180 },
            { title: "Desc Pos SAP", field: "DESCRIPCION_POSICION_SAP", width: 180 },
            { title: "Condición", field: "CONDICION", width: 110 },
            { title: "Status FL", field: "STATUS_FL", width: 110, cssClass: "fw-bold text-primary" },
            { title: "Gerencia 1", field: "GERENCIA_1", width: 140 }
        ]
    });
    // Helper: populate and show Personal modal from a data object
    function populatePersonalModal(d) {
        if (!d) return;
        const setIf = (id, value, prop = 'value') => {
            const el = document.getElementById(id);
            if (!el) { console.warn(`populatePersonalModal: missing element #${id}`); return; }
            try { el[prop] = value; } catch (err) { console.warn(`populatePersonalModal: cannot set ${prop} on #${id}`, err); }
        };

        setIf('p-id', d.id || '');
        setIf('p-np', d.N_PERSONAL || '');
        setIf('p-cedula', d.CEDULA || '');
        setIf('p-nombre', d.NOMBRES || '');
        setIf('p-apellido', d.APELLIDOS || '');
        setIf('p-puesto', d.PUESTO_FUNCIONAL || '');
        setIf('p-desc-sap', d.DESCRIPCION_POSICION_SAP || '');
        setIf('p-descripcion', d.DESCRIPCION || '');
        setIf('p-fecha-nacimiento', d.FECHA_NACIMIENTO || '');
        setIf('p-fecha-ingreso', d.FECHA_INGRESO_EMPRESA || '');
        setIf('p-celular', d.CELULAR || '');
        setIf('p-condicion', d.CONDICION || 'NNC');
        setIf('p-statusFl', d.STATUS_FL || 'PRESENCIAL');
        setIf('p-g1', d.GERENCIA_1 || '');
        setIf('p-g2', d.GERENCIA_2 || '');
        setIf('p-g3', d.GERENCIA_3 || '');
        setIf('p-edificio', d.EDIFICIO || '');
        setIf('p-localidad', d.LOCALIDAD || '');
        setIf('p-municipio', d.MUNICIPIO || '');

        const hasCertDates = Boolean(d.VENCIMIENTO_FLOTA_PESADA || d.VENCIMIENTO_FLOTA_LIVIANA || d.VENCIMIENTO_MEDICO_VIAL);
        const certEl = document.getElementById('p-certs-activos');
        if (certEl) certEl.checked = hasCertDates;
        setIf('p-vencimiento-flota-pesada', d.VENCIMIENTO_FLOTA_PESADA || '');
        setIf('p-vencimiento-flota-liviana', d.VENCIMIENTO_FLOTA_LIVIANA || '');
        setIf('p-vencimiento-medico-vial', d.VENCIMIENTO_MEDICO_VIAL || '');
        toggleCertificateFields(hasCertDates);

        fotoBlobTemp = null;
        const pdfInput = document.getElementById('p-pdf-input'); if (pdfInput) pdfInput.value = '';
        const fotoInfo = document.getElementById('p-foto-info'); if (fotoInfo) fotoInfo.innerText = '';
        pdfBlobTemp = d.DOCUMENTO_PDF || null;

        if (d.FOTO_BLOB) {
            try {
                const urlCreator = window.URL || window.webkitURL;
                avatarPreview.src = urlCreator.createObjectURL(d.FOTO_BLOB);
                if (btnRemoveFoto) btnRemoveFoto.style.display = 'block';
                if (fotoInfo) fotoInfo.innerText = '🔋 Foto almacenada localmente';
            } catch (err) {
                avatarPreview.src = FOTO_PLACEHOLDER;
                if (btnRemoveFoto) btnRemoveFoto.style.display = 'none';
            }
        } else {
            avatarPreview.src = FOTO_PLACEHOLDER;
            if (btnRemoveFoto) btnRemoveFoto.style.display = 'none';
        }

        const pdfInfo = document.getElementById('p-pdf-info');
        const btnVerPdf = document.getElementById('btnVerPdf');
        if (d.DOCUMENTO_PDF) {
            if (pdfInfo) pdfInfo.innerText = '📄 Documento PDF de soporte guardado.';
            if (btnVerPdf) btnVerPdf.style.display = 'inline-block';
        } else {
            if (pdfInfo) pdfInfo.innerText = 'Sin documento digital adjunto.';
            if (btnVerPdf) btnVerPdf.style.display = 'none';
        }

        const btnEliminar = document.getElementById('btnEliminarPersonal'); if (btnEliminar) btnEliminar.style.display = 'block';
        if (typeof modPersonal !== 'undefined' && modPersonal) modPersonal.show();
    }

    // Wire Tabulator events: dblclick primary, click fallback
    tPersonal.on('rowDblClick', function (e, row) { populatePersonalModal(row.getData()); });
    tPersonal.on('rowClick', function (e, row) {
        // fallback: if dblclick happened recently, skip single-click action
        const last = window._tabulatorLastDblClick || 0;
        if (Date.now() - last < 300) return;
        // small delay to allow dblclick to fire first
        setTimeout(() => { populatePersonalModal(row.getData()); }, 220);
    });

    tVacaciones = new Tabulator("#tabla-vacaciones", {
        height: "540px",
        layout: "fitDataFill",
        pagination: "local",
        paginationSize: 50,
        placeholder: "No hay registros cargados en la programación vacacional.",
        columns: [
            { title: "MES", field: "MES", width: 90 },
            { title: "NOMINA", field: "NOMINA", width: 95 },
            { title: "GERENCIA", field: "GERENCIA", width: 160 },
            { title: "FECHA", field: "FECHA", width: 110 },
            { title: "CEDULA", field: "CEDULA", width: 100 },
            { title: "No/ SAP", field: "SAP", width: 100 },
            { title: "APELLIDOS", field: "APELLIDOS", width: 130 },
            { title: "NOMBRES", field: "NOMBRES", width: 130 },
            { title: "FECHA INGRESO", field: "FECHA_ING", width: 130 },
            { title: "DIAS PEND", field: "DIAS_PENDIENTES", width: 120 },
            { title: "PERIODO VACACIONAL", field: "PERIODO", width: 150 },
            { title: "DIAS LOTT", field: "DIAS_LOTT", width: 100 },
            { title: "DIAS HABILES", field: "DIAS_HABILES_DISFRUTE", width: 110 },
            { title: "DIAS CONTINUOS", field: "DIAS_CONTINUO_PLANTILLA", width: 120 },
            { title: "DESDE", field: "VACACIONES_DESDE", width: 130 },
            { title: "HASTA", field: "VACACIONES_HASTA", width: 130 },
            { title: "TOTAL DIAS", field: "TOTAL_DIAS", width: 100 },
            { title: "DIAS RESTANTE", field: "DIAS_RESTANTE", width: 110 },
            { title: "PERIODO RESTANTE", field: "PERIODO_RESTANTE", width: 140 },
            { title: "OBSERVACION", field: "OBSERVACION", width: 180 },
            { title: "RESPONSABLE ADM.", field: "RESPONSABLE_ADM", width: 160 },
            { title: "OBSERVACIONES CAIT", field: "OBSERVACIONES_CAIT", width: 160 },
            { title: "ESTATUS PROCESO", field: "PROCESADA_STATUS", width: 150, cssClass: "fw-bold text-center text-primary" },
            { title: "COD_AREA", field: "COD_AREA", width: 100 }
        ]
    });

    tVacaciones.on("rowDblClick", function (e, row) {
        const d = row.getData();
        document.getElementById('v-id').value = d.id;
        document.getElementById('v-mes').value = d.MES || '';
        document.getElementById('v-nomina').value = d.NOMINA || 'NNC';
        document.getElementById('v-gerencia').value = d.GERENCIA || '';
        document.getElementById('v-fecha').value = d.FECHA || '';
        document.getElementById('v-cedula').value = d.CEDULA || '';
        document.getElementById('v-sap').value = d.SAP || '';
        document.getElementById('v-apellidos').value = d.APELLIDOS || '';
        document.getElementById('v-nombres').value = d.NOMBRES || '';
        document.getElementById('v-fechaing').value = d.FECHA_ING || '';
        document.getElementById('v-dpendientes').value = d.DIAS_PENDIENTES || '';
        document.getElementById('v-periodo').value = d.PERIODO || '';
        document.getElementById('v-dlott').value = d.DIAS_LOTT || '';
        document.getElementById('v-desde').value = d.VACACIONES_DESDE || '';
        document.getElementById('v-hasta').value = d.VACACIONES_HASTA || '';
        document.getElementById('v-dhabiles').value = d.DIAS_HABILES_DISFRUTE || '';
        document.getElementById('v-dcontinuos').value = d.DIAS_CONTINUO_PLANTILLA || '';
        document.getElementById('v-totald').value = d.TOTAL_DIAS || '';
        document.getElementById('v-drestantes').value = d.DIAS_RESTANTE || '';
        document.getElementById('v-periodorestante').value = d.PERIODO_RESTANTE || '';
        document.getElementById('v-observacion').value = d.OBSERVACION || '';
        document.getElementById('v-responsable').value = d.RESPONSABLE_ADM || '';
        document.getElementById('v-cait').value = d.OBSERVACIONES_CAIT || '';
        document.getElementById('v-procesadastatus').value = d.PROCESADA_STATUS || '';
        document.getElementById('v-codarea').value = d.COD_AREA || '';
        document.getElementById('btnEliminarVacacion').style.display = "block";
        modVacaciones.show();
    });
}

// Controladores Drag and Drop de Avatar
dropZoneFoto.addEventListener('click', () => fileInputFoto.click());
dropZoneFoto.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneFoto.style.backgroundColor = '#dcfce7'; });
dropZoneFoto.addEventListener('dragleave', () => { dropZoneFoto.style.backgroundColor = '#f8f9fa'; });
dropZoneFoto.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZoneFoto.style.backgroundColor = '#f8f9fa';
    if (e.dataTransfer.files.length > 0) { procesarFotoSeleccionada(e.dataTransfer.files[0]); }
});
fileInputFoto.addEventListener('change', (e) => {
    if (e.target.files.length > 0) { procesarFotoSeleccionada(e.target.files[0]); }
});

function procesarFotoSeleccionada(file) {
    if (!file.type.startsWith('image/')) {
        swalError('Por favor, inserte un archivo de imagen válido (JPG o PNG).');
        return;
    }
    fotoBlobTemp = file;
    document.getElementById('p-foto-info').innerText = `📸 Lista: ${file.name}`;
    const reader = new FileReader();
    reader.onload = function (e) {
        avatarPreview.src = e.target.result;
        btnRemoveFoto.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

btnRemoveFoto.addEventListener('click', (e) => {
    e.stopPropagation();
    fotoBlobTemp = null;
    fileInputFoto.value = '';
    avatarPreview.src = FOTO_PLACEHOLDER;
    document.getElementById('p-foto-info').innerText = '';
    btnRemoveFoto.style.display = 'none';
});

function toggleCertificateFields(isActive) {
    const group = document.getElementById('p-certificates-group');
    if (!group) return;
    if (isActive) {
        group.classList.add('active');
        group.style.display = 'grid';
    } else {
        group.classList.remove('active');
        group.style.display = 'none';
        ['p-vencimiento-flota-pesada', 'p-vencimiento-flota-liviana', 'p-vencimiento-medico-vial'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });
    }
}

document.getElementById('p-certs-activos').addEventListener('change', (e) => {
    toggleCertificateFields(e.target.checked);
});

function abrirModalNuevoPersonal() {
    document.getElementById('formPersonal').reset();
    document.getElementById('p-id').value = "";
    fotoBlobTemp = null;
    pdfBlobTemp = null;
    avatarPreview.src = FOTO_PLACEHOLDER;
    btnRemoveFoto.style.display = 'none';
    document.getElementById('p-foto-info').innerText = '';
    document.getElementById('p-pdf-info').innerText = 'Sin documento digital adjunto.';
    document.getElementById('btnVerPdf').style.display = 'none';
    document.getElementById('p-certs-activos').checked = false;
    toggleCertificateFields(false);
    document.getElementById('p-fecha-ingreso').value = '';
    document.getElementById('btnEliminarPersonal').style.display = "none";
    modPersonal.show();
}

function abrirModalNuevaVacacion() {
    document.getElementById('formVacacion').reset();
    document.getElementById('v-id').value = "";
    document.getElementById('btnEliminarVacacion').style.display = "none";
    modVacaciones.show();
}

// Cálculo Dinámico de Días Continuos
function calcularDiasContinuos() {
    const fInicio = document.getElementById('v-desde').value;
    const fFin = document.getElementById('v-hasta').value;
    if (fInicio && fFin) {
        const date1 = new Date(fInicio + 'T00:00:00');
        const date2 = new Date(fFin + 'T00:00:00');
        if (date2 >= date1) {
            const diffTime = Math.abs(date2 - date1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            document.getElementById('v-dcontinuos').value = diffDays;
        } else {
            document.getElementById('v-dcontinuos').value = 0;
        }
    }
}
document.getElementById('v-desde').addEventListener('change', calcularDiasContinuos);
document.getElementById('v-hasta').addEventListener('change', calcularDiasContinuos);

// Vinculación Forzada en Caliente (On Blur Cédula)
document.getElementById('v-cedula').addEventListener('blur', async (e) => {
    const cedulaDigitada = e.target.value.trim();
    if (!cedulaDigitada) return;
    const empleado = await db.trabajadores.where("CEDULA").equals(cedulaDigitada).first();
    if (empleado) {
        document.getElementById('v-nombres').value = empleado.NOMBRES || '';
        document.getElementById('v-apellidos').value = empleado.APELLIDOS || '';
        document.getElementById('v-sap').value = empleado.POSICION_SAP || '';
        document.getElementById('v-gerencia').value = empleado.GERENCIA_1 || '';
        document.getElementById('v-fechaing').value = empleado.FECHA_INGRESO_EMPRESA || '';
        console.log(`🔗 Vinculación: ${empleado.NOMBRES} ${empleado.APELLIDOS}`);
    } else {
        swalWarning(`La cédula ${cedulaDigitada} no se encuentra registrada en el Maestro de Fuerza Laboral.\n\nRecuerde que para procesar esta vacación correctamente, el trabajador debe ser creado primero.`);
    }
});

// Visor del Blob de PDF Localhouse
document.getElementById('btnVerPdf').addEventListener('click', () => {
    if (!pdfBlobTemp) {
        swalInfo('No se localizó ningún archivo PDF de soporte para este registro de personal.');
        return;
    }
    try {
        const urlVisor = URL.createObjectURL(pdfBlobTemp);
        window.open(urlVisor, '_blank');
    } catch (err) {
        console.error("Error crítico al previsualizar PDF:", err);
        swalError('Error de renderizado: No se pudo abrir el documento PDF.');
    }
});

// Operaciones de Escritura y Edición Manual
document.getElementById('btnGuardarPersonal').addEventListener('click', async () => {
    const idStr = getInputValue('p-id');
    const pdfInputEl = document.getElementById('p-pdf-input');
    const filePdf = (pdfInputEl && pdfInputEl.files && pdfInputEl.files[0]) ? pdfInputEl.files[0] : null;

    const certEl = document.getElementById('p-certs-activos');
    const datos = {
        N_PERSONAL: getInputValue('p-np'),
        POSICION_SAP: getInputValue('p-np'),
        CEDULA: getInputValue('p-cedula'),
        NOMBRES: (getInputValue('p-nombre') || '').toUpperCase(),
        APELLIDOS: (getInputValue('p-apellido') || '').toUpperCase(),
        PUESTO_FUNCIONAL: getInputValue('p-puesto'),
        DESCRIPCION: getInputValue('p-descripcion'),
        DESCRIPCION_POSICION_SAP: getInputValue('p-desc-sap'),
        FECHA_NACIMIENTO: getInputValue('p-fecha-nacimiento') || null,
        FECHA_INGRESO_EMPRESA: getInputValue('p-fecha-ingreso') || null,
        POSEE_CERTIFICADOS: certEl ? !!certEl.checked : false,
        VENCIMIENTO_FLOTA_PESADA: getInputValue('p-vencimiento-flota-pesada') || null,
        VENCIMIENTO_FLOTA_LIVIANA: getInputValue('p-vencimiento-flota-liviana') || null,
        VENCIMIENTO_MEDICO_VIAL: getInputValue('p-vencimiento-medico-vial') || null,
        CONDICION: getInputValue('p-condicion'),
        STATUS_FL: getInputValue('p-statusFl'),
        GERENCIA_1: getInputValue('p-g1'),
        GERENCIA_2: getInputValue('p-g2'),
        GERENCIA_3: getInputValue('p-g3'),
        EDIFICIO: getInputValue('p-edificio'),
        LOCALIDAD: getInputValue('p-localidad'),
        CELULAR: getInputValue('p-celular'),
        MUNICIPIO: getInputValue('p-municipio'),
        FOTO_BLOB: fotoBlobTemp,
        DOCUMENTO_PDF: filePdf ? filePdf : null
    };

    if (!datos.CEDULA || !datos.NOMBRES || !datos.APELLIDOS) {
        swalWarning('Campos obligatorios faltantes: Cédula, Nombres y Apellidos.');
        return;
    }

    if (idStr) {
        const ant = await db.trabajadores.get(parseInt(idStr));
        if (ant) {
            if (!datos.FOTO_BLOB && ant.FOTO_BLOB) datos.FOTO_BLOB = ant.FOTO_BLOB;
            if (!datos.DOCUMENTO_PDF && ant.DOCUMENTO_PDF) datos.DOCUMENTO_PDF = ant.DOCUMENTO_PDF;
            await db.trabajadores.update(parseInt(idStr), datos);
        } else {
            await db.trabajadores.add(datos);
        }
    } else {
        await db.trabajadores.add(datos);
    }
    modPersonal.hide();
    cargarDatosLocales();
});

document.getElementById('btnGuardarVacacion').addEventListener('click', async () => {
    const idStr = document.getElementById('v-id').value;
    const cedulaBuscar = document.getElementById('v-cedula').value.trim();
    if (!cedulaBuscar) {
        swalWarning('La Cédula es un parámetro obligatorio para indexar las vacaciones.');
        return;
    }

    const trabajadorExiste = await db.trabajadores.where("CEDULA").equals(cedulaBuscar).first();
    if (!trabajadorExiste) {
        swalError(`El trabajador con la Cédula ${cedulaBuscar} NO existe en el Maestro.\n\nPor favor, créelo en el módulo de Fuerza Laboral.`);
        return;
    }

    const datos = {
        MES: document.getElementById('v-mes').value.trim().toUpperCase(),
        NOMINA: document.getElementById('v-nomina').value.trim().toUpperCase(),
        GERENCIA: document.getElementById('v-gerencia').value.trim(),
        FECHA: document.getElementById('v-fecha').value.trim(),
        CEDULA: cedulaBuscar,
        SAP: document.getElementById('v-sap').value.trim(),
        APELLIDOS: document.getElementById('v-apellidos').value.trim().toUpperCase(),
        NOMBRES: document.getElementById('v-nombres').value.trim().toUpperCase(),
        FECHA_ING: document.getElementById('v-fechaing').value.trim(),
        DIAS_PENDIENTES: parseInt(document.getElementById('v-dpendientes').value) || 0,
        PERIODO: document.getElementById('v-periodo').value.trim(),
        DIAS_LOTT: parseInt(document.getElementById('v-dlott').value) || 0,
        DIAS_HABILES_DISFRUTE: parseInt(document.getElementById('v-dhabiles').value) || 0,
        DIAS_CONTINUO_PLANTILLA: parseInt(document.getElementById('v-dcontinuos').value) || 0,
        TOTAL_DIAS: parseInt(document.getElementById('v-totald').value) || 0,
        DIAS_RESTANTE: parseInt(document.getElementById('v-drestantes').value) || 0,
        PERIODO_RESTANTE: document.getElementById('v-periodorestante').value.trim(),
        OBSERVACION: document.getElementById('v-observacion').value.trim(),
        RESPONSABLE_ADM: document.getElementById('v-responsable').value.trim(),
        OBSERVACIONES_CAIT: document.getElementById('v-cait').value.trim(),
        PROCESADA_STATUS: document.getElementById('v-procesadastatus').value.trim().toUpperCase(),
        COD_AREA: document.getElementById('v-codarea').value.trim().toUpperCase()
    };

    if (idStr) {
        await db.vacaciones.update(parseInt(idStr), datos);
    } else {
        await db.vacaciones.add(datos);
    }
    modVacaciones.hide();
    cargarDatosLocales();
});

// Purgas de Datos Unitarias y Masivas
document.getElementById('btnEliminarPersonal').addEventListener('click', async () => {
    const confirmed = await swalConfirm('¿Desea eliminar permanentemente a este trabajador y toda su documentación local?', 'Eliminar trabajador', 'Sí, eliminar', 'Cancelar');
    if (confirmed) {
        await db.trabajadores.delete(parseInt(document.getElementById('p-id').value));
        modPersonal.hide();
        cargarDatosLocales();
        swalSuccess('El trabajador ha sido eliminado del maestro local.');
    }
});

document.getElementById('btnEliminarVacacion').addEventListener('click', async () => {
    const confirmed = await swalConfirm('¿Desea purgar definitivamente esta programación de vacaciones del histórico?', 'Eliminar vacación', 'Sí, eliminar', 'Cancelar');
    if (confirmed) {
        await db.vacaciones.delete(parseInt(document.getElementById('v-id').value));
        modVacaciones.hide();
        cargarDatosLocales();
        swalSuccess('Registro de vacaciones eliminado correctamente.');
    }
});

document.getElementById('btnPurgarPersonal').addEventListener('click', async () => {
    const confirmFirst = await swalConfirm('¿Está seguro de borrar por completo el Maestro de Personal? Se eliminarán fotos y PDFs adjuntos.', 'Purgar Maestro de Personal', 'Continuar', 'Cancelar');
    if (confirmFirst) {
        const confirmSecond = await swalConfirm('Esta acción NO se puede deshacer. ¿Proceder?', 'Confirmación final', 'Sí, borrar todo', 'Cancelar');
        if (confirmSecond) {
            await db.trabajadores.clear();
            cargarDatosLocales();
            swalSuccess('🗑️ El almacén de Fuerza Laboral ha sido vaciado.');
        }
    }
});

document.getElementById('btnPurgarVacaciones').addEventListener('click', async () => {
    const confirmFirst = await swalConfirm('¿Desea borrar por completo la programación consolidada de vacaciones?', 'Purgar Vacaciones', 'Continuar', 'Cancelar');
    if (confirmFirst) {
        const confirmSecond = await swalConfirm('Los ciclos cargados se perderán. ¿Proceder?', 'Confirmación final', 'Sí, borrar todo', 'Cancelar');
        if (confirmSecond) {
            await db.vacaciones.clear();
            cargarDatosLocales();
            swalSuccess('🗑️ El almacén de Vacaciones ha sido vaciado.');
        }
    }
});

// Filtros Reactivos en Tiempo Real
document.getElementById('busquedaPersonal').addEventListener('keyup', function () {
    const val = this.value.trim().toLowerCase();
    if (!val) { tPersonal.clearFilter(); return; }
    tPersonal.setFilter(d => String(d.CEDULA).includes(val) || String(d.NOMBRES).toLowerCase().includes(val) || String(d.APELLIDOS).toLowerCase().includes(val) || String(d.N_PERSONAL).includes(val));
});

document.getElementById('busquedaVacaciones').addEventListener('keyup', function () {
    const val = this.value.trim().toLowerCase();
    if (!val) { tVacaciones.clearFilter(); return; }
    tVacaciones.setFilter(d => String(d.CEDULA).includes(val) || String(d.SAP).includes(val) || String(d.APELLIDOS).toLowerCase().includes(val) || String(d.MES).toLowerCase().includes(val));
});

// Lógica de Zona de Arrastre para Archivos Excel Masivos
setupDropZone("dropZonePersonal", "filePersonal", procesarExcelPersonal);
setupDropZone("dropZoneVacaciones", "fileVacaciones", procesarExcelVacaciones);

function setupDropZone(zoneId, inputId, procesarFn) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => { e.preventDefault(); procesarFn(e.dataTransfer.files[0]); });
    input.addEventListener('change', (e) => procesarFn(e.target.files[0]));
}

// Función Auxiliar para formatear fechas de celdas de Excel
function normalizarFechaExcel(celda) {
    if (!celda) return '';
    if (celda instanceof Date) {
        return celda.toISOString().split('T')[0];
    }
    return String(celda).trim();
}

function normalizeHeaderName(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/__+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function buildHeaderIndexMap(headerRow) {
    const map = {};
    (headerRow || []).forEach((cell, index) => {
        const normalized = normalizeHeaderName(cell);
        if (normalized) map[normalized] = index;
    });
    return map;
}

function headerRowHasMissingFields(headerRow, requiredFields) {
    const normalizedHeader = (headerRow || []).map(normalizeHeaderName);
    return requiredFields.filter(field => !normalizedHeader.includes(normalizeHeaderName(field)));
}

function procesarExcelPersonal(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets["DATOS"] || workbook.Sheets[workbook.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const header = filas[0] || [];
        const required = ["N_PERSONAL", "CEDULA", "NOMBRES", "APELLIDOS", "PUESTO_FUNCIONAL", "POSICION_SAP", "DESCRIPCION_POSICION_SAP", "DESCRIPCION"];
        const faltantes = headerRowHasMissingFields(header, required);
        if (faltantes.length) {
            swalError(`Plantilla inválida o columnas faltantes: ${faltantes.join(', ')}.\n\nDescargue la plantilla de ejemplo e intente de nuevo.`);
            document.getElementById('filePersonal').value = '';
            return;
        }

        const encabezados = buildHeaderIndexMap(header);
        const temp = [];
        await db.trabajadores.clear();
        for (let i = 1; i < filas.length; i++) {
            const r = filas[i];
            if (!r || r.length === 0 || !r[encabezados[normalizeHeaderName('CEDULA')]]) continue;
            temp.push({
                N_PERSONAL: r[encabezados[normalizeHeaderName('N_PERSONAL')]] ? String(r[encabezados[normalizeHeaderName('N_PERSONAL')]]).trim() : '',
                CEDULA: r[encabezados[normalizeHeaderName('CEDULA')]] ? String(r[encabezados[normalizeHeaderName('CEDULA')]]).trim() : '',
                NOMBRES: r[encabezados[normalizeHeaderName('NOMBRES')]] ? String(r[encabezados[normalizeHeaderName('NOMBRES')]]).trim().toUpperCase() : '',
                APELLIDOS: r[encabezados[normalizeHeaderName('APELLIDOS')]] ? String(r[encabezados[normalizeHeaderName('APELLIDOS')]]).trim().toUpperCase() : '',
                PUESTO_FUNCIONAL: r[encabezados[normalizeHeaderName('PUESTO_FUNCIONAL')]] ? String(r[encabezados[normalizeHeaderName('PUESTO_FUNCIONAL')]]).trim() : '',
                POSICION_SAP: r[encabezados[normalizeHeaderName('POSICION_SAP')]] ? String(r[encabezados[normalizeHeaderName('POSICION_SAP')]]).trim() : '',
                DESCRIPCION_POSICION_SAP: r[encabezados[normalizeHeaderName('DESCRIPCION_POSICION_SAP')]] ? String(r[encabezados[normalizeHeaderName('DESCRIPCION_POSICION_SAP')]]).trim() : '',
                DESCRIPCION: r[encabezados[normalizeHeaderName('DESCRIPCION')]] ? String(r[encabezados[normalizeHeaderName('DESCRIPCION')]]).trim() : '',
                FECHA_NACIMIENTO: null,
                FECHA_INGRESO_EMPRESA: null,
                POSEE_CERTIFICADOS: false,
                VENCIMIENTO_FLOTA_PESADA: null,
                VENCIMIENTO_FLOTA_LIVIANA: null,
                VENCIMIENTO_MEDICO_VIAL: null,
                CONDICION: r[encabezados[normalizeHeaderName('CONDICION')]] ? String(r[encabezados[normalizeHeaderName('CONDICION')]]).trim() : 'NNC',
                STATUS_FL: r[encabezados[normalizeHeaderName('STATUS_FL')]] ? String(r[encabezados[normalizeHeaderName('STATUS_FL')]]).trim() : 'PRESENCIAL',
                GERENCIA_1: r[encabezados[normalizeHeaderName('GERENCIA_1')]] ? String(r[encabezados[normalizeHeaderName('GERENCIA_1')]]).trim() : '',
                GERENCIA_2: r[encabezados[normalizeHeaderName('GERENCIA_2')]] ? String(r[encabezados[normalizeHeaderName('GERENCIA_2')]]).trim() : '',
                GERENCIA_3: r[encabezados[normalizeHeaderName('GERENCIA_3')]] ? String(r[encabezados[normalizeHeaderName('GERENCIA_3')]]).trim() : '',
                EDIFICIO: r[encabezados[normalizeHeaderName('EDIFICIO')]] ? String(r[encabezados[normalizeHeaderName('EDIFICIO')]]).trim() : '',
                LOCALIDAD: r[encabezados[normalizeHeaderName('LOCALIDAD')]] ? String(r[encabezados[normalizeHeaderName('LOCALIDAD')]]).trim() : '',
                CELULAR: r[encabezados[normalizeHeaderName('CELULAR')]] ? String(r[encabezados[normalizeHeaderName('CELULAR')]]).trim() : '',
                MUNICIPIO: r[encabezados[normalizeHeaderName('MUNICIPIO')]] ? String(r[encabezados[normalizeHeaderName('MUNICIPIO')]]).trim() : '',
                FOTO_BLOB: null,
                DOCUMENTO_PDF: null
            });
        }
        await db.trabajadores.bulkAdd(temp);
        document.getElementById('filePersonal').value = ''; // Corrección de re-upload
        cargarDatosLocales();
    };
    reader.readAsArrayBuffer(file);
}

function procesarExcelVacaciones(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        let filaInicio = 7;
        let tieneItemColumn = false;
        for (let i = 0; i < Math.min(filas.length, 15); i++) {
            if (filas[i]) {
                const normalizedRow = (filas[i] || []).map(normalizeHeaderName);
                if (normalizedRow.includes(normalizeHeaderName('CEDULA'))) {
                    filaInicio = i + 1;
                    tieneItemColumn = normalizedRow.includes(normalizeHeaderName('ITEM'));
                    break;
                }
            }
        }
        const headerRow = filas[filaInicio - 1] || [];
        const requiredVacHeaders = ["CEDULA", "SAP", "MES"];
        const missingVac = headerRowHasMissingFields(headerRow, requiredVacHeaders);
        if (missingVac.length) {
            swalError(`Plantilla de Vacaciones inválida o faltan columnas: ${missingVac.join(', ')}.\n\nDescargue la plantilla de ejemplo e intente de nuevo.`);
            document.getElementById('fileVacaciones').value = '';
            return;
        }
        const headerMap = buildHeaderIndexMap(headerRow);

        const temp = [];
        const cedulasNoEncontradas = new Set();
        await db.vacaciones.clear();

        for (let i = filaInicio; i < filas.length; i++) {
            const r = filas[i];
            if (!r || r.length === 0) continue;

            const cedulaExcel = String(r[headerMap[normalizeHeaderName('CEDULA')]] || '').trim();
            if (!cedulaExcel) continue;
            const existeEnMadre = await db.trabajadores.where("CEDULA").equals(cedulaExcel).first();
            if (!existeEnMadre) {
                cedulasNoEncontradas.add(cedulaExcel);
            }

            temp.push({
                MES: r[offset + 0] ? String(r[offset + 0]).trim().toUpperCase() : '',
                NOMINA: r[offset + 1] ? String(r[offset + 1]).trim().toUpperCase() : '',
                GERENCIA: r[offset + 2] ? String(r[offset + 2]).trim() : '',
                FECHA: normalizarFechaExcel(r[offset + 3]),
                CEDULA: cedulaExcel,
                SAP: r[offset + 5] ? String(r[offset + 5]).trim() : '',
                APELLIDOS: r[offset + 6] ? String(r[offset + 6]).trim().toUpperCase() : '',
                NOMBRES: r[offset + 7] ? String(r[offset + 7]).trim().toUpperCase() : '',
                FECHA_ING: normalizarFechaExcel(r[offset + 8]),
                DIAS_PENDIENTES: r[offset + 9] ? parseInt(r[offset + 9]) : 0,
                PERIODO: r[offset + 10] ? String(r[offset + 10]).trim() : '',
                DIAS_LOTT: r[offset + 11] ? parseInt(r[offset + 11]) : 0,
                DIAS_HABILES_DISFRUTE: r[offset + 12] ? parseInt(r[offset + 12]) : 0,
                DIAS_CONTINUO_PLANTILLA: r[offset + 13] ? parseInt(r[offset + 13]) : 0,
                VACACIONES_DESDE: normalizarFechaExcel(r[offset + 14]),
                VACACIONES_HASTA: normalizarFechaExcel(r[16]),
                TOTAL_DIAS: r[17] ? parseInt(r[17]) : 0,
                DIAS_RESTANTE: r[18] ? parseInt(r[18]) : 0,
                PERIODO_RESTANTE: r[19] ? String(r[19]).trim() : '',
                OBSERVACION: r[20] ? String(r[20]).trim() : '',
                RESPONSABLE_ADM: r[21] ? String(r[21]).trim() : '',
                OBSERVACIONES_CAIT: r[22] ? String(r[22]).trim() : '',
                PROCESADA_STATUS: r[23] ? String(r[23]).trim().toUpperCase() : '',
                COD_AREA: r[24] ? String(r[24]).trim().toUpperCase() : ''
            });
        }
        await db.vacaciones.bulkAdd(temp);
        document.getElementById('fileVacaciones').value = ''; // Corrección de re-upload
        cargarDatosLocales();

        if (cedulasNoEncontradas.size > 0) {
            swalWarning(`Carga masiva con inconsistencias. Se detectaron ${cedulasNoEncontradas.size} filas de vacaciones cuyas cédulas NO están registradas en el Maestro.\n\nCédulas huérfanas: ${Array.from(cedulasNoEncontradas).join(', ')}`);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Módulos Generadores de Exportación de Reportes Estructurados (.xlsx)
document.getElementById('btnExportarVacaciones').addEventListener('click', async () => {
    const registros = await db.vacaciones.toArray();
    if (registros.length === 0) return;

    const matriz = [
        ["GERENCIA DE ADMINISTRACION DE PERSONAL"],
        ["PROGRAMACION DE VACACIONES DEL PERSONAL"],
        ["CONSOLIDADO DE VACACIONES"],
        [], [], [],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "FECHA DE DISFRUTE"],
        ["MES", "NOMINA", "GERENCIA", "FECHA", "CEDULA", "No/ SAP", "APELLIDOS", "NOMBRES", "FECHA DE INGRESO", "DIAS PENDIENTES", "CORRESPONDIENTE AL PERIODO VACACIONAL", "DIAS LOTT", "DIAS HABILES", "DIAS CONTINUO", "VACACIONES DESDE", "VACACIONES HASTA", "TOTAL DIAS", "DIAS RESTANTE", "PERIODO RESTANTE", "OBSERVACION", "RESPONSABLE ADM", "OBSERVACIONES CAIT", "PROCESADA / NO PROCESADA", "COD_AREA"]
    ];

    registros.forEach(v => {
        matriz.push([v.MES, v.NOMINA, v.GERENCIA, v.FECHA, v.CEDULA, v.SAP, v.APELLIDOS, v.NOMBRES, v.FECHA_ING, v.DIAS_PENDIENTES, v.PERIODO, v.DIAS_LOTT, v.DIAS_HABILES_DISFRUTE, v.DIAS_CONTINUO_PLANTILLA, v.VACACIONES_DESDE, v.VACACIONES_HASTA, v.TOTAL_DIAS, v.DIAS_RESTANTE, v.PERIODO_RESTANTE, v.OBSERVACION, v.RESPONSABLE_ADM, v.OBSERVACIONES_CAIT, v.PROCESADA_STATUS, v.COD_AREA]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(matriz);
    XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");
    XLSX.writeFile(wb, "VACACIONES_CONSOLIDADO_REPORTE.xlsx");
});

// Descargar plantilla ejemplo para Vacaciones
function downloadTemplateVacaciones() {
    const headers = [["MES", "NOMINA", "GERENCIA", "FECHA", "CEDULA", "SAP", "APELLIDOS", "NOMBRES", "FECHA_ING", "DIAS_PENDIENTES", "PERIODO", "DIAS_LOTT", "DIAS_HABILES_DISFRUTE", "DIAS_CONTINUO_PLANTILLA", "VACACIONES_DESDE", "VACACIONES_HASTA", "TOTAL_DIAS", "DIAS_RESTANTE", "PERIODO_RESTANTE", "OBSERVACION", "RESPONSABLE_ADM", "OBSERVACIONES_CAIT", "PROCESADA_STATUS", "COD_AREA"]];
    const ejemplo = [["ENERO", "NNC", "GERENCIA X", "2026-01-01", "01234567", "SAP123", "PEREZ", "JUAN", "2010-05-01", 30, "2026", 0, 15, 15, "2026-01-10", "2026-01-24", 15, 15, "2026", "Sin observaciones", "ADMIN", "OK", "NO", "AREA1"]];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers.concat(ejemplo));
    XLSX.utils.book_append_sheet(wb, ws, "Vacaciones");
    XLSX.writeFile(wb, "Plantilla_Vacaciones.xlsx");
}

document.getElementById('btnTemplateVacaciones').addEventListener('click', downloadTemplateVacaciones);

document.getElementById('btnTour').addEventListener('click', startGuidedTour);

function createTourElements() {
    if (document.getElementById('tourOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'tourOverlay';
    overlay.className = 'tour-overlay';
    overlay.style.display = 'none';

    const highlight = document.createElement('div');
    highlight.id = 'tourHighlight';
    highlight.className = 'tour-highlight';
    highlight.style.display = 'none';

    const tooltip = document.createElement('div');
    tooltip.id = 'tourTooltip';
    tooltip.className = 'tour-tooltip';
    tooltip.style.display = 'none';

    document.body.appendChild(overlay);
    document.body.appendChild(highlight);
    document.body.appendChild(tooltip);
}

const tourSteps = [
    {
        selector: '#vista-menu',
        title: 'Bienvenido a RIVEROJDU',
        content: 'Esta guía rápida te muestra los controles principales del sistema de Gestión de Personal y Vacaciones. Usa los botones para navegar entre módulos, importar datos y respaldar la base local.'
    },
    {
        selector: '#btnPurgarPersonal',
        title: 'Limpieza de Maestro',
        content: 'Aquí puedes borrar todo el maestro de Fuerza Laboral si necesitas reiniciar la carga de datos.',
        action: () => cambiarVista('personal')
    },
    {
        selector: '#dropZonePersonal',
        title: 'Importar Fuerza Laboral',
        content: 'Arrastra o selecciona tu archivo Excel con los datos de Fuerza Laboral. Usa la plantilla de ejemplo para respetar el formato.'
    },
    {
        selector: '#btnTemplatePersonal',
        title: 'Plantilla de Fuerza Laboral',
        content: 'Descarga esta plantilla para llenar los datos correctamente antes de importarlos al sistema.'
    },
    {
        selector: '#btnExportarPersonal',
        title: 'Exportar Datos',
        content: 'Exporta el maestro de Fuerza Laboral a Excel con toda la información cargada en el sistema.',
        action: () => cambiarVista('personal')
    },
    {
        selector: '#btnTemplateVacaciones',
        title: 'Plantilla de Vacaciones',
        content: 'Descarga este formato de importación para programar las vacaciones del personal.',
        action: () => cambiarVista('vacaciones')
    },
    {
        selector: '#dropZoneVacaciones',
        title: 'Importar Vacaciones',
        content: 'Arrastra la plantilla de Vacaciones aquí para cargar los periodos y cálculos al sistema.',
        action: () => cambiarVista('vacaciones')
    },
    {
        selector: '#btnBackupDB',
        title: 'Respaldo de Base de Datos',
        content: 'Guarda todo el estado de la base local en un archivo descargable, útil antes de hacer cambios importantes.'
    }
];

let tourIndex = 0;

function getTourElements() {
    return {
        overlay: document.getElementById('tourOverlay'),
        highlight: document.getElementById('tourHighlight'),
        tooltip: document.getElementById('tourTooltip')
    };
}

function showTourStep(index) {
    const step = tourSteps[index];
    const { overlay, highlight, tooltip } = getTourElements();
    if (!step) return endGuidedTour();

    if (typeof step.action === 'function') {
        step.action();
    }

    setTimeout(() => {
        const target = document.querySelector(step.selector);
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            const rect = target.getBoundingClientRect();
            highlight.style.display = 'block';
            highlight.style.top = `${rect.top + window.scrollY - 10}px`;
            highlight.style.left = `${rect.left + window.scrollX - 10}px`;
            highlight.style.width = `${rect.width + 20}px`;
            highlight.style.height = `${rect.height + 20}px`;

            let tooltipTop = rect.bottom + window.scrollY + 14;
            let tooltipLeft = rect.left + window.scrollX;
            if (tooltipTop + 220 > window.scrollY + window.innerHeight) {
                tooltipTop = rect.top + window.scrollY - 220;
            }
            if (tooltipLeft + 380 > window.scrollX + window.innerWidth) {
                tooltipLeft = window.scrollX + window.innerWidth - 400;
            }
            tooltip.style.top = `${Math.max(tooltipTop, window.scrollY + 20)}px`;
            tooltip.style.left = `${Math.max(tooltipLeft, window.scrollX + 20)}px`;
        } else {
            highlight.style.display = 'none';
            tooltip.style.top = `${window.scrollY + 80}px`;
            tooltip.style.left = `${window.scrollX + 24}px`;
        }

        tooltip.innerHTML = `
            <div class="tour-title">${step.title}</div>
            <div>${step.content}</div>
            <div class="tour-actions">
                <button type="button" class="btn btn-outline-secondary" onclick="prevTourStep()" ${index === 0 ? 'disabled' : ''}>Anterior</button>
                <button type="button" class="btn btn-outline-danger" onclick="endGuidedTour()">Cerrar</button>
                <button type="button" class="btn btn-primary" onclick="nextTourStep()">${index === tourSteps.length - 1 ? 'Finalizar' : 'Siguiente'}</button>
            </div>
        `;
        overlay.style.display = 'block';
        tooltip.style.display = 'block';
    }, 260);
}

function nextTourStep() {
    tourIndex = Math.min(tourIndex + 1, tourSteps.length - 1);
    showTourStep(tourIndex);
}

function prevTourStep() {
    tourIndex = Math.max(tourIndex - 1, 0);
    showTourStep(tourIndex);
}

function startGuidedTour() {
    createTourElements();
    tourIndex = 0;
    showTourStep(tourIndex);
}

function endGuidedTour() {
    const { overlay, highlight, tooltip } = getTourElements();
    if (overlay) overlay.style.display = 'none';
    if (highlight) highlight.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
}

document.getElementById('btnExportarPersonal').addEventListener('click', async () => {
    const registros = await db.trabajadores.toArray();
    if (registros.length === 0) return;

    const matriz = [["N_PERSONAL", "CEDULA", "NOMBRES", "APELLIDOS", "PUESTO_FUNCIONAL", "POSICION_SAP", "DESCRIPCION_POSICION_SAP", "DESCRIPCION", "FECHA_NACIMIENTO", "FECHA_INGRESO_EMPRESA", "POSEE_CERTIFICADOS", "VENCIMIENTO_FLOTA_PESADA", "VENCIMIENTO_FLOTA_LIVIANA", "VENCIMIENTO_MEDICO_VIAL", "CONDICION", "STATUS_FL", "GERENCIA_1", "GERENCIA_2", "GERENCIA_3", "EDIFICIO", "LOCALIDAD", "CELULAR", "MUNICIPIO"]];

    registros.forEach(t => {
        matriz.push([t.N_PERSONAL, t.CEDULA, t.NOMBRES, t.APELLIDOS, t.PUESTO_FUNCIONAL, t.POSICION_SAP, t.DESCRIPCION_POSICION_SAP || '', t.DESCRIPCION, t.FECHA_NACIMIENTO || '', t.FECHA_INGRESO_EMPRESA || '', t.POSEE_CERTIFICADOS ? 'SI' : 'NO', t.VENCIMIENTO_FLOTA_PESADA || '', t.VENCIMIENTO_FLOTA_LIVIANA || '', t.VENCIMIENTO_MEDICO_VIAL || '', t.CONDICION, t.STATUS_FL, t.GERENCIA_1, t.GERENCIA_2, t.GERENCIA_3, t.EDIFICIO, t.LOCALIDAD, t.CELULAR, t.MUNICIPIO]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(matriz);
    XLSX.utils.book_append_sheet(wb, ws, "DATOS");
    XLSX.writeFile(wb, "FuerzaLaboral_Consolidado.xlsx");
});

// Descargar plantilla ejemplo para Fuerza Laboral
function downloadTemplatePersonal() {
    const headers = [["N_PERSONAL", "CEDULA", "NOMBRES", "APELLIDOS", "PUESTO_FUNCIONAL", "POSICION_SAP", "DESCRIPCION_POSICION_SAP", "DESCRIPCION", "FECHA_NACIMIENTO", "FECHA_INGRESO_EMPRESA", "POSEE_CERTIFICADOS", "VENCIMIENTO_FLOTA_PESADA", "VENCIMIENTO_FLOTA_LIVIANA", "VENCIMIENTO_MEDICO_VIAL", "CONDICION", "STATUS_FL", "GERENCIA_1", "GERENCIA_2", "GERENCIA_3", "EDIFICIO", "LOCALIDAD", "CELULAR", "MUNICIPIO"]];
    const ejemplo = [["12345", "01234567", "JUAN", "PEREZ", "CHOFER", "SAP123", "CHOFER PRINCIPAL", "CONDUCTOR", "1980-01-10", "2010-05-01", "NO", "", "", "", "NNC", "PRESENCIAL", "GERENCIA X", "AREA Y", "DEPARTAMENTO Z", "ED1", "LOCALIDAD A", "71234567", "MUNICIPIO"]];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(headers.concat(ejemplo));
    XLSX.utils.book_append_sheet(wb, ws, "DATOS");
    XLSX.writeFile(wb, "Plantilla_FuerzaLaboral.xlsx");
}

document.getElementById('btnTemplatePersonal').addEventListener('click', downloadTemplatePersonal);

async function cargarDatosLocales() {
    const p = await db.trabajadores.toArray();
    const v = await db.vacaciones.toArray();
    tPersonal.setData(p);
    tVacaciones.setData(v);
    const sessionUser = sessionStorage.getItem(SESSION_USER_KEY) || 'Invitado';
    document.getElementById('global-status').innerText = `🔋 Base local activa | Personal: ${p.length} | Vacaciones: ${v.length} | Usuario: ${sessionUser}`;
}

function openAdminModal() {
    const modalEl = document.getElementById('modalAdminAccess');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    modal.show();
}

function resetAdminModal() {
    const passwordInput = document.getElementById('admin-password');
    const message = document.getElementById('adminPasswordMessage');
    const actionsArea = document.getElementById('adminActionsArea');
    const passwordArea = document.getElementById('adminPasswordArea');

    if (passwordInput) passwordInput.value = '';
    if (message) message.textContent = '';
    if (actionsArea) actionsArea.classList.add('d-none');
    if (passwordArea) passwordArea.classList.remove('d-none');
}

function unlockAdminActions() {
    const passwordInput = document.getElementById('admin-password');
    const message = document.getElementById('adminPasswordMessage');
    const actionsArea = document.getElementById('adminActionsArea');
    const passwordArea = document.getElementById('adminPasswordArea');
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (password === 'Raida17') {
        if (message) message.textContent = '';
        if (actionsArea) actionsArea.classList.remove('d-none');
        if (passwordArea) passwordArea.classList.add('d-none');
    } else {
        if (message) message.textContent = 'Contraseña incorrecta. Intente nuevamente.';
    }
}

// Disparo Inicial Forzado
inicializarTablas();
cargarDatosLocales();
configureNumericFields('#p-np,#p-cedula,#p-celular,#v-sap,#v-cedula');
btnLogin.addEventListener('click', verificarAcceso);
btnCerrarSesionNav.addEventListener('click', cerrarSesion);
btnBackupDB.addEventListener('click', exportDatabaseBackup);
btnRestaurarBackup.addEventListener('click', () => fileBackupRestore.click());
fileBackupRestore.addEventListener('change', async (e) => {
    if (e.target.files.length) {
        await restoreDatabaseBackup(e.target.files[0]);
    }
    e.target.value = '';
});
dropZoneBackup.addEventListener('click', () => fileBackupRestore.click());
dropZoneBackup.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneBackup.style.backgroundColor = '#e0f2fe'; });
dropZoneBackup.addEventListener('dragleave', () => { dropZoneBackup.style.backgroundColor = ''; });
dropZoneBackup.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneBackup.style.backgroundColor = '';
    if (e.dataTransfer.files.length) {
        await restoreDatabaseBackup(e.dataTransfer.files[0]);
    }
});
document.getElementById('btnAdminOpen').addEventListener('click', openAdminModal);
document.getElementById('btnUnlockAdmin').addEventListener('click', unlockAdminActions);
document.getElementById('admin-password').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') unlockAdminActions();
});

document.getElementById('modalAdminAccess').addEventListener('hidden.bs.modal', resetAdminModal);
document.getElementById('login-pass').addEventListener('keyup', (e) => {
    if (e.key === 'Enter') verificarAcceso();
});
verificarSesionAlCargar();