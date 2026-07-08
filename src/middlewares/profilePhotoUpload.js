const path = require('path');
const multer = require('multer');

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const uploadProfilePhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    const error = new Error('Formato de imagen no permitido. Usa JPG, PNG o WEBP');
    error.status = 400;
    cb(error);
  },
});

const profilePhotoUploadErrorHandler = (error, _req, res, next) => {
  if (!error) return next();

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      ok: false,
      message: 'La imagen de perfil no puede superar 2 MB',
      errors: null,
    });
  }

  return res.status(error.status || 400).json({
    ok: false,
    message: error.message || 'No fue posible procesar la imagen de perfil',
    errors: null,
  });
};

module.exports = {
  uploadProfilePhoto,
  profilePhotoUploadErrorHandler,
};
