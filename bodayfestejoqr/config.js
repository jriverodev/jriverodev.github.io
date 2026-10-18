// config.js - Credenciales compartidas
const CONFIG = {
    // URL de tu implementación Web App en Google Apps Script
    APPS_SCRIPT_URL: 'TU_URL_DE_GOOGLE_APPS_SCRIPT_AQUI',
    
    // Credenciales de tu proyecto Supabase
    SUPABASE_URL: 'https://oydfrrdcgcmuqdkriibm.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_MVSJ3kxyyzhIs1SChJyyYw_fYXXC0u2'
};

// Inicialización global del cliente Supabase
const supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
