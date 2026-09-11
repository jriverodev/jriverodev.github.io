# Manual de Usuario

**Sistema:** Consola de Control - Gestión de Personal

**Desarrollado por:** RIVEROJDU

**Versión:** 1.0

**Fecha:** 2026-06-09

---

## 1. Introducción

Este documento describe el uso del sistema de Gestión de Personal y Vacaciones diseñado para la Gerencia de Transporte Terrestre, siguiendo un enfoque similar a los protocolos de la Fábrica de Software de PDVSA.

El objetivo es proporcionar una guía clara y práctica para los usuarios finales sobre cómo operar el sistema, realizar cargas masivas, exportaciones, respaldos y usar el tour guiado integrado.

## 2. Alcance

Este manual cubre:

- Acceso seguro al sistema.
- Navegación entre los módulos de Fuerza Laboral y Vacaciones.
- Uso de plantillas de Excel para importación masiva.
- Exportaciones de datos.
- Respaldo y restauración de la base local.
- Acceso administrativo seguro con contraseña.
- Tour guiado dentro de la aplicación.

No cubre procesos técnicos internos de desarrollo, administración de servidores o ajustes de código fuente.

## 3. Público objetivo

- Usuarios finales del módulo de Fuerza Laboral.
- Administradores de datos y operadores de Vacaciones.
- Personal autorizado que debe respaldar, restaurar o purgar datos.

## 4. Control de versiones y autoría

| Versión | Fecha | Autor | Descripción |
| --- | --- | --- | --- |
| 1.0 | 2026-06-09 | RIVEROJDU | Manual inicial de usuario para el sistema. |

---

## 5. Estructura del sistema

El sistema se organiza en dos módulos principales:

1. **Fuerza Laboral**
   - Registro de trabajadores.
   - Captura de datos personales, cargo, SAP, certificados y documentos.
   - Importación masiva desde Excel.
   - Exportación de datos actuales.

2. **Vacaciones**
   - Registro de programación de vacaciones.
   - Importación masiva desde plantilla de Excel.
   - Gestión de periodos, días y estado de proceso.

También incluye:

- Módulo de administración segura para respaldos y restauración.
- Tour guiado integrado para los usuarios.

## 6. Acceso al sistema

### 6.1 Pantalla de inicio

Al abrir el sistema, el usuario verá el panel de login con los campos:

- **Usuario**
- **Contraseña**

### 6.2 Ingreso seguro

1. Ingresar el nombre de usuario.
2. Ingresar la contraseña.
3. Presionar `Ingresar`.

El sistema usa verificación offline segura y solo permite el acceso cuando las credenciales son correctas.

## 7. Navegación general

Después del login, el usuario verá el menú principal con dos opciones:

- **Fuerza Laboral**
- **Data Vacaciones**

Desde aquí se selecciona el módulo que se desea usar.

## 8. Módulo Fuerza Laboral

### 8.1 Objetivo

Registrar y mantener el maestro de personal.

### 8.2 Funcionalidades principales

- Crear un nuevo trabajador.
- Editar trabajador existente con doble clic en la tabla.
- Guardar datos para almacenamiento local.
- Importar datos desde Excel.
- Exportar el maestro en formato Excel.
- Descarga de plantilla de importación.

### 8.3 Campos clave

- `N_PERSONAL`
- `CEDULA`
- `NOMBRES`
- `APELLIDOS`
- `PUESTO_FUNCIONAL`
- `POSICION_SAP`
- `DESCRIPCION_POSICION_SAP`
- `DESCRIPCION`
- `FECHA_NACIMIENTO`
- `FECHA_INGRESO_EMPRESA`
- `POSEE_CERTIFICADOS`
- `CONDICION`
- `STATUS_FL`
- `GERENCIA_1`, `GERENCIA_2`, `GERENCIA_3`
- `EDIFICIO`, `LOCALIDAD`, `MUNICIPIO`
- Foto y documento PDF opcional

### 8.4 Procedimiento de importación masiva

1. Seleccionar `Fuerza Laboral` en el menú.
2. Presionar `📥 Arrastre aquí el Excel de Fuerza Laboral (Hoja DATOS)` o el botón de selección.
3. Si no se tiene formato, presionar `📥 Descargar Plantilla`.
4. Completar la plantilla manteniendo las cabeceras sin modificar.
5. Arrastrar el archivo al área de arrastre.

#### Reglas de validación

- El archivo debe contener la hoja `DATOS` o la primera hoja válida.
- Las cabeceras más importantes son `N_PERSONAL`, `CEDULA`, `NOMBRES`, `APELLIDOS`, `PUESTO_FUNCIONAL`, `POSICION_SAP`, `DESCRIPCION_POSICION_SAP`, `DESCRIPCION`.
- El sistema admite variantes de mayúsculas/minúsculas y espacios en los encabezados.

### 8.5 Exportación

Presionar `🟢 Exportar Excel` para generar el archivo `FuerzaLaboral_Consolidado.xlsx` con todos los registros almacenados.

## 9. Módulo Vacaciones

### 9.1 Objetivo

Registrar la programación de vacaciones del personal.

### 9.2 Funcionalidades principales

- Registrar vacaciones por mes y nómina.
- Importar planillas de vacaciones.
- Exportar consolidado de programación.
- Descarga de plantilla de ejemplo.

### 9.3 Campos clave

- `MES`
- `NOMINA`
- `GERENCIA`
- `FECHA`
- `CEDULA`
- `SAP`
- `APELLIDOS`
- `NOMBRES`
- `FECHA_ING`
- `DIAS_PENDIENTES`
- `PERIODO`
- `DIAS_LOTT`
- `DIAS_HABILES_DISFRUTE`
- `DIAS_CONTINUO_PLANTILLA`
- `VACACIONES_DESDE`
- `VACACIONES_HASTA`
- `TOTAL_DIAS`
- `DIAS_RESTANTE`
- `PERIODO_RESTANTE`
- `OBSERVACION`
- `RESPONSABLE_ADM`
- `OBSERVACIONES_CAIT`
- `PROCESADA_STATUS`
- `COD_AREA`

### 9.4 Procedimiento de importación masiva

1. Seleccionar `Data Vacaciones`.
2. Descargar plantilla de ejemplo si es necesario.
3. Completar la plantilla cuidando las cabeceras.
4. Arrastrar el archivo al área de importación.

#### Reglas de validación

- Debe existir la columna `CEDULA`, `SAP` y `MES`.
- El sistema interpreta si existe una columna `ITEM` en la cabecera, adaptando el desplazamiento de columnas.
- Si la cédula no está registrada en el maestro, el registro se importa pero se indica con una advertencia.

### 9.5 Exportación

Presionar `🟣 Exportar Plantilla Real` para generar el consolidado de vacaciones.

## 10. Administración segura

### 10.1 Acceso

Las funciones administrativas están ocultas en un modal y requieren la contraseña:

- **Raida17**

### 10.2 Funciones disponibles

- Vaciar Maestro Personal
- Vaciar Programación Vacaciones
- Respaldar Base de Datos
- Restaurar Respaldo
- Arrastrar archivo de respaldo `(.json o .db)`

### 10.3 Procedimiento

1. Presionar `🔒 Administración segura`.
2. Ingresar la contraseña `Raida17`.
3. Al desbloquear, usar las funciones según sea necesario.

> Nota: estas acciones son sensibles y deben usarse con cuidado.

## 11. Tour guiado integrado

El sistema incluye un botón `👣 Tour guiado del sistema` que enseña los pasos principales en pantalla.

### 11.1 Uso del tour

1. Presionar `👣 Tour guiado del sistema`.
2. Seguir las instrucciones del tooltip.
3. Usar `Anterior`, `Siguiente` o `Cerrar` según se requiera.

## 12. Buenas prácticas de uso

- Siempre descargar la plantilla antes de cargar un nuevo Excel.
- No modificar las cabeceras de las hojas.
- Realizar un respaldo antes de vaciar datos.
- Cerrar la sesión cuando termine el trabajo.

## 13. Recomendaciones de documentación PDVSA

Este manual sigue un enfoque estructurado similar al de la Fábrica de Software de PDVSA:

- Se definen propósito, alcance y audiencia.
- Se describen procedimientos paso a paso.
- Se incluyen controles de seguridad.
- Se registran versiones y autoría.
- Se prioriza claridad y consistencia.

## 14. Glosario

- **Fuerza Laboral**: maestro de trabajadores.
- **Vacaciones**: programación de días de descanso.
- **SAP**: número de posición SAP del trabajador.
- **RIVEROJDU**: desarrollador responsable del sistema.
- **Backup**: copia de seguridad de la base local.

## 15. Contacto y soporte

Para dudas o problemas con el sistema, contacte al responsable de desarrollo de la Gerencia de Transporte Terrestre RIVEROJDU@PDVSA.COM.
