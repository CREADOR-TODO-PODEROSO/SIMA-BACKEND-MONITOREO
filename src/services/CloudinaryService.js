const crypto = require('crypto');
const env = require('../config/env');

class CloudinaryService {
  static _assertConfigured() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw {
        status: 500,
        message: 'Cloudinary no esta configurado para subir imagenes de perfil',
      };
    }
  }

  static _sign(params) {
    const payload = Object.keys(params)
      .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join('&');

    return crypto
      .createHash('sha1')
      .update(`${payload}${env.CLOUDINARY_API_SECRET}`)
      .digest('hex');
  }

  static async uploadProfilePhoto(file, idUsuario) {
    this._assertConfigured();

    if (!file?.buffer?.length) {
      throw { status: 400, message: 'La imagen de perfil es obligatoria' };
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = env.CLOUDINARY_PROFILE_FOLDER;
    const publicId = `usuario_${idUsuario}_${timestamp}`;
    const params = {
      folder,
      overwrite: 'true',
      public_id: publicId,
      timestamp,
    };

    const formData = new FormData();
    formData.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    formData.append('api_key', env.CLOUDINARY_API_KEY);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('public_id', publicId);
    formData.append('overwrite', 'true');
    formData.append('signature', this._sign(params));

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw {
        status: response.status >= 500 ? 502 : 400,
        message: data?.error?.message || 'No fue posible subir la imagen a Cloudinary',
      };
    }

    return {
      url: data.secure_url,
      public_id: data.public_id,
    };
  }

  static async deleteImage(publicId) {
    if (!publicId) return;
    this._assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      public_id: publicId,
      timestamp,
    };

    const formData = new FormData();
    formData.append('api_key', env.CLOUDINARY_API_KEY);
    formData.append('timestamp', String(timestamp));
    formData.append('public_id', publicId);
    formData.append('signature', this._sign(params));

    await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
      { method: 'POST', body: formData }
    ).catch(() => null);
  }
}

module.exports = CloudinaryService;
