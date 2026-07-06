const { validationResult, body } = require('express-validator');
const ApprenticeService = require('../services/ApprenticeService');
const { successResponse, errorResponse } = require('../helpers/response');
const { sequelize } = require('../models');

const getApprenticesByGroup = async (req, res) => {
  try {
    const { idGrupo } = req.params;
    const result = await ApprenticeService.getByGroup(idGrupo, req.query, req.user);
    return successResponse(res, 'Aprendices del grupo obtenidos correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar aprendices del grupo', error.status || 500);
  }
};

const getAprendicesListado = async (req, res) => {
  try {
    const result = await ApprenticeService.getList(req.query, req.user);
    return successResponse(res, 'Listado de aprendices obtenido correctamente', result);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar listado de aprendices', error.status || 500);
  }
};

const getFichasActivas = async (req, res) => {
  try {
    const fichas = await ApprenticeService.getActiveGroups(req.user);
    return successResponse(res, 'Fichas activas obtenidas correctamente', fichas);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al consultar fichas activas', error.status || 500);
  }
};

const getApprenticeById = async (req, res) => {
  try {
    const { id } = req.params;
    const aprendiz = await ApprenticeService.getById(id, req.user);
    return successResponse(res, 'Aprendiz obtenido correctamente', aprendiz);
  } catch (error) {
    return errorResponse(res, error.message || 'Error al obtener aprendiz', error.status || 500);
  }
};

const registrarIndividual = async (req, res) => {
  const erroresValidacion = validationResult(req);

  if (!erroresValidacion.isEmpty()) {
    return errorResponse(res, 'Datos inválidos', 400, erroresValidacion.array().map((e) => ({ campo: e.path, mensaje: e.msg })));
  }

  const transaction = await sequelize.transaction();

  try {
    const datos = {
      tipo_documento: String(req.body.tipo_documento).trim().toUpperCase(),
      numero_documento: String(req.body.numero_documento).trim(),
      nombres: String(req.body.nombres).trim(),
      apellidos: String(req.body.apellidos).trim(),
      email: String(req.body.email).trim().toLowerCase(),
      telefono: req.body.telefono ? String(req.body.telefono).trim() : null,
      numero_ficha: String(req.body.numero_ficha).trim(),
    };

    const resultado = await ApprenticeService.registerApprentice(datos, req.user, transaction);
    await transaction.commit();

    return successResponse(res, resultado.mensaje, resultado, 201);
  } catch (err) {
    await transaction.rollback();

    if (err.name === 'SequelizeUniqueConstraintError') {
      return errorResponse(res, 'Ya existe un usuario con ese email o número de documento', 409);
    }
    return errorResponse(res, err.message || 'Error interno al registrar el aprendiz', err.status || 500);
  }
};

const registrarMasivo = async (req, res) => {
  if (!req.file) {
    return errorResponse(res, "Se requiere un archivo Excel. Envía el campo 'archivo' como form-data.", 400);
  }

  try {
    const result = await ApprenticeService.bulkRegister(req.file.path, req.user);
    if (result.exitosos > 0) {
      return successResponse(res, result.mensaje, {
        total: result.totalProcesados,
        exitosos: result.exitosos,
        fallidos: result.fallidos,
        resultados: result.resultados
      }, 207);
    }
    return errorResponse(res, result.mensaje, 400, result.resultados);
  } catch (error) {
    return errorResponse(res, error.message || 'Error interno al procesar el archivo Excel', error.status || 500);
  }
};

const validacionesRegistro = [
  body('tipo_documento').trim().notEmpty().withMessage('El tipo de documento es obligatorio').isIn(['CC', 'TI', 'CE', 'PA', 'PEP', 'PPT']).withMessage('Tipo de documento no válido. Use: CC, TI, CE, PA, PEP o PPT'),
  body('numero_documento').trim().notEmpty().withMessage('El número de documento es obligatorio').isLength({ min: 5, max: 20 }).withMessage('El documento debe tener entre 5 y 20 caracteres'),
  body('nombres').trim().notEmpty().withMessage('Los nombres son obligatorios').isLength({ max: 100 }).withMessage('Los nombres no pueden superar 100 caracteres'),
  body('apellidos').trim().notEmpty().withMessage('Los apellidos son obligatorios').isLength({ max: 100 }).withMessage('Los apellidos no pueden superar 100 caracteres'),
  body('email').trim().notEmpty().withMessage('El email es obligatorio').isEmail().withMessage('El email no tiene un formato válido').isLength({ max: 120 }).withMessage('El email no puede superar 120 caracteres'),
  body('telefono').optional({ checkFalsy: true }).trim().isLength({ max: 20 }).withMessage('El teléfono no puede superar 20 caracteres'),
  body('numero_ficha').trim().notEmpty().withMessage('El número de ficha es obligatorio'),
];

module.exports = {
  getApprenticesByGroup,
  getAprendicesListado,
  getFichasActivas,
  getApprenticeById,
  registrarIndividual,
  registrarMasivo,
  validacionesRegistro,
};
