/**
 * TTOCC System - Gestión de Base de Datos Local Cifrada con Dexie.js y Web Crypto API
 * db.js - Persistencia Cifrada en IndexedDB (AES-GCM con PBKDF2)
 */
"use strict";

// =========================================================================
// 1. INICIALIZACIÓN DE DEXIE.JS (INDEXEDDB SCHEMA)
// =========================================================================

var dbTTOCC = null;

if (typeof Dexie !== 'undefined') {
    dbTTOCC = new Dexie("TTOCC_PWA_Database");

    // Esquema de IndexedDB cifrado
    dbTTOCC.version(1).stores({
        mantenimientos: 'id, timestamp',
        activos: 'idUnidad, timestamp',
        colaOffline: '++idSync, accion, timestamp'
    });
} else {
    console.warn("[Dexie] La librería Dexie.js no está cargada en el contexto global.");
}

// =========================================================================
// 2. MÓDULO DE CIFRADO Y DESCIFRADO (AES-GCM + PBKDF2 mediante SubtleCrypto)
// =========================================================================

const TTOCC_CRYPTO = (function() {
    const ENCODING = 'utf-8';
    const SALT_BYTES = 16;
    const IV_BYTES = 12;
    const PBKDF2_ITERATIONS = 100000;

    /**
     * Convierte una cadena a ArrayBuffer
     */
    function stringToBuffer(str) {
        return new TextEncoder().encode(str);
    }

    /**
     * Convierte un ArrayBuffer a cadena
     */
    function bufferToString(buf) {
        return new TextDecoder(ENCODING).decode(buf);
    }

    /**
     * Convierte ArrayBuffer a Base64
     */
    function bufferToBase64(buf) {
        return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    }

    /**
     * Convierte Base64 a ArrayBuffer
     */
    function base64ToBuffer(b64) {
        const binStr = atob(b64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binStr.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Obtiene una clave maestra derivada a partir del token de sesión o un valor fallback
     */
    function obtenerClaveSecreta() {
        if (typeof obtenerTokenSesion === 'function') {
            const token = obtenerTokenSesion();
            if (token) return token;
        }
        return "TTOCC_INDUSTRIAL_SECRET_PWA_KEY_2026";
    }

    /**
     * Deriva una clave de cifrado AES-GCM a partir de una contraseña y una sal utilizando PBKDF2
     */
    async function derivarClaveCrypto(passwordSecret, saltBuffer) {
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            stringToBuffer(passwordSecret),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Cifra un objeto/dato en JSON utilizando AES-GCM con PBKDF2
     * @param {Object|Array|string} datos - Datos a cifrar
     * @returns {Promise<Object>} Objeto con datos cifrados en Base64 { ciphertext, iv, salt }
     */
    async function cifrarDatos(datos) {
        try {
            if (!window.crypto || !window.crypto.subtle) {
                console.warn("[Crypto] SubtleCrypto no disponible. Almacenando en formato plano.");
                return { raw: JSON.stringify(datos) };
            }

            const jsonStr = JSON.stringify(datos);
            const salt = window.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
            const iv = window.crypto.getRandomValues(new Uint8Array(IV_BYTES));

            const claveSecreta = obtenerClaveSecreta();
            const cryptoKey = await derivarClaveCrypto(claveSecreta, salt);

            const ciphertextBuffer = await window.crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                cryptoKey,
                stringToBuffer(jsonStr)
            );

            return {
                ciphertext: bufferToBase64(ciphertextBuffer),
                iv: bufferToBase64(iv),
                salt: bufferToBase64(salt)
            };
        } catch (e) {
            console.error("[Crypto Error] Fallo al cifrar datos:", e);
            return { raw: JSON.stringify(datos) };
        }
    }

    /**
     * Descifra un paquete cifrado generado por cifrarDatos
     * @param {Object} paqueteCifrado - Objeto { ciphertext, iv, salt }
     * @returns {Promise<any>} Objeto/Dato descifrado
     */
    async function descifrarDatos(paqueteCifrado) {
        try {
            if (!paqueteCifrado) return null;
            if (paqueteCifrado.raw) {
                return JSON.parse(paqueteCifrado.raw);
            }

            if (!window.crypto || !window.crypto.subtle) {
                return null;
            }

            const ciphertextBuffer = base64ToBuffer(paqueteCifrado.ciphertext);
            const ivBuffer = base64ToBuffer(paqueteCifrado.iv);
            const saltBuffer = base64ToBuffer(paqueteCifrado.salt);

            const claveSecreta = obtenerClaveSecreta();
            const cryptoKey = await derivarClaveCrypto(claveSecreta, saltBuffer);

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: ivBuffer },
                cryptoKey,
                ciphertextBuffer
            );

            const jsonStr = bufferToString(decryptedBuffer);
            return JSON.parse(jsonStr);
        } catch (e) {
            console.error("[Crypto Error] Fallo al descifrar datos (posible clave inválida o corrupción):", e);
            return null;
        }
    }

    return {
        cifrarDatos: cifrarDatos,
        descifrarDatos: descifrarDatos
    };
})();

// =========================================================================
// 3. FUNCIONES DE ACCESO A DATOS SEGUROS PARA INDEXEDDB
// =========================================================================

/**
 * Guarda la lista de mantenimientos de forma cifrada en Dexie.js
 */
async function guardarMantenimientosLocalSeguro(lista) {
    if (!dbTTOCC) return;
    try {
        const paqueteCifrado = await TTOCC_CRYPTO.cifrarDatos(lista);
        await dbTTOCC.mantenimientos.put({
            id: 'MATRIZ_PRINCIPAL',
            timestamp: new Date().toISOString(),
            payload: paqueteCifrado
        });
    } catch (e) {
        console.error("[Dexie] Error guardando mantenimientos en IndexedDB:", e);
    }
}

/**
 * Recupera y descifra la lista de mantenimientos almacenada en Dexie.js
 */
async function obtenerMantenimientosLocalSeguro() {
    if (!dbTTOCC) return [];
    try {
        const registro = await dbTTOCC.mantenimientos.get('MATRIZ_PRINCIPAL');
        if (!registro || !registro.payload) return [];
        const datos = await TTOCC_CRYPTO.descifrarDatos(registro.payload);
        return Array.isArray(datos) ? datos : [];
    } catch (e) {
        console.error("[Dexie] Error obteniendo mantenimientos de IndexedDB:", e);
        return [];
    }
}

/**
 * Guarda la lista de activos de forma cifrada en Dexie.js
 */
async function guardarActivosLocalSeguro(lista) {
    if (!dbTTOCC) return;
    try {
        const paqueteCifrado = await TTOCC_CRYPTO.cifrarDatos(lista);
        await dbTTOCC.activos.put({
            idUnidad: 'MAESTRO_ACTIVOS',
            timestamp: new Date().toISOString(),
            payload: paqueteCifrado
        });
    } catch (e) {
        console.error("[Dexie] Error guardando activos en IndexedDB:", e);
    }
}

/**
 * Recupera y descifra la lista de activos almacenada en Dexie.js
 */
async function obtenerActivosLocalSeguro() {
    if (!dbTTOCC) return [];
    try {
        const registro = await dbTTOCC.activos.get('MAESTRO_ACTIVOS');
        if (!registro || !registro.payload) return [];
        const datos = await TTOCC_CRYPTO.descifrarDatos(registro.payload);
        return Array.isArray(datos) ? datos : [];
    } catch (e) {
        console.error("[Dexie] Error obteniendo activos de IndexedDB:", e);
        return [];
    }
}

/**
 * Encola una operación offline cifrada en IndexedDB
 */
async function encolarOfflineSeguro(accion, payload) {
    if (!dbTTOCC) return;
    try {
        const paqueteCifrado = await TTOCC_CRYPTO.cifrarDatos(payload);
        await dbTTOCC.colaOffline.add({
            accion: accion,
            timestamp: new Date().toISOString(),
            payload: paqueteCifrado
        });
    } catch (e) {
        console.error("[Dexie] Error encolando operación offline cifrada:", e);
    }
}

/**
 * Obtiene todas las operaciones offline cifradas acumuladas en IndexedDB
 */
async function obtenerColaOfflineSegura() {
    if (!dbTTOCC) return [];
    try {
        const registros = await dbTTOCC.colaOffline.toArray();
        const resultados = [];
        for (const reg of registros) {
            const payloadDescifrado = await TTOCC_CRYPTO.descifrarDatos(reg.payload);
            resultados.push({
                idSync: reg.idSync,
                accion: reg.accion,
                timestamp: reg.timestamp,
                payload: payloadDescifrado
            });
        }
        return resultados;
    } catch (e) {
        console.error("[Dexie] Error leyendo cola offline de IndexedDB:", e);
        return [];
    }
}

/**
 * Elimina una operación procesada de la cola offline de IndexedDB
 */
async function eliminarItemColaOfflineSegura(idSync) {
    if (!dbTTOCC) return;
    try {
        await dbTTOCC.colaOffline.delete(idSync);
    } catch (e) {
        console.error("[Dexie] Error eliminando elemento de cola offline:", e);
    }
}
