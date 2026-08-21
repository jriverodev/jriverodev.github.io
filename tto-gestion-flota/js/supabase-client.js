// js/supabase-client.js
// Simple Supabase client helper. Exponer ensureSupabaseClient() que devuelve el cliente singleton.
// Dependencia: window.TTOCC_SUPABASE_URL y window.TTOCC_SUPABASE_ANON_KEY (o APP_CONFIG equivalents)

(function () {
  let supabaseClient = null;

  function ensureSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const url = window.TTOCC_SUPABASE_URL || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL);
    const key = window.TTOCC_SUPABASE_ANON_KEY || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY);
    if (!url || !key) {
      console.warn('[Supabase] Missing URL / ANON_KEY. Supabase operations will be disabled until configured.');
      return null;
    }
    // If createClient is available globally (supabase-js lib), use it
    if (typeof createClient === 'function') {
      try {
        supabaseClient = createClient(url, key);
      } catch (e) {
        console.warn('[Supabase] createClient error', e);
        supabaseClient = null;
      }
      return supabaseClient;
    }

    // Try window.supabase.createClient
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClient = window.supabase.createClient(url, key);
      } catch (e) {
        console.warn('[Supabase] window.supabase.createClient error', e);
        supabaseClient = null;
      }
      return supabaseClient;
    }

    console.warn('[Supabase] supabase-js (createClient) not found. Include the library or provide createClient globally.');
    return null;
  }

  window.TTOCC_SG = window.TTOCC_SG || {};
  window.TTOCC_SG.ensureSupabaseClient = ensureSupabaseClient;
})();
