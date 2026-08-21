const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mfklcwrpgavaxznkxlra.supabase.co';
const SUPABASE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('Error: SERVICE_ROLE_KEY environment variable is required to bypass RLS policies during import.');
  console.error('Usage: SERVICE_ROLE_KEY="<your_service_role_key>" node import_csv.js');
  process.exit(1);
}

// Simple CSV Parser handling quotes and commas
function parseCSV(text) {
  const lines = [];
  let row = [];
  let entry = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const nextC = text[i + 1];

    if (c === '"') {
      if (inQuotes && nextC === '"') {
        entry += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(entry.trim());
      entry = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && nextC === '\n') {
        i++;
      }
      row.push(entry.trim());
      if (row.some(field => field.length > 0)) {
        lines.push(row);
      }
      row = [];
      entry = '';
    } else {
      entry += c;
    }
  }
  if (entry.length > 0 || row.length > 0) {
    row.push(entry.trim());
    if (row.some(field => field.length > 0)) {
      lines.push(row);
    }
  }
  return lines;
}

function parseDateString(str) {
  if (!str || !str.trim()) return null;
  str = str.trim();
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
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
  const iso = new Date(str);
  if (!isNaN(iso.getTime())) {
    return iso.toISOString();
  }
  return null;
}

function parseJSONSafely(str, defaultVal) {
  if (!str || !str.trim()) return defaultVal;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultVal;
  }
}

async function upsertToSupabase(table, records, onConflictColumn) {
  if (!records || records.length === 0) return;
  console.log(`Upserting ${records.length} records to '${table}'...`);

  const chunkSize = 100;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    const url = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${onConflictColumn}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(chunk)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error batch ${i / chunkSize + 1} for ${table}: ${res.status} - ${errText}`);
    } else {
      const data = await res.json();
      console.log(`Successfully upserted batch ${i / chunkSize + 1} (${data.length} records) to ${table}`);
    }
  }
}

async function run() {
  const tempDir = path.join(__dirname, '..', 'temp');
  const files = fs.readdirSync(tempDir);
  const maestroFile = files.find(f => f.toLowerCase().includes('maestro') && f.endsWith('.csv'));
  const historialFile = files.find(f => f.toLowerCase().includes('historial') && f.endsWith('.csv'));

  if (maestroFile) {
    const maestroPath = path.join(tempDir, maestroFile);
    const content = fs.readFileSync(maestroPath, 'utf8');
    const rows = parseCSV(content);
    if (rows.length > 1) {
      const headers = rows[0].map(h => h.trim());
      const records = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] || '';
        });

        const idUnidad = (obj['ID_Unidad'] || obj['id_unidad'] || '').trim();
        if (!idUnidad) continue;

        records.push({
          id_unidad: idUnidad,
          placa: (obj['Placa'] || obj['placa'] || '').trim(),
          vin: (obj['Serial'] || obj['VIN'] || obj['vin'] || '').trim(),
          marca: (obj['Marca'] || obj['marca'] || '').trim(),
          modelo: (obj['Modelo'] || obj['modelo'] || '').trim(),
          anio: parseInt(obj['Anio'] || obj['Año'] || obj['anio'] || '', 10) || null,
          color: (obj['Color'] || obj['color'] || '').trim(),
          tipo_vehiculo: (obj['Tipo_Vehiculo'] || obj['tipo_vehiculo'] || '').trim(),
          tipo_flota: (obj['Tipo_Flota'] || obj['tipo_flota'] || '').trim(),
          estatus_final: (obj['Estatus_Final'] || obj['estatus_final'] || '').trim(),
          situacion_actual: (obj['Situacion_Actual'] || obj['situacion_actual'] || '').trim(),
          gerencia: (obj['Gerencia'] || obj['gerencia'] || '').trim(),
          responsable_usuario: (obj['Responsable_Usuario'] || obj['responsable_usuario'] || '').trim(),
          cargo_usuario: (obj['Cargo_Usuario'] || obj['cargo_usuario'] || '').trim(),
          ubicacion_taller: (obj['Ubicacion_Taller'] || obj['ubicacion_taller'] || '').trim(),
          ubicacion_taller_fecha: parseDateString(obj['Ubicacion_Taller_Fecha'] || obj['ubicacion_taller_fecha']),
          documento_url: (obj['Documento_Url'] || obj['documento_url'] || '').trim(),
          documento_nombre: (obj['Documento_Nombre'] || obj['documento_nombre'] || '').trim(),
          updated_at: new Date().toISOString()
        });
      }
      console.log(`Parsed ${records.length} records for maestro_activos.`);
      await upsertToSupabase('maestro_activos', records, 'id_unidad');
    }
  }

  if (historialFile) {
    const historialPath = path.join(tempDir, historialFile);
    const content = fs.readFileSync(historialPath, 'utf8');
    const rows = parseCSV(content);
    if (rows.length > 1) {
      const headers = rows[0].map(h => h.trim());
      const records = [];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length < headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] || '';
        });

        const idReg = (obj['ID_REGISTRO'] || obj['id_registro'] || obj['ID'] || obj['id'] || '').trim();
        if (!idReg) continue;

        records.push({
          id: idReg,
          id_unidad: (obj['ID_Unidad'] || obj['id_unidad'] || '').trim(),
          tipo_flota: (obj['Tipo_Flota'] || obj['tipo_flota'] || '').trim(),
          nombre_taller: (obj['Nombre_Taller'] || obj['nombre_taller'] || '').trim(),
          taller_ext: (obj['Taller_Ext'] || obj['taller_ext'] || '').trim(),
          estatus: (obj['Estatus'] || obj['estatus'] || '').trim(),
          observaciones: (obj['Observaciones'] || obj['observaciones'] || '').trim(),
          marca: (obj['Marca'] || obj['marca'] || '').trim(),
          modelo: (obj['Modelo'] || obj['modelo'] || '').trim(),
          color: (obj['Color'] || obj['color'] || '').trim(),
          anio: parseInt(obj['Anio'] || obj['Año'] || obj['anio'] || '', 10) || null,
          vin: (obj['Serial'] || obj['VIN'] || obj['vin'] || '').trim(),
          tipo_vehiculo: (obj['Tipo_Vehiculo'] || obj['tipo_vehiculo'] || '').trim(),
          avance: parseInt(obj['Avance'] || obj['avance'] || '0', 10) || 0,
          foto_antes: (obj['Foto_Antes'] || obj['foto_antes'] || '').trim(),
          foto_despues: (obj['Foto_Despues'] || obj['foto_despues'] || '').trim(),
          fecha_ingreso: parseDateString(obj['Fecha_Ingreso'] || obj['fecha_ingreso']),
          fecha_salida: parseDateString(obj['Fecha_Salida'] || obj['fecha_salida']),
          gerencia: (obj['Gerencia'] || obj['gerencia'] || '').trim(),
          usuario: (obj['Usuario'] || obj['usuario'] || '').trim(),
          cargo_usuario: (obj['Cargo_Usuario'] || obj['cargo_usuario'] || '').trim(),
          tareas: parseJSONSafely(obj['Tareas'] || obj['tareas'], []),
          modificado_por: (obj['Modificado_Por'] || obj['modificado_por'] || '').trim(),
          updated_at: new Date().toISOString()
        });
      }
      console.log(`Parsed ${records.length} records for historial_mantenimiento.`);
      await upsertToSupabase('historial_mantenimiento', records, 'id');
    }
  }
}

run().catch(err => console.error('Import failed:', err));
