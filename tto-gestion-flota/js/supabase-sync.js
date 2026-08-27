// js/supabase-sync.js
// Helpers para subir imágenes base64 a Supabase Storage y para realizar upserts con subida de assets.
// Expone window.TTOCC_SUPABASE_SYNC.syncAndUpsert(tableName, rows, opts)

(function () {
    'use strict';

    function base64ToBlob(base64Data, contentType = 'image/jpeg') {
        const sliceSize = 1024;
        const byteCharacters = atob(base64Data.replace(/^data:image\/[a-zA-Z]+;base64,/, ''));
        const bytesLength = byteCharacters.length;
        const slicesCount = Math.ceil(bytesLength / sliceSize);
        const byteArrays = new Array(slicesCount);

        for (let sliceIndex = 0; sliceIndex < slicesCount; ++sliceIndex) {
            const begin = sliceIndex * sliceSize;
            const end = Math.min(begin + sliceSize, bytesLength);

            const bytes = new Array(end - begin);
            for (let offset = begin, i = 0; offset < end; ++i, ++offset) {
                bytes[i] = byteCharacters.charCodeAt(offset);
            }
            byteArrays[sliceIndex] = new Uint8Array(bytes);
        }

        return new Blob(byteArrays, { type: contentType });
    }

    async function ensureClient() {
        if (window.TTOCC_SUPABASE_CLIENT) return window.TTOCC_SUPABASE_CLIENT;
        if (typeof ensureSupabaseClient === 'function') {
            const client = ensureSupabaseClient();
            if (client) return client;
        }
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            // If app provided keys on window, try to create
            const url = window.TTOCC_SUPABASE_URL || '';
            const key = window.TTOCC_SUPABASE_ANON_KEY || '';
            if (url && key) {
                window.TTOCC_SUPABASE_CLIENT = window.supabase.createClient(url, key);
                return window.TTOCC_SUPABASE_CLIENT;
            }
        }
        return null;
    }

    async function uploadBase64ToStorage(client, bucketName, path, base64data) {
        try {
            if (!base64data) return null;
            let mime = 'image/jpeg';
            const dataUriMatch = String(base64data).match(/^data:([^;]+);base64,/);
            if (dataUriMatch) mime = dataUriMatch[1];
            const blob = base64ToBlob(base64data, mime);

            const uploadRes = await client.storage.from(bucketName).upload(path, blob, { upsert: true });
            if (uploadRes.error) {
                console.warn('[Supabase Storage] Error uploading', uploadRes.error);
                return null;
            }
            const filePath = uploadRes.data && uploadRes.data.path ? uploadRes.data.path : path;

            // Try signed URL first for private buckets
            try {
                const signedRes = await client.storage.from(bucketName).createSignedUrl(filePath, 7200);
                if (signedRes && signedRes.data && signedRes.data.signedUrl) {
                    return signedRes.data.signedUrl;
                }
            } catch (eSigned) {
                console.warn('[Supabase Storage] Error creating signedUrl:', eSigned);
            }

            const urlRes = client.storage.from(bucketName).getPublicUrl(filePath);
            if (urlRes && urlRes.data && urlRes.data.publicUrl) return urlRes.data.publicUrl;

            const baseUrl = window.TTOCC_SUPABASE_URL || 'https://mfklcwrpgavaxznkxlra.supabase.co';
            return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${filePath}`;
        } catch (e) {
            console.error('[Supabase Storage] Exception uploading base64', e);
            return null;
        }
    }

    async function uploadFileToStorage(client, bucketName, path, file) {
        try {
            if (!client || !file) return null;
            const uploadRes = await client.storage.from(bucketName).upload(path, file, { upsert: true });
            if (uploadRes.error) {
                console.warn('[Supabase Storage] Error uploading file', uploadRes.error);
                return null;
            }
            const filePath = uploadRes.data && (uploadRes.data.path || uploadRes.data.Key || uploadRes.data.name) ? (uploadRes.data.path || uploadRes.data.Key || uploadRes.data.name) : path;

            // Try signed URL first for private buckets
            try {
                const signedRes = await client.storage.from(bucketName).createSignedUrl(filePath, 7200);
                if (signedRes && signedRes.data && signedRes.data.signedUrl) {
                    return signedRes.data.signedUrl;
                }
            } catch (eSigned) {
                console.warn('[Supabase Storage] Error creating signedUrl:', eSigned);
            }

            const urlRes = client.storage.from(bucketName).getPublicUrl(filePath);
            if (urlRes && urlRes.data && urlRes.data.publicUrl) return urlRes.data.publicUrl;

            const baseUrl = window.TTOCC_SUPABASE_URL || 'https://mfklcwrpgavaxznkxlra.supabase.co';
            return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${filePath}`;
        } catch (e) {
            console.error('[Supabase Storage] Exception uploading file', e);
            return null;
        }
    }

    async function prepareRecordAssets(client, bucketName, record, id) {
        // Upload any fields that end with _base64.
        // For private buckets we use a server-signed URL flow: request a signed upload URL from an authenticated endpoint
        // (default: /api/sign-upload) and PUT the Blob there. For public buckets we keep the original client.storage upload.
        try {
            const out = Object.assign({}, record);
            const keys = Object.keys(out);

            // Signing endpoint and auth helpers (configurable via globals)
            const signEndpoint = window.TTOCC_SIGN_UPLOAD_ENDPOINT || '/api/sign-upload';
            const signHeaders = { 'Content-Type': 'application/json' };
            if (window.TTOCC_SIGN_UPLOAD_API_KEY) signHeaders['x-api-key'] = window.TTOCC_SIGN_UPLOAD_API_KEY;
            if (window.TTOCC_SIGN_UPLOAD_JWT) signHeaders['Authorization'] = 'Bearer ' + window.TTOCC_SIGN_UPLOAD_JWT;
            const bucketPublicFlag = window.TTOCC_BUCKET_PUBLIC === true || window.TTOCC_BUCKET_PUBLIC === 'true' || false;

            for (const k of keys) {
                if (!k.endsWith('_base64')) continue;
                const baseKey = k.replace(/_base64$/, '');
                const base64data = out[k];
                if (!base64data) {
                    delete out[k];
                    continue;
                }

                // Detect extension and mime
                let ext = 'jpg';
                let mime = 'image/jpeg';
                const mimeMatch = String(base64data).match(/^data:([^;]+);base64,/);
                if (mimeMatch) {
                    mime = mimeMatch[1];
                    if (mime === 'application/pdf') ext = 'pdf';
                    else if (mime === 'image/png') ext = 'png';
                    else if (mime === 'image/webp') ext = 'webp';
                    else if (/jpeg|jpg/.test(mime)) ext = 'jpg';
                }

                const path = `${id}/${baseKey}.${ext}`;

                let uploadedUrl = null;

                // Try direct upload to client storage first
                try {
                    uploadedUrl = await uploadBase64ToStorage(client, bucketName, path, base64data);
                } catch (eStorage) {
                    console.warn('[Supabase Sync] Direct client storage upload error, trying sign endpoint:', eStorage);
                }

                // If direct upload returned no URL and a sign-upload helper is explicitly configured, try signEndpoint
                if (!uploadedUrl && window.TTOCC_SIGN_UPLOAD_ENDPOINT) {
                    try {
                        const res = await fetch(signEndpoint, {
                            method: 'POST',
                            headers: signHeaders,
                            body: JSON.stringify({ bucket: bucketName, path: path, expires: 600 })
                        });
                        if (res.ok) {
                            const j = await res.json();
                            const signedUrl = j.signedUrl || j.signedURL || j.signedurl;
                            if (signedUrl) {
                                const putRes = await fetch(signedUrl, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': mime },
                                    body: base64ToBlob(base64data, mime)
                                });
                                if (putRes.ok) {
                                    uploadedUrl = (window.TTOCC_SUPABASE_URL && bucketPublicFlag)
                                        ? `${window.TTOCC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${path}`
                                        : path;
                                }
                            }
                        }
                    } catch (eSign) {
                        console.warn('[Supabase Sync] sign endpoint fallback failed:', eSign);
                    }
                }

                if (uploadedUrl) {
                    out[baseKey] = uploadedUrl;
                    delete out[k];
                } else if (!out[baseKey] && base64data) {
                    // Retain data URI in target field if storage upload is unsuccessful
                    out[baseKey] = base64data;
                    delete out[k];
                } else {
                    delete out[k];
                }
            }

            // If tareas is string, try parse to JSON
            if (typeof out.tareas === 'string') {
                try { out.tareas = JSON.parse(out.tareas); } catch (e) { /* keep string */ }
            }
            return out;
        } catch (e) {
            console.error('[Supabase Sync] prepareRecordAssets error', e);
            return record;
        }
    }

    function parseCustomDateToISO(str) {
        if (!str || typeof str !== 'string' || !str.trim() || str.trim().toUpperCase() === 'N/A' || str.trim().toUpperCase() === 'PENDIENTE' || str.trim().toUpperCase() === 'S/F') return null;
        const cleanStr = str.trim();
        const ddmmyyyy = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
        if (ddmmyyyy) {
            const day = parseInt(ddmmyyyy[1], 10);
            const month = parseInt(ddmmyyyy[2], 10) - 1;
            const year = parseInt(ddmmyyyy[3], 10);
            const hour = parseInt(ddmmyyyy[4] || '0', 10);
            const min = parseInt(ddmmyyyy[5] || '0', 10);
            const sec = parseInt(ddmmyyyy[6] || '0', 10);
            const d = new Date(Date.UTC(year, month, day, hour, min, sec));
            return d.toISOString();
        }
        const isoDate = new Date(cleanStr);
        if (!isNaN(isoDate.getTime())) {
            return isoDate.toISOString();
        }
        return null;
    }

    async function syncAndUpsert(tableName, rows, opts = {}) {
        // Default bucket for project assets
        const bucket = opts.bucket || 'ttocc-archivos';
        const client = await ensureClient();
        if (!client) {
            console.warn('[Supabase Sync] Supabase client not available.');
            return { error: 'no_client' };
        }

        const prepared = [];
        for (const r of rows) {
            const id = String(r.id || r.ID_Registro || r.id_registro || r.id_unidad || r.ID_Unidad || (r.id && r.id.toString()) || (crypto && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`));
            const recWithId = Object.assign({}, r, { id: id });
            const ready = await prepareRecordAssets(client, bucket, recWithId, id);

            // Column field mappings & date sanitization
            if (ready.flota && !ready.tipo_flota) ready.tipo_flota = ready.flota;
            if (ready.nombre_taller_ext && !ready.taller_ext) ready.taller_ext = ready.nombre_taller_ext;
            if (ready.unidad && !ready.id_unidad) ready.id_unidad = ready.unidad;

            if (ready.fecha_ingreso) ready.fecha_ingreso = parseCustomDateToISO(ready.fecha_ingreso);
            if (ready.fecha_salida) ready.fecha_salida = parseCustomDateToISO(ready.fecha_salida);
            if (ready.ubicacion_taller_fecha) ready.ubicacion_taller_fecha = parseCustomDateToISO(ready.ubicacion_taller_fecha);

            // Whitelist depending on table
            let columnasPermitidas = [
                'id', 'id_unidad', 'tipo_flota', 'nombre_taller', 'taller_ext', 'estatus',
                'observaciones', 'marca', 'modelo', 'color', 'anio', 'vin', 'tipo_vehiculo',
                'avance', 'foto_antes', 'foto_despues', 'fecha_ingreso', 'fecha_salida',
                'gerencia', 'usuario', 'cargo_usuario', 'tareas', 'modificado_por', 'metadata', 'updated_at'
            ];

            if (tableName === 'maestro_activos' || tableName === 'activos' || tableName === 'registros_activos') {
                columnasPermitidas = [
                    'id_unidad', 'placa', 'vin', 'marca', 'modelo', 'anio', 'color',
                    'tipo_vehiculo', 'tipo_flota', 'estatus_final', 'situacion_actual',
                    'gerencia', 'responsable_usuario', 'cargo_usuario', 'ubicacion_taller',
                    'ubicacion_taller_fecha', 'documento_url', 'documento_nombre', 'metadata', 'updated_at'
                ];
            }

            const cleanRecord = {};
            for (const col of columnasPermitidas) {
                if (ready[col] !== undefined && ready[col] !== null) {
                    cleanRecord[col] = ready[col];
                }
            }
            if (tableName === 'maestro_activos' || tableName === 'activos' || tableName === 'registros_activos') {
                cleanRecord.id_unidad = String(ready.id_unidad || ready.id);
            } else {
                cleanRecord.id = String(id);
            }
            cleanRecord.updated_at = new Date().toISOString();

            prepared.push(cleanRecord);
        }

        const conflictCol = (tableName === 'maestro_activos' || tableName === 'activos' || tableName === 'registros_activos') ? 'id_unidad' : 'id';

        try {
            const upsertRes = await client.from(tableName).upsert(prepared, { onConflict: conflictCol }).select();
            if (upsertRes.error) {
                console.warn('[Supabase Sync] upsert error', upsertRes.error);
                return { error: upsertRes.error };
            }
            return { data: upsertRes.data };
        } catch (e) {
            console.error('[Supabase Sync] Exception during upsert', e);
            return { error: e };
        }
    }

    window.TTOCC_SUPABASE_SYNC = {
        uploadBase64ToStorage,
        prepareRecordAssets,
        syncAndUpsert
    };

})();
