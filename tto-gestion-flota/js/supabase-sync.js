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
            // Attempt to sniff mime type from data URI
            let mime = 'image/jpeg';
            const dataUriMatch = String(base64data).match(/^data:([^;]+);base64,/);
            if (dataUriMatch) mime = dataUriMatch[1];
            const blob = base64ToBlob(base64data, mime);

            const uploadRes = await client.storage.from(bucketName).upload(path, blob, { upsert: true });
            if (uploadRes.error) {
                console.warn('[Supabase Storage] Error uploading', uploadRes.error);
                return null;
            }
            // Get public URL (may be internal object depending on bucket settings)
            const urlRes = client.storage.from(bucketName).getPublicUrl(uploadRes.data.path || path);
            // v2 returns { data: { publicUrl }, error }
            if (urlRes && urlRes.data && urlRes.data.publicUrl) return urlRes.data.publicUrl;
            // fallback
            return null;
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
            const urlRes = client.storage.from(bucketName).getPublicUrl(filePath);
            if (urlRes && urlRes.data && urlRes.data.publicUrl) return urlRes.data.publicUrl;
            return null;
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

                // Prefer Signed URL flow when sign endpoint is reachable (private buckets)
                let uploadedUrl = null;
                try {
                    // If a global helper exists, use it
                    if (typeof window.requestSignedUrl === 'function') {
                        // signature: requestSignedUrl(apiEndpoint, bucket, path, expires)
                        const signed = await window.requestSignedUrl(signEndpoint, bucketName, path, 600);
                        if (signed) {
                            await fetch(signed, { method: 'PUT', headers: { 'Content-Type': mime }, body: base64ToBlob(base64data, mime) });
                            // if bucket is public, construct public URL
                            if (window.TTOCC_SUPABASE_URL && bucketPublicFlag) {
                                uploadedUrl = `${window.TTOCC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${path}`;
                            } else {
                                // store internal path for server-side resolve
                                uploadedUrl = path;
                            }
                        }
                    } else {
                        // Fallback: call sign endpoint directly
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
                                if (!putRes.ok) {
                                    console.warn('[Supabase Sync] upload to signed URL failed', await putRes.text());
                                } else {
                                    if (window.TTOCC_SUPABASE_URL && bucketPublicFlag) {
                                        uploadedUrl = `${window.TTOCC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${bucketName}/${path}`;
                                    } else {
                                        uploadedUrl = path;
                                    }
                                }
                            }
                        } else {
                            const text = await res.text();
                            console.warn('[Supabase Sync] sign-endpoint error', res.status, text);
                            // As a fallback, attempt client upload (may fail for private buckets)
                            const publicUrl = await uploadBase64ToStorage(client, bucketName, path, base64data);
                            if (publicUrl) uploadedUrl = publicUrl;
                        }
                    }
                } catch (e) {
                    console.warn('[Supabase Sync] signed upload error, falling back to client upload', e);
                    const publicUrl = await uploadBase64ToStorage(client, bucketName, path, base64data);
                    if (publicUrl) uploadedUrl = publicUrl;
                }

                if (uploadedUrl) out[baseKey] = uploadedUrl;
                // Remove the _base64 field regardless
                delete out[k];
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
            prepared.push(ready);
        }

        try {
            const upsertRes = await client.from(tableName).upsert(prepared, { onConflict: 'id' }).select();
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
