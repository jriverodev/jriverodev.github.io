export {};

declare global {
  var SIAGOP_SUPABASE_URL: string | undefined;
  var SIAGOP_SUPABASE_ANON_KEY: string | undefined;
  var SIAGOP_SUPABASE_CLIENT: any;
  var SIAGOP_SUPABASE_SYNC: any;
  var SIAGOP_SYNC_MANAGER: any;
  var SIAGOP_SYNC: any;
  var SIAGOP_DB: any;
  var dbSIAGOP: any;
  var SIAGOP_UI: any;
  var TTOCC_UI: any;
  var SIAGOP_UI_UTILS: any;
  var TTOCC_UI_UTILS: any;
  var SIAGOP_PROFILE: any;
  var SIAGOP_DEBUG_UI: boolean | undefined;
  var SIAGOP_ROL: string | undefined;
  var SIAGOP_MODULO: string | undefined;
  var SIAGOP_ORG_NOMBRE: string | undefined;
  var SIAGOP_SIGNED_URL_CACHE: Map<string, { url: string; expiresAt: number }> | undefined;
  var SIAGOP_SG: any;
  var SIAGOP_SIGN_UPLOAD_ENDPOINT: string | undefined;
  var SIAGOP_SIGN_UPLOAD_API_KEY: string | undefined;
  var SIAGOP_SIGN_UPLOAD_JWT: string | undefined;
  var SIAGOP_BUCKET_PUBLIC: boolean | undefined;
  var APP_CONFIG: any;

  // Global functions from other scripts
  var previsualizarImagen: ((input: any, targetId: string) => void) | undefined;
  var limpiarPrevia: ((inputId: string, targetId: string) => void) | undefined;
  var obtenerOperadorActual: (() => string) | undefined;
  var cerrarSesionCompleta: (() => void) | undefined;
  var toggleTema: (() => void) | undefined;
  var obtenerRolYModuloUsuario: (() => any) | undefined;
  var verificarAccesoGlobal: (() => any) | undefined;
  var escapeHTML: ((str: any) => string) | undefined;
  var debounce: ((func: any, wait: number) => any) | undefined;
  var normalizarUrlStorage: ((url: any) => string) | undefined;
  var firmarUrlsDeRegistros: ((registros: any[], campos: string[]) => Promise<any[]>) | undefined;
  var obtenerUrlFirmadaStorage: ((pathOrUrl: string) => Promise<string>) | undefined;
  var parseCustomDateToISO: ((dateStr: any) => string | null) | undefined;
  var formatearFechaFront: ((dateStr: any) => string) | undefined;
  var base64ToBlob: ((base64: string, mimeType?: string) => Blob) | undefined;
  var prepararPayloadSupabase: ((tipo: string, payload: any) => any) | undefined;
  var prepareRecordAssets: ((payload: any, folderPrefix?: string) => Promise<any>) | undefined;
  var handleLocalApiGateway: ((action: string, payload: any) => Promise<any>) | undefined;
  var encolarPeticionOffline: ((peticion: any) => Promise<void>) | undefined;
  var procesarColaOffline: (() => Promise<void>) | undefined;
  var poblarSelectOperadores: ((elementId: string, moduloRequerido?: string) => Promise<void>) | undefined;
  var validarArchivoAdjunto: ((file: File) => { valido: boolean; mensaje?: string }) | undefined;
  var extraerStoragePath: ((url: string) => string | null) | undefined;
  var fetchAllSupabaseRows: ((tableName: any, queryBuilder?: any) => Promise<any[]>) | undefined;
  var guardarActivosLocalSeguro: ((data: any) => Promise<void>) | undefined;
  var ensureSupabaseClient: (() => any) | undefined;
  var mostrarNotificacion: ((mensaje: string, tipo?: string) => void) | undefined;
  var obtenerTokenSesion: (() => string | null) | undefined;
  var createClient: any;

  // Third-party libraries
  var Dexie: any;
  var supabase: any;
  var Swal: any;
  var Chart: any;
  var XLSX: any;
  var html2pdf: any;
  var Capacitor: any;
  var PhotoSwipeLightbox: any;
  var $: any;
  var jQuery: any;

  interface Window {
    SIAGOP_SUPABASE_URL?: string;
    SIAGOP_SUPABASE_ANON_KEY?: string;
    SIAGOP_SUPABASE_CLIENT?: any;
    SIAGOP_SUPABASE_SYNC?: any;
    SIAGOP_SYNC_MANAGER?: any;
    SIAGOP_SYNC?: any;
    SIAGOP_DB?: any;
    dbSIAGOP?: any;
    SIAGOP_UI?: any;
    TTOCC_UI?: any;
    SIAGOP_UI_UTILS?: any;
    TTOCC_UI_UTILS?: any;
    SIAGOP_PROFILE?: any;
    SIAGOP_DEBUG_UI?: boolean;
    SIAGOP_ROL?: string;
    SIAGOP_MODULO?: string;
    SIAGOP_ORG_NOMBRE?: string;
    SIAGOP_SIGNED_URL_CACHE?: Map<string, { url: string; expiresAt: number }>;
    SIAGOP_SG?: any;
    SIAGOP_SIGN_UPLOAD_ENDPOINT?: string;
    SIAGOP_SIGN_UPLOAD_API_KEY?: string;
    SIAGOP_SIGN_UPLOAD_JWT?: string;
    SIAGOP_BUCKET_PUBLIC?: any;
    SIAGOP_ROLES?: any;
    _supabaseScriptLoading?: any;
    APP_CONFIG?: any;

    previsualizarImagen?: (input: any, targetId: string) => void;
    limpiarPrevia?: (inputId: string, targetId: string) => void;
    obtenerOperadorActual?: () => string;
    cerrarSesionCompleta?: () => void;
    toggleTema?: () => void;
    obtenerRolYModuloUsuario?: () => any;
    verificarAccesoGlobal?: () => any;
    escapeHTML?: (str: any) => string;
    debounce?: (func: any, wait: number) => any;
    normalizarUrlStorage?: (url: any) => string;
    firmarUrlsDeRegistros?: (registros: any[], campos: string[]) => Promise<any[]>;
    obtenerUrlFirmadaStorage?: (pathOrUrl: string) => Promise<string>;

    Dexie?: any;
    supabase?: any;
    Swal?: any;
    Chart?: any;
    XLSX?: any;
    html2pdf?: any;
    Capacitor?: any;
    PhotoSwipeLightbox?: any;
    $?: any;
    jQuery?: any;
  }
}
