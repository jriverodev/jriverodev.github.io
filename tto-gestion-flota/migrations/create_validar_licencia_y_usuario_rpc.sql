-- Migration: create_validar_licencia_y_usuario_rpc.sql
-- RPC Function to validate institutional license and user credentials in a single atomic call

CREATE OR REPLACE FUNCTION public.validar_licencia_y_usuario(
    p_codigo_interno TEXT,
    p_usuario TEXT,
    p_password TEXT
)
RETURNS TABLE (
    permitido BOOLEAN,
    codigo_error TEXT,
    mensaje TEXT,
    organizacion_id UUID,
    organizacion_nombre TEXT,
    usuario_id TEXT,
    usuario_nombre TEXT,
    rol_id TEXT,
    modulo TEXT
) AS $$
DECLARE
    v_org_id UUID;
    v_org_nombre VARCHAR;
    v_org_activa BOOLEAN;
    v_org_pago VARCHAR;
    v_fecha_venc TIMESTAMPTZ;

    v_user_id TEXT;
    v_user_nombre TEXT;
    v_user_pass TEXT;
    v_user_rol TEXT;
    v_user_mod TEXT;
    v_user_activo BOOLEAN;
BEGIN
    -- 1. Buscar Organización por codigo_interno
    SELECT id, nombre, activo, estado_pago, fecha_vencimiento
    INTO v_org_id, v_org_nombre, v_org_activa, v_org_pago, v_fecha_venc
    FROM public.organizaciones
    WHERE LOWER(TRIM(codigo_interno)) = LOWER(TRIM(p_codigo_interno));

    IF v_org_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'ORG_NOT_FOUND'::TEXT, 'Código de organización no encontrado.'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_org_activa IS NOT TRUE THEN
        RETURN QUERY SELECT FALSE, 'ORG_INACTIVE'::TEXT, 'La organización se encuentra inactiva o suspendida.'::TEXT, v_org_id, v_org_nombre::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_org_pago = 'SUSPENDIDO' THEN
        RETURN QUERY SELECT FALSE, 'ORG_PAYMENT_SUSPENDED'::TEXT, 'El plan de la organización se encuentra suspendido.'::TEXT, v_org_id, v_org_nombre::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    ELSIF v_fecha_venc IS NOT NULL AND v_fecha_venc < NOW() THEN
        RETURN QUERY SELECT FALSE, 'ORG_EXPIRED'::TEXT, 'Licencia institucional suspendida o vencida. Contacte al administrador.'::TEXT, v_org_id, v_org_nombre::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- 2. Buscar Usuario dentro de la Organización
    SELECT id, usuario, nombre_completo, password_plain, rol_id, modulo, activo
    INTO v_user_id, v_user_nombre, v_user_nombre, v_user_pass, v_user_rol, v_user_mod, v_user_activo
    FROM public.usuarios
    WHERE organizacion_id = v_org_id
      AND LOWER(TRIM(usuario)) = LOWER(TRIM(p_usuario));

    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'USER_NOT_FOUND'::TEXT, 'Usuario no registrado para esta organización.'::TEXT, v_org_id, v_org_nombre::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF v_user_activo IS NOT TRUE THEN
        RETURN QUERY SELECT FALSE, 'USER_INACTIVE'::TEXT, 'El usuario se encuentra inactivo o bloqueado.'::TEXT, v_org_id, v_org_nombre::TEXT, v_user_id, v_user_nombre::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    IF LOWER(TRIM(v_user_pass)) <> LOWER(TRIM(p_password)) THEN
        RETURN QUERY SELECT FALSE, 'INVALID_PASSWORD'::TEXT, 'Credenciales de usuario incorrectas.'::TEXT, v_org_id, v_org_nombre::TEXT, v_user_id, v_user_nombre::TEXT, NULL::TEXT, NULL::TEXT;
        RETURN;
    END IF;

    -- 3. Acceso Exitoso
    RETURN QUERY SELECT TRUE, 'OK'::TEXT, 'Autenticación institucional exitosa.'::TEXT, v_org_id, v_org_nombre::TEXT, v_user_id, v_user_nombre::TEXT, v_user_rol::TEXT, v_user_mod::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
