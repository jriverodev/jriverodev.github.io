// js/sync-manager.js
// SyncManager: watches online events, pushes pending records to Supabase and pulls initial data
// Assumes window.SIAGOP_SG.ensureSupabaseClient and functions from js/db.js are available

(function () {
  class SyncManager {
    constructor(options = {}) {
      this.supabaseTableMap = options.tableMap || {
        mantenimientos: 'historial_mantenimiento',
        activos: 'maestro_activos',
        registros: 'historial_mantenimiento',
        registros_activos: 'maestro_activos',
        historial_mantenimiento: 'historial_mantenimiento',
        maestro_activos: 'maestro_activos'
      };
      this.client = null;
      this.syncing = false;
      this.init();
    }

    init() {
      window.addEventListener('online', () => {
        console.info('[SyncManager] Online detected, syncing pending records.');
        this.syncPending();
      });

      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.initialPullIfEmpty(), 200);
      });
    }

    ensureClient() {
      if (this.client) return this.client;
      if (window.SIAGOP_SG && typeof window.SIAGOP_SG.ensureSupabaseClient === 'function') {
        this.client = window.SIAGOP_SG.ensureSupabaseClient();
      }
      return this.client;
    }

    async initialPullIfEmpty() {
      try {
        if (typeof dbSIAGOP === 'undefined' || !dbSIAGOP) return;
        const count = await dbSIAGOP.activos.count();
        if (count === 0) {
          console.info('[SyncManager] Local activos empty — performing initial pull from Supabase.');
          await this.pullAll('activos');
        }
      } catch (e) {
        console.warn('[SyncManager] initialPullIfEmpty failed:', e);
      }
    }

    async pullAll(localTable) {
      const client = this.ensureClient();
      if (!client) return;
      const remoteTable = this.supabaseTableMap[localTable] || localTable;

      let data = [];
      if (typeof fetchAllSupabaseRows === 'function') {
        data = await fetchAllSupabaseRows(client, remoteTable);
      } else {
        const { data: raw, error } = await client.from(remoteTable).select('*');
        if (!error && raw) data = raw;
      }

      if (data && data.length) {
        try {
          if (typeof guardarActivosLocalSeguro === 'function' && localTable === 'activos') {
            await guardarActivosLocalSeguro(data);
          } else if (window.SIAGOP_DB && typeof window.SIAGOP_DB.reemplazarRegistrosDesdePull === 'function') {
            await window.SIAGOP_DB.reemplazarRegistrosDesdePull(localTable, data);
          } else if (dbSIAGOP && dbSIAGOP[localTable]) {
            for (const r of data) {
              await dbSIAGOP[localTable].put({ ...r, sync_status: 'synced', updated_at: r.updated_at || new Date().toISOString() });
            }
          }
          console.info(`[SyncManager] Pulled ${data.length} rows into ${localTable}`);
        } catch (e) {
          console.error('[SyncManager] Error saving pulled rows:', e);
        }
      }
    }

    async syncPendingForTable(localTable) {
      if (this.syncing) return;
      this.syncing = true;
      try {
        const client = this.ensureClient();
        if (!client) {
          console.warn('[SyncManager] No supabase client available — aborting syncPendingForTable');
          return;
        }
        // read pending rows from local db
        let pending = [];
        try {
          if (window.SIAGOP_DB && typeof window.SIAGOP_DB.leerRegistrosLocales === 'function') {
            // read all then filter by sync_status
            const all = await window.SIAGOP_DB.leerRegistrosLocales(localTable);
            pending = (all || []).filter(r => r.sync_status === 'pending');
          } else if (dbSIAGOP && dbSIAGOP[localTable]) {
            pending = await dbSIAGOP[localTable].where('sync_status').equals('pending').toArray();
          }
        } catch (e) {
          console.error('[SyncManager] Error reading pending from local db', e);
        }

        if (!pending || pending.length === 0) return;
        const remoteTable = this.supabaseTableMap[localTable] || localTable;

        for (const row of pending) {
          try {
            let payload = { ...row };
            // Remove local-only metadata
            delete payload.sync_status;
            delete payload.timestamp;

            // If there are any base64 assets, upload them first and replace with public URLs
            if (window.SIAGOP_SUPABASE_SYNC && typeof window.SIAGOP_SUPABASE_SYNC.prepareRecordAssets === 'function') {
              try {
                const idForPath = String(payload.id || payload.ID_Registro || payload.id_registro || payload.id_unidad || payload.id_unidad || (crypto && crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}`));
                payload = await window.SIAGOP_SUPABASE_SYNC.prepareRecordAssets(client, 'siagop-archivos', payload, idForPath);
              } catch (e) {
                console.warn('[SyncManager] prepareRecordAssets failed for row', row, e);
              }
            }

            // Upsert - supabase upsert uses primary key on server
            const { error } = await client.from(remoteTable).upsert(payload, { returning: 'minimal' });
            if (error) {
              console.error('[SyncManager] Upsert error for', localTable, row, error);
              continue;
            }
            // Mark as synced locally
            const idKey = (localTable === 'activos') ? (row.idUnidad || row.id_unidad || row.id) : (row.id || row.ID_Registro || row.id_registro);
            if (window.SIAGOP_DB && typeof window.SIAGOP_DB.marcarRegistroSincronizado === 'function') {
              await window.SIAGOP_DB.marcarRegistroSincronizado(localTable, idKey);
            } else if (dbSIAGOP && dbSIAGOP[localTable]) {
              await dbSIAGOP[localTable].put({ ...row, sync_status: 'synced', updated_at: new Date().toISOString() });
            }
          } catch (e) {
            console.error('[SyncManager] sync/upsert exception', e);
          }
        }
      } finally {
        this.syncing = false;
      }
    }

    async syncPending() {
      await this.syncPendingForTable('activos');
      await this.syncPendingForTable('mantenimientos');
      await this.syncPendingForTable('registros');
      await this.syncPendingForTable('registros_activos');
    }

    async triggerSyncNow() {
      if (!navigator.onLine) {
        console.info('[SyncManager] offline — cannot sync now');
        return;
      }
      await this.syncPending();
    }
  }

  window.SIAGOP_SYNC = window.SIAGOP_SYNC || {};
  window.SIAGOP_SYNC.SyncManager = SyncManager;
  // instantiate a singleton instance for convenience
  try {
    window.SIAGOP_SYNC.instance = new SyncManager();
  } catch (e) {
    console.warn('Could not instantiate SyncManager automatically:', e);
  }
})();
