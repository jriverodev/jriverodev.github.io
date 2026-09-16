/**
 * Interfaces de Datos para SIAGOP Móvil (Flota y Talleres)
 */

export interface Vehiculo {
  id?: string;
  ID?: string;
  ID_UNIDAD?: string;
  PLACA?: string;
  TIPO_VEHICULO?: string;
  MARCA?: string;
  MODELO?: string;
  AÑO?: string | number;
  COLOR?: string;
  VIN?: string;
  UBICACION_TALLER?: string;
  UBICACION_TALLER_FECHA?: string;
  CARGO_USUARIO?: string;
  ESTADO?: string;
  FOTO_URL?: string;
  DOCUMENTO_URL?: string;
  DOCUMENTO_NOMBRE?: string;
  organizacion_id?: string;
  [key: string]: any;
}

export interface RegistroMantenimiento {
  id?: string;
  IDREGISTRO?: string;
  REGISTRO?: string;
  UNIDAD?: string;
  FOTO?: string;
  FOTO_URL?: string;
  TALLER?: string;
  TALLER_EXT?: string;
  nombre_taller_ext?: string;
  FECHA_INGRESO?: string;
  FECHA_SALIDA?: string;
  ESTADO?: string;
  OPERADOR?: string;
  TAREAS?: any;
  CHECKLIST?: any;
  VIN?: string;
  MODELO?: string;
  COLOR?: string;
  AÑO?: string | number;
  TIPO_VEHICULO?: string;
  CARGO_USUARIO?: string;
  organizacion_id?: string;
  [key: string]: any;
}

export interface Usuario {
  id?: string;
  usuario?: string;
  nombre?: string;
  rol?: string;
  modulo?: string;
  activo?: boolean;
  organizacion_id?: string;
  password_plain?: string;
  [key: string]: any;
}

export interface Organizacion {
  id?: string;
  nombre?: string;
  codigo?: string;
  rif?: string;
  contacto?: string;
  estado_pago?: string;
  fecha_vencimiento?: string;
  [key: string]: any;
}
