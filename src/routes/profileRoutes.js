const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const authMiddleware = require('../middlewares/authmiddleware');
const { validateRequest } = require('../middlewares/validatemiddleware');
const { getProfile, updateProfile } = require('../controller/profileController');

router.get(
  '/overview',
  authMiddleware,
  getProfile
);

router.put(
  '/overview',
  authMiddleware,
  [
    body('email')
      .optional()
      .trim()
      .isEmail()
      .withMessage('Debe proporcionar un correo electrónico válido')
      .normalizeEmail(),
    body('telefono')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('El teléfono no puede estar vacío si se proporciona')
      .isLength({ max: 20 })
      .withMessage('El teléfono no puede tener más de 20 caracteres'),
    body('password_nuevo')
      .optional()
      .isLength({ min: 6 })
      .withMessage('La nueva contraseña debe tener al menos 6 caracteres'),
    body('password_actual')
      .if(body('password_nuevo').exists())
      .notEmpty()
      .withMessage('Debe proporcionar la contraseña actual para establecer una nueva')
  ],
  validateRequest,
  updateProfile
);

module.exports = router;
