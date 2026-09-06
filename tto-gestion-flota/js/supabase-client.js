// js/supabase-client.js
// Simple Supabase client helper. Exponer ensureSupabaseClient() que devuelve el cliente singleton.
// Dependencia: window.SIAGOP_SUPABASE_URL y window.SIAGOP_SUPABASE_ANON_KEY (o APP_CONFIG equivalents)

(function () {
  let supabaseClient = null;

  function ensureSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    const url = window.SIAGOP_SUPABASE_URL || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || "https://mfklcwrpgavaxznkxlra.supabase.co";
    const key = window.SIAGOP_SUPABASE_ANON_KEY || (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ma2xjd3JwZ2F2YXh6bmt4bHJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyODUzNjgsImV4cCI6MjA4MDg2MTM2OH0.2xHgsM4F3X0vw05PgVhpMF11w1lU6zT21cp6MlE5gNY";
    if (!url || !key) {
      console.warn('[Supabase] Missing URL / ANON_KEY. Supabase operations will be disabled until configured.');
      return null;
    }

    const clientOptions = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    };

    // If createClient is available globally (supabase-js lib), use it
    if (typeof createClient === 'function') {
      try {
        supabaseClient = createClient(url, key, clientOptions);
      } catch (e) {
        console.warn('[Supabase] createClient error', e);
        supabaseClient = null;
      }
      return supabaseClient;
    }

    // Try window.supabase.createClient
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabaseClient = window.supabase.createClient(url, key, clientOptions);
      } catch (e) {
        console.warn('[Supabase] window.supabase.createClient error', e);
        supabaseClient = null;
      }
      return supabaseClient;
    }

    // Dynamic load if not loaded yet
    if (!window._supabaseScriptLoading) {
      window._supabaseScriptLoading = true;
      const scriptTag = document.createElement('script');
      scriptTag.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      scriptTag.async = true;
      scriptTag.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          supabaseClient = window.supabase.createClient(url, key, clientOptions);
          window.SIAGOP_SUPABASE_CLIENT = supabaseClient;
        }
      };
      document.head.appendChild(scriptTag);
    }

    console.warn('[Supabase] supabase-js (createClient) loading dynamically via CDN...');
    return null;
  }

  window.SIAGOP_SG = window.SIAGOP_SG || {};
  window.SIAGOP_SG.ensureSupabaseClient = ensureSupabaseClient;
})();
