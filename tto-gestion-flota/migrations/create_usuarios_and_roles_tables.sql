-- Migration: create_usuarios_and_roles_tables.sql
-- Tablas para Gestión de Roles, Usuarios y Autenticación en Supabase

-- 1. Tabla de Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertar roles base si no existen
INSERT INTO roles (id, nombre, descripcion) VALUES
  ('admin', 'Administrador', 'Acceso total a todos los módulos y panel de administración backend'),
  ('operador_talleres', 'Operador Talleres', 'Acceso a captura y edición en módulo de Mantenimiento de Talleres'),
  ('operador_flota', 'Operador Flota', 'Acceso a captura y edición en módulo de Maestro de Activos')
ON CONFLICT (id) DO NOTHING;

-- 2. Tabla de Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  usuario TEXT UNIQUE NOT NULL,
  nombre_completo TEXT,
  password_plain TEXT NOT NULL, -- O Hash de contraseña de 5 dígitos
  rol_id TEXT REFERENCES roles(id) DEFAULT 'operador_talleres',
  modulo TEXT DEFAULT 'TODOS', -- 'TALLERES', 'FLOTA', 'TODOS'
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insertar usuarios iniciales por defecto
INSERT INTO usuarios (id, usuario, nombre_completo, password_plain, rol_id, modulo, activo) VALUES
  ('u-admin', 'ADMINISTRADOR', 'Administrador del Sistema', '12345', 'admin', 'TODOS', true),
  ('u-1', 'DEXCYBEL SALAZAR', 'Dexcybel Salazar', '12345', 'operador_talleres', 'TALLERES', true),
  ('u-2', 'JUAN ESCALONA', 'Juan Escalona', '12345', 'operador_talleres', 'TALLERES', true),
  ('u-3', 'IVANA SAEZ', 'Ivana Saez', '12345', 'operador_talleres', 'TALLERES', true),
  ('u-4', 'DELVIN MARRERO', 'Delvin Marrero', '12345', 'operador_talleres', 'TALLERES', true)
ON CONFLICT (usuario) DO NOTHING;

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios ENABLE ROW LEVEL SECURITY;

-- 4. Politicas RLS
DROP POLICY IF EXISTS "Permitir lectura publica roles" ON roles;
CREATE POLICY "Permitir lectura publica roles" ON roles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir lectura publica usuarios" ON usuarios;
CREATE POLICY "Permitir lectura publica usuarios" ON usuarios FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Permitir escritura publica usuarios" ON usuarios;
CREATE POLICY "Permitir escritura publica usuarios" ON usuarios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
