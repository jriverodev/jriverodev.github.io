-- Migration: fix_usuarios_rls_policy.sql
-- Asegura políticas RLS de lectura y escritura para la tabla usuarios y roles en Supabase

ALTER TABLE IF EXISTS usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica usuarios" ON usuarios;
DROP POLICY IF EXISTS "Permitir escritura publica usuarios" ON usuarios;
DROP POLICY IF EXISTS "Permitir escritura solo autenticados" ON usuarios;

CREATE POLICY "Permitir lectura publica usuarios"
  ON usuarios FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir escritura publica usuarios"
  ON usuarios FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir lectura publica roles" ON roles;
DROP POLICY IF EXISTS "Permitir escritura publica roles" ON roles;

CREATE POLICY "Permitir lectura publica roles"
  ON roles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Permitir escritura publica roles"
  ON roles FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
