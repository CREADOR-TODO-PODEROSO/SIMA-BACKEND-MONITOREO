# Configuracion de Cloudinary para imagen de perfil en SIMA

Este documento explica como crear una cuenta en Cloudinary y conectar Cloudinary con el backend `SIMA-BACKEND-MONITOREO` para la subida de imagenes de perfil.

## 1. Crear cuenta en Cloudinary

1. Ingresa a `https://cloudinary.com`.
2. Selecciona `Sign up for free`.
3. Registra la cuenta con correo, GitHub, Google u otro metodo permitido.
4. Confirma el correo si Cloudinary lo solicita.
5. Entra al dashboard principal de Cloudinary.

## 2. Obtener credenciales

En el dashboard de Cloudinary busca la seccion `API Keys` o `Product Environment Credentials`.

Necesitas estos valores:

- `Cloud name`
- `API key`
- `API secret`

En SIMA se mapearan asi:

```env
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
CLOUDINARY_PROFILE_FOLDER=sima/profile-photos
```

Importante:

- `CLOUDINARY_API_SECRET` nunca debe ir en frontend web.
- `CLOUDINARY_API_SECRET` nunca debe ir en Flutter.
- Las credenciales solo deben configurarse en el backend.
- No subir `.env` real al repositorio.

## 3. Configurar variables en Railway

1. Abre el proyecto backend en Railway.
2. Entra al servicio `SIMA-BACKEND-MONITOREO`.
3. Ve a `Variables`.
4. Agrega:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_PROFILE_FOLDER=sima/profile-photos
```

5. Guarda los cambios.
6. Railway debe redeployar el backend o debes ejecutar un redeploy manual.

## 4. Configurar variables en local

En el archivo `.env` local del backend agrega:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_PROFILE_FOLDER=sima/profile-photos
```

Despues reinicia el backend:

```bash
npm run dev
```

## 5. Actualizar base de datos existente

Para una base de datos ya creada, aplica manualmente:

```sql
ALTER TABLE personas
  ADD COLUMN foto_perfil_url VARCHAR(500) DEFAULT NULL,
  ADD COLUMN foto_perfil_public_id VARCHAR(255) DEFAULT NULL;
```

Si la base se crea desde cero usando `basededatos.sql`, las columnas ya deben estar incluidas en la tabla `personas`.

## 6. Endpoint backend

El backend expone:

```http
PATCH /api/profile/photo
```

Headers:

```http
Authorization: Bearer <token>
```

Body:

```txt
multipart/form-data
foto: archivo de imagen
```

Formatos permitidos:

- `image/jpeg`
- `image/png`
- `image/webp`

Limite:

- 2 MB

Respuesta esperada:

```json
{
  "ok": true,
  "message": "Foto de perfil actualizada correctamente",
  "data": {
    "foto_perfil_url": "https://res.cloudinary.com/..."
  }
}
```

## 7. Prueba manual recomendada

1. Inicia sesion y copia el token.
2. En Postman o Thunder Client crea una peticion:

```http
PATCH https://TU_BACKEND/api/profile/photo
```

3. En `Authorization`, usa `Bearer Token`.
4. En `Body`, selecciona `form-data`.
5. Agrega una key llamada `foto` de tipo `File`.
6. Sube una imagen JPG, PNG o WEBP menor a 2 MB.
7. Confirma que la respuesta incluye `foto_perfil_url`.
8. Confirma en MySQL:

```sql
SELECT id_persona, id_usuario, foto_perfil_url, foto_perfil_public_id
FROM personas
WHERE id_usuario = <ID_USUARIO>;
```

## 8. Errores comunes

### Cloudinary no esta configurado

Causa:

- Falta alguna variable `CLOUDINARY_*` en Railway o `.env`.

Solucion:

- Revisar variables.
- Reiniciar/redeployar backend.

### La imagen supera 2 MB

Causa:

- El archivo excede el limite configurado.

Solucion:

- Usar una imagen menor a 2 MB.

### Formato no permitido

Causa:

- Se intento subir PDF, GIF, SVG u otro tipo no permitido.

Solucion:

- Usar JPG, PNG o WEBP.

### La columna no existe en MySQL

Causa:

- La base de datos existente no recibio el `ALTER TABLE`.

Solucion:

- Aplicar el SQL de la seccion 5.
