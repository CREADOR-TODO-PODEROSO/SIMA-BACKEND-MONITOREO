## SIMA Backend Monitoreo

Descripción del Proyecto

El proyecto propone la implementación de un Sistema de Observador del Aprendiz en el Centro Tecnológico de la Producción Industrial (CTPI) del SENA, con el objetivo de fortalecer el seguimiento formativo y mejorar la comunicación entre instructores, coordinación académica y aprendices.

La iniciativa responde a la necesidad de centralizar la información relacionada con el proceso formativo del aprendiz y facilitar la identificación temprana de dificultades académicas o comportamentales. Mediante el uso de herramientas digitales y el registro estructurado de información, el sistema busca optimizar la gestión académica y apoyar un acompañamiento pedagógico más oportuno y efectivo.

En su estado actual, el sistema ha sido ajustado para enfocarse en el monitoreo de asistencias y registro de observaciones, centrando el flujo principal en la notificación y seguimiento de inasistencias y situaciones relevantes dentro del proceso formativo.

Arquitectura del Proyecto

El proyecto adopta una arquitectura por capas orientada a API REST. Aunque la estructura de carpetas guarda similitudes con el patrón MVC, no se implementa completamente como tal, ya que no existe una capa de vistas. En su lugar, el sistema se organiza en componentes como:


Esta organización permite una separación clara de responsabilidades y facilita el mantenimiento del sistema.

Manejo de Base de Datos

Para la interacción con la base de datos se utiliza Sequelize, un ORM (Object-Relational Mapping) que permite mapear tablas de la base de datos a modelos en JavaScript y gestionar operaciones sin necesidad de escribir SQL directamente.

Entre sus ventajas:

Abstracción del acceso a la base de datos
Reducción de código repetitivo en operaciones CRUD
Manejo simplificado de relaciones entre entidades
Integración con migraciones para versionamiento de la estructura

Sin embargo, también presenta algunas consideraciones:

Puede generar consultas menos optimizadas en escenarios complejos
Requiere comprender tanto el ORM como el modelo relacional subyacente
En consultas avanzadas, puede ser necesario recurrir a SQL manual

Alcance Actual

El sistema actualmente se enfoca en:

Registro de asistencias
Gestión de observaciones académicas o convivenciales
Notificación de eventos relevantes asociados al aprendiz

## Estructura del proyecto

- `src/routes`: definicion de endpoints
- `src/controller`: manejo de entrada y salida HTTP
- `src/services`: reglas de negocio
- `src/models`: modelos Sequelize
- `src/middlewares`: autenticacion, permisos y validaciones
- `src/helpers`: utilidades compartidas
- `src/config`: entorno y conexion a base de datos
- `tools`: utilidades auxiliares para datos base

## Base de datos

La estructura principal del proyecto se carga desde:

- `basededatos.sql`

Actualmente el proyecto no usa migraciones activas de Sequelize como fuente del esquema.

## Contrato EP04 - Alertas y notificaciones

- Los estados funcionales de alertas son `ABIERTA` y `CERRADA`.
- La reapertura de alertas se realiza enviando `estado=ABIERTA` a `PATCH /api/alerts/:id/status` con `justificacion_reapertura`.
- El cierre de alertas se realiza enviando `estado=CERRADA` a `PATCH /api/alerts/:id/status` con `justificacion_cierre`.
- Las justificaciones de cierre y reapertura deben tener entre 20 y 2000 caracteres.
- Las notificaciones se consultan en `GET /api/notifications`, se marcan como leidas en `PATCH /api/notifications/:id/read` y `PATCH /api/notifications/read-all`.
- El stream de notificaciones en tiempo real usa SSE en `GET /api/notifications/stream?token=<jwt>`.
- La regla automatica de cinco inasistencias se evalua por trimestre con `regla_disparo=5_TRIMESTRE` y severidad `CRITICA`.

Para bases de datos ya creadas, los cambios de `basededatos.sql` deben aplicarse manualmente o recrear el esquema desde el script actualizado.

## Instalacion

```bash
npm install
```

## Ejecucion

Modo desarrollo:

```bash
npm run dev
```

Modo normal:

```bash
npm start
```

## Despliegue en Railway

El repositorio incluye `railway.toml` y un endpoint de salud en:

- `GET /health`

Variables obligatorias en produccion:

- `NODE_ENV=production`
- `JWT_SECRET`
- `CORS_ORIGIN`

Conexion MySQL:

- Si usas el plugin MySQL de Railway, el backend acepta directamente
  `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER` y `MYSQLPASSWORD`.
- Tambien acepta `MYSQL_URL` o `DATABASE_URL` si prefieres usar una unica URL
  de conexion.
- Si usas una base externa o variables propias, configura `DB_HOST`,
  `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.

Variables opcionales:

- `DB_SSL=true` si el proveedor MySQL exige TLS.
- `DB_SSL_REJECT_UNAUTHORIZED=false` solo si el proveedor usa un certificado no verificable.
- `UPLOAD_DIR=/app/uploads` o la ruta montada de un volumen persistente.

## Imagen de perfil con Cloudinary

La foto de perfil se actualiza en:

- `PATCH /api/profile/photo`

El endpoint es autenticado, recibe `multipart/form-data` con el campo `foto`,
acepta `JPG`, `PNG` y `WEBP`, y limita el archivo a `2 MB`.

Variables necesarias para habilitar la subida:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_PROFILE_FOLDER=sima/profile-photos` opcional

Para bases de datos existentes, aplicar manualmente:

```sql
ALTER TABLE personas
  ADD COLUMN foto_perfil_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN foto_perfil_public_id VARCHAR(255) DEFAULT NULL;
```

Railway proporciona `PORT` automaticamente. No se debe copiar el archivo `.env`
al servicio ni almacenar secretos en el repositorio.

Notas para produccion:

- Los archivos guardados en `UPLOAD_DIR` son temporales y se pierden tras
  redeploys si no hay un volumen persistente o almacenamiento externo.
- Si se usa el servicio MySQL de Railway, las variables del backend pueden
  mapearse desde las variables del servicio MySQL.

## Autenticacion

Las rutas protegidas requieren:

```http
Authorization: Bearer <token>
```

### Inicio de sesion

Ruta:

- `POST /api/auth/login`

Body:

```json
{
  "numero_documento": "1234567890",
  "password": "Admin123"
}
```

Nota:

- El inicio de sesion se realiza unicamente con `numero_documento`.

### Usuario autenticado

Ruta:

- `GET /api/auth/me`

## Roles manejados

- `coordinador`
- `instructor`
- `aprendiz`

## Endpoints

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### Usuarios

Acceso:

- Solo `coordinador`

Rutas:

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

Body minimo para crear usuario:

```json
{
  "email": "usuario@sena.edu.co",
  "id_rol": 2,
  "tipo_documento": "CC",
  "numero_documento": "123456789",
  "nombres": "Juan",
  "apellidos": "Perez",
  "telefono": "3123456789"
}
```

### Roles

Rutas:

- `GET /api/roles`
- `GET /api/roles/:id`
- `GET /api/roles/:id/usuarios`
- `PUT /api/roles/usuarios/:idUsuario`

Body para asignar rol:

```json
{
  "id_rol": 2
}
```

### Perfil

Rutas:

- `GET /api/profile/overview`
- `PUT /api/profile/overview`

Body permitido:

```json
{
  "email": "nuevo@sena.edu.co",
  "telefono": "3000000000",
  "password_actual": "claveActual",
  "password_nuevo": "claveNueva"
}
```

### Dashboard de coordinacion

Acceso:

- Solo `coordinador`

Rutas:

- `GET /api/dashboard/coordinador/resumen`
- `GET /api/dashboard/coordinador/area/:idArea`

### Areas de coordinador

Acceso:

- Solo `coordinador`

Rutas:

- `POST /api/coordinator-areas`
- `GET /api/coordinator-areas/:idUsuario`
- `DELETE /api/coordinator-areas/:idUsuario/:idArea`

Body para asignar area:

```json
{
  "id_area": 1,
  "id_usuario": 1
}
```

### Programas de formacion

Acceso:

- Solo `coordinador`

Rutas:

- `GET /api/formative-programs/area/:idArea`

### Grupos

Acceso:

- `GET /api/groups` y `GET /api/groups/:id`: `coordinador`, `instructor`
- Operaciones de escritura: solo `coordinador`
- Para instructores, la consulta aplica sobre grupos donde sean lideres o tengan asignacion activa

Rutas:

- `GET /api/groups`
- `GET /api/groups/:id`
- `GET /api/groups/verificar-ficha/:numero_ficha`
- `GET /api/groups/instructores-disponibles`
- `POST /api/groups`
- `PUT /api/groups/:id`
- `PATCH /api/groups/:id/estado`
- `PATCH /api/groups/:id/instructor-lider`

Body minimo para crear grupo:

```json
{
  "numero_ficha": "3064975",
  "id_programa": 1,
  "jornada": "Manana",
  "trimestres": 6,
  "fecha_inicio": "2025-01-20",
  "id_ambiente": 1,
  "id_instructor_lider": 1
}
```

Nota:

- `id_instructor_lider` es opcional en la creacion.
- Si no se envia, el grupo se crea sin lider asignado y puede actualizarse despues con `PATCH /api/groups/:id/instructor-lider`.

Body para cambiar estado:

```json
{
  "estado": "CERRADO"
}
```

Body para asignar instructor lider:

```json
{
  "id_instructor": 1
}
```

### Aprendices

Acceso:

- `GET /api/apprentices/grupos-activos`: `coordinador`, `instructor`
- `GET /api/apprentices/listado`: solo `coordinador`
- `GET /api/apprentices/grupo/:idGrupo`: `coordinador`, `instructor`
- `GET /api/apprentices/:id`: `coordinador`, `instructor`
- `POST /api/apprentices/registro`: `coordinador`, `instructor`
- `POST /api/apprentices/registro-masivo`: solo `coordinador`
- La consulta para instructores aplica sobre grupos donde sean lideres o tengan asignacion activa
- El registro individual de aprendices por instructor se restringe a fichas donde sea instructor lider

Rutas:

- `GET /api/apprentices/grupos-activos`
- `GET /api/apprentices/listado`
- `GET /api/apprentices/grupo/:idGrupo`
- `GET /api/apprentices/:id`
- `POST /api/apprentices/registro`
- `POST /api/apprentices/registro-masivo`

Body para registro individual:

```json
{
  "tipo_documento": "CC",
  "numero_documento": "123456789",
  "nombres": "Juan",
  "apellidos": "Perez",
  "email": "juan@sena.edu.co",
  "telefono": "3000000000",
  "numero_ficha": "3064975"
}
```

Registro masivo:

- tipo: `form-data`
- campo esperado: `archivo`
- formatos admitidos: `.xlsx`, `.xls`

### Alertas

Acceso:

- Todas las rutas documentadas requieren `coordinador` o `instructor`

Rutas:

- `GET /api/alerts`
- `GET /api/alerts/:id`
- `PATCH /api/alerts/:id/status`
- `POST /api/alerts/manual`
- `POST /api/alerts/reevaluate/attendance/:idAprendiz`
- `POST /api/alerts/reevaluate/observations/:idAprendiz`

Body para alerta manual:

```json
{
  "id_aprendiz": 1,
  "severidad": "GRAVE",
  "descripcion": "Se reporta situacion academica critica por bajo desempeno sostenido.",
  "id_grupo": 1
}
```

Body para cambio de estado:

```json
{
  "estado": "EN_SEGUIMIENTO"
}
```

## Tools

### Crear roles base

```bash
node tools/create-roles.js
```

### Crear coordinador base

```bash
node tools/create-coordinator.js
```

### Asignar area a coordinador

```bash
node tools/assign-area-to-coordinator.js <numero_documento> <id_area>
```

Ejemplo:

```bash
node tools/assign-area-to-coordinator.js 1234567890 1
```

Si no envias parametros, el script usa:

- documento: `1234567890`
- area: `1`

## Notas

- La respuesta general del backend usa `ok`, `message`, `data` y, cuando aplica, `errors`.
- Para validar documentacion, toma como referencia principal las rutas reales de `src/routes`.
- Este README describe los modulos y rutas presentes actualmente en el arbol activo del backend.
- `README.md` y `basededatos.sql` deben mantenerse alineados con la implementacion activa del backend.
