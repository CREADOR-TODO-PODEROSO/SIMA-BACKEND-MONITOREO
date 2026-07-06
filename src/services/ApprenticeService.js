const { Op } = require('sequelize');
const exceljs = require('exceljs');
const fs = require('fs');

const {
  sequelize,
  Apprentice,
  ApprenticeGroup,
  EducationalArea,
  FormativeProgram,
  Group,
  InstructorGroup,
  Person,
  Role,
  User,
} = require('../models');
const { hashPassword } = require('../helpers/bcrypt');
const { getPagination } = require('../helpers/pagination');
const {
  getCoordinatorAreaIds,
  getAccessibleGroupIdsForRequester,
  assertRequesterCanAccessGroup,
  assertRequesterCanRegisterApprenticeInGroup,
} = require('../helpers/coordinatorAuth');

class ApprenticeService {
  static async _obtenerGrupoActivoPorFicha(numero_ficha, transaction) {
    return Group.findOne({ where: { numero_ficha, estado: 'EN_FORMACION' }, transaction });
  }

  static async _validarPermisoSobreFicha(requester, grupo, transaction) {
    return assertRequesterCanRegisterApprenticeInGroup(requester, grupo, transaction);
  }

  static async _obtenerRolAprendiz(transaction) {
    return Role.findOne({ where: { nombre: 'aprendiz' }, transaction });
  }

  static _getTextValue(row, colIndex) {
    if (!colIndex) return '';
    const cell = row.getCell(colIndex);
    return cell && cell.value !== null && cell.value !== undefined ? String(cell.value).trim() : '';
  }

  static async _getAccessibleGroupIdsForRequester(requester) {
    return getAccessibleGroupIdsForRequester(requester);
  }

  static async _assertRequesterCanAccessGroup(requester, id_grupo) {
    return assertRequesterCanAccessGroup(
      requester,
      id_grupo,
      'No tienes permisos para consultar los aprendices de este grupo'
    );
  }

  static _getActiveGroupIdsForApprentice(aprendiz) {
    return (aprendiz.aprendiz_grupos || [])
      .filter((aprendizGrupo) => aprendizGrupo.estado === 'ACTIVO' && aprendizGrupo.grupo)
      .map((aprendizGrupo) => aprendizGrupo.grupo.id_grupo);
  }

  static async registerApprentice(datos, requester, transaction) {
    const { tipo_documento, numero_documento, nombres, apellidos, email, telefono, numero_ficha } = datos;

    const grupo = await this._obtenerGrupoActivoPorFicha(numero_ficha, transaction);
    if (!grupo) throw { status: 400, message: `La ficha '${numero_ficha}' no existe o no se encuentra en formacion` };

    await this._validarPermisoSobreFicha(requester, grupo, transaction);

    const rolAprendiz = await this._obtenerRolAprendiz(transaction);
    if (!rolAprendiz) throw { status: 500, message: "El rol 'aprendiz' no esta configurado en el sistema" };

    const personaExistente = await Person.findOne({ where: { numero_documento }, transaction });

    let usuario = null;
    let aprendiz = null;
    let accion = 'registrado exitosamente';

    if (personaExistente) {
      usuario = await User.findByPk(personaExistente.id_usuario, {
        include: [{ model: Role, as: 'rol', attributes: ['id_rol', 'nombre'] }],
        transaction,
      });

      if (!usuario) throw { status: 500, message: `El documento ${numero_documento} existe en personas pero no tiene usuario asociado` };

      if (usuario.rol?.nombre !== 'aprendiz') {
        throw {
          status: 409,
          message: `El numero de documento ${numero_documento} ya esta asociado a un usuario con rol '${usuario.rol?.nombre || 'desconocido'}' y no puede registrarse como aprendiz`,
        };
      }

      aprendiz = await Apprentice.findOne({ where: { id_usuario: usuario.id_usuario }, transaction });

      if (!aprendiz) {
        throw {
          status: 500,
          message: `El usuario con documento ${numero_documento} tiene rol aprendiz pero no cuenta con perfil en aprendices`,
        };
      }

      if (aprendiz.estado !== 'ACTIVO') {
        await aprendiz.update({ estado: 'ACTIVO' }, { transaction });
      }

      const matriculaExistente = await ApprenticeGroup.findOne({
        where: { id_aprendiz: aprendiz.id_aprendiz, id_grupo: grupo.id_grupo },
        transaction,
      });

      if (matriculaExistente) {
        if (matriculaExistente.estado === 'ACTIVO') {
          throw { status: 409, message: `El documento ${numero_documento} ya esta matriculado en la ficha ${numero_ficha}` };
        }

        await matriculaExistente.update({ estado: 'ACTIVO' }, { transaction });

        return {
          success: true,
          numero_documento,
          mensaje: 'Matricula reactivada correctamente',
          accion: 'reactivacion_matricula',
          aprendiz: { id_aprendiz: aprendiz.id_aprendiz, id_usuario: usuario.id_usuario },
          grupo: { id_grupo: grupo.id_grupo, numero_ficha: grupo.numero_ficha },
        };
      }

      await ApprenticeGroup.create(
        { id_aprendiz: aprendiz.id_aprendiz, id_grupo: grupo.id_grupo, estado: 'ACTIVO' },
        { transaction }
      );
      accion = 'matriculado en nueva ficha';
    } else {
      const emailExistente = await User.findOne({ where: { email }, transaction });
      if (emailExistente) throw { status: 409, message: `El correo ${email} ya esta registrado para otro usuario` };

      const passwordHash = await hashPassword(numero_documento);

      usuario = await User.create(
        {
          email,
          password: passwordHash,
          id_rol: rolAprendiz.id_rol,
          estado: 'ACTIVO',
          debe_cambiar_password: true,
        },
        { transaction }
      );

      await Person.create(
        { id_usuario: usuario.id_usuario, tipo_documento, numero_documento, nombres, apellidos, telefono: telefono || null },
        { transaction }
      );

      aprendiz = await Apprentice.create(
        { id_usuario: usuario.id_usuario, estado_formativo: 'EN_FORMACION', estado: 'ACTIVO' },
        { transaction }
      );

      await ApprenticeGroup.create(
        { id_aprendiz: aprendiz.id_aprendiz, id_grupo: grupo.id_grupo, estado: 'ACTIVO' },
        { transaction }
      );
    }

    return {
      success: true,
      numero_documento,
      mensaje: accion === 'registrado exitosamente' ? 'Aprendiz registrado exitosamente' : 'Aprendiz matriculado en una nueva ficha',
      accion,
      aprendiz: { id_aprendiz: aprendiz.id_aprendiz, id_usuario: usuario.id_usuario },
      grupo: { id_grupo: grupo.id_grupo, numero_ficha: grupo.numero_ficha },
    };
  }

  static async bulkRegister(filePath, requester) {
    try {
      const workbook = new exceljs.Workbook();
      await workbook.xlsx.readFile(filePath);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw { status: 400, message: 'El archivo Excel esta vacio o es invalido' };

      const headerRow = worksheet.getRow(1);
      const headers = {};

      headerRow.eachCell((cell, colNumber) => {
        headers[String(cell.value).toLowerCase().trim()] = colNumber;
      });

      const expectedHeaders = ['tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'email', 'numero_ficha'];
      const missingHeaders = expectedHeaders.filter((h) => !headers[h]);

      if (missingHeaders.length > 0) {
        throw { status: 400, message: `Faltan columnas requeridas en el Excel: ${missingHeaders.join(', ')}` };
      }

      const resultados = [];
      let exitosos = 0;
      let fallidos = 0;

      for (let i = 2; i <= worksheet.rowCount; i += 1) {
        const row = worksheet.getRow(i);
        if (!row.hasValues) continue;

        const datos = {
          tipo_documento: this._getTextValue(row, headers.tipo_documento).toUpperCase(),
          numero_documento: this._getTextValue(row, headers.numero_documento),
          nombres: this._getTextValue(row, headers.nombres),
          apellidos: this._getTextValue(row, headers.apellidos),
          email: this._getTextValue(row, headers.email).toLowerCase(),
          telefono: this._getTextValue(row, headers.telefono) || null,
          numero_ficha: this._getTextValue(row, headers.numero_ficha),
        };

        if (!datos.tipo_documento || !datos.numero_documento || !datos.nombres || !datos.apellidos || !datos.email || !datos.numero_ficha) {
          resultados.push({
            fila: i,
            ok: false,
            numero_documento: datos.numero_documento || null,
            error: 'Datos obligatorios faltantes en la fila',
          });
          fallidos += 1;
          continue;
        }

        const transaction = await sequelize.transaction();

        try {
          const resultado = await this.registerApprentice(datos, requester, transaction);
          await transaction.commit();

          resultados.push({
            fila: i,
            ok: true,
            numero_documento: datos.numero_documento,
            mensaje: resultado.mensaje,
          });
          exitosos += 1;
        } catch (err) {
          await transaction.rollback();

          let errorMessage = err.message || 'Error interno al registrar la fila';
          if (err.name === 'SequelizeUniqueConstraintError') {
            errorMessage = 'Ya existe un usuario con ese email o numero de documento';
          }

          resultados.push({
            fila: i,
            ok: false,
            numero_documento: datos.numero_documento,
            error: errorMessage,
          });
          fallidos += 1;
        }
      }

      const totalProcesados = exitosos + fallidos;
      const mensaje = `Procesamiento completado: ${exitosos} exitosos, ${fallidos} fallidos de ${totalProcesados}`;

      return { exitosos, fallidos, totalProcesados, mensaje, resultados };
    } finally {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }
  }

  static async getByGroup(idGrupo, filters, requester) {
    const { estado, estado_formativo, page, limit, documento, nombre } = filters;
    const { limit: take, offset } = getPagination(page, limit);

    const grupo = await Group.findByPk(idGrupo, {
      attributes: ['id_grupo', 'numero_ficha', 'jornada', 'estado', 'id_instructor_lider'],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: ['id_programa', 'nombre_programa'],
          include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
        },
      ],
    });

    if (!grupo) throw { status: 404, message: 'Grupo formativo no encontrado' };
    await this._assertRequesterCanAccessGroup(requester, idGrupo);

    const whereAprendiz = {};
    if (estado) whereAprendiz.estado = estado;
    if (estado_formativo) whereAprendiz.estado_formativo = estado_formativo;

    const wherePersona = {};
    if (documento) wherePersona.numero_documento = { [Op.like]: `%${documento}%` };
    if (nombre) {
      wherePersona[Op.or] = [
        { nombres: { [Op.like]: `%${nombre}%` } },
        { apellidos: { [Op.like]: `%${nombre}%` } },
      ];
    }

    const { count, rows } = await Apprentice.findAndCountAll({
      where: whereAprendiz,
      include: [
        {
          model: ApprenticeGroup,
          as: 'aprendiz_grupos',
          required: true,
          where: { id_grupo: idGrupo, estado: 'ACTIVO' },
          attributes: ['id_aprendiz_grupo', 'estado'],
        },
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email', 'estado'],
          include: [
            {
              model: Person,
              as: 'persona',
              attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'],
              where: Object.keys(wherePersona).length ? wherePersona : undefined,
              required: !!Object.keys(wherePersona).length,
            },
          ],
        },
      ],
      order: [['id_aprendiz', 'DESC']],
      limit: take,
      offset,
      distinct: true,
    });

    return { total: count, pagina: Number(page) || 1, grupo, aprendices: rows };
  }

  static async getList(filters, requester) {
    const { page, limit, estado, estado_formativo, numero_ficha, documento, nombre, anio, programa, id_area } = filters;
    const { limit: take, offset } = getPagination(page, limit);

    const whereAprendiz = {};
    if (estado) whereAprendiz.estado = estado;
    if (estado_formativo) whereAprendiz.estado_formativo = estado_formativo;

    const wherePersona = {};
    if (documento) wherePersona.numero_documento = { [Op.like]: `%${documento}%` };
    if (nombre) {
      wherePersona[Op.or] = [
        { nombres: { [Op.like]: `%${nombre}%` } },
        { apellidos: { [Op.like]: `%${nombre}%` } },
      ];
    }

    const whereGrupo = {};
    if (numero_ficha) whereGrupo.numero_ficha = numero_ficha;
    if (anio) whereGrupo.fecha_inicio = { [Op.gte]: `${anio}-01-01`, [Op.lte]: `${anio}-12-31` };

    const wherePrograma = {};
    if (programa) wherePrograma.nombre_programa = { [Op.like]: `%${programa}%` };

    const whereAreaPrograma = {};

    if (requester.rol === 'coordinador') {
      const areaIds = await getCoordinatorAreaIds(requester.id_usuario);

      if (!areaIds.length) {
        return { total: 0, pagina: Number(page) || 1, aprendices: [] };
      }

      if (id_area) {
        if (!areaIds.includes(Number(id_area))) {
          throw { status: 403, message: 'No tienes permisos para consultar aprendices de esa area' };
        }
        whereAreaPrograma.id_area = Number(id_area);
      } else {
        whereAreaPrograma.id_area = { [Op.in]: areaIds };
      }
    } else if (id_area) {
      whereAreaPrograma.id_area = Number(id_area);
    }

    const includeFormativeProgram = {
      model: FormativeProgram,
      as: 'programa_formacion',
      attributes: ['id_programa', 'nombre_programa'],
      required: true,
      include: [
        {
          model: EducationalArea,
          as: 'area',
          attributes: ['id_area', 'nombre_area'],
          ...(Object.keys(whereAreaPrograma).length ? { where: whereAreaPrograma } : {}),
        },
      ],
      ...(Object.keys(wherePrograma).length ? { where: wherePrograma } : {}),
    };

    const includeGrupo = {
      model: ApprenticeGroup,
      as: 'aprendiz_grupos',
      required: true,
      where: { estado: 'ACTIVO' },
      attributes: ['id_aprendiz_grupo', 'estado'],
      include: [
        {
          model: Group,
          as: 'grupo',
          attributes: ['id_grupo', 'numero_ficha', 'jornada', 'estado', 'fecha_inicio', 'fecha_fin'],
          where: Object.keys(whereGrupo).length ? whereGrupo : undefined,
          required: true,
          include: [includeFormativeProgram],
        },
      ],
    };

    const { count, rows } = await Apprentice.findAndCountAll({
      where: whereAprendiz,
      include: [
        includeGrupo,
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email', 'estado'],
          include: [
            {
              model: Person,
              as: 'persona',
              attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'],
              where: Object.keys(wherePersona).length ? wherePersona : undefined,
              required: !!Object.keys(wherePersona).length,
            },
          ],
        },
      ],
      order: [['id_aprendiz', 'DESC']],
      limit: take,
      offset,
      distinct: true,
    });

    return { total: count, pagina: Number(page) || 1, aprendices: rows };
  }

  static async getActiveGroups(requester) {
    const accessibleGroupIds = await this._getAccessibleGroupIdsForRequester(requester);

    if (!accessibleGroupIds.length) {
      return [];
    }

    return Group.findAll({
      where: { estado: 'EN_FORMACION', id_grupo: { [Op.in]: accessibleGroupIds } },
      attributes: ['id_grupo', 'numero_ficha', 'jornada', 'fecha_inicio', 'fecha_fin', 'estado', 'id_instructor_lider'],
      include: [
        {
          model: FormativeProgram,
          as: 'programa_formacion',
          attributes: ['id_programa', 'nombre_programa'],
          include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
        },
      ],
      order: [['numero_ficha', 'ASC']],
    });
  }

  static _serializeLimitedApprentice(aprendiz, matchingGroupIds) {
    const data = typeof aprendiz.toJSON === 'function' ? aprendiz.toJSON() : aprendiz;

    return {
      id_aprendiz: data.id_aprendiz,
      estado: data.estado,
      estado_formativo: data.estado_formativo,
      usuario: {
        id_usuario: data.usuario?.id_usuario || null,
        estado: data.usuario?.estado || null,
      },
      persona: {
        nombres: data.usuario?.persona?.nombres || null,
        apellidos: data.usuario?.persona?.apellidos || null,
        numero_documento: data.usuario?.persona?.numero_documento || null,
      },
      aprendiz_grupos: (data.aprendiz_grupos || [])
        .filter((item) => matchingGroupIds.includes(Number(item.grupo?.id_grupo)))
        .map((item) => ({
          id_aprendiz_grupo: item.id_aprendiz_grupo,
          estado: item.estado,
          grupo: item.grupo
            ? {
                id_grupo: item.grupo.id_grupo,
                numero_ficha: item.grupo.numero_ficha,
                jornada: item.grupo.jornada,
                estado: item.grupo.estado,
                programa_formacion: item.grupo.programa_formacion
                  ? {
                      id_programa: item.grupo.programa_formacion.id_programa,
                      nombre_programa: item.grupo.programa_formacion.nombre_programa,
                    }
                  : null,
              }
            : null,
        })),
      acceso: 'limitado',
    };
  }

  static async getById(id, requester) {
    const aprendiz = await Apprentice.findByPk(id, {
      include: [
        {
          model: User,
          as: 'usuario',
          attributes: ['id_usuario', 'email', 'estado'],
          include: [{ model: Person, as: 'persona', attributes: ['id_persona', 'tipo_documento', 'numero_documento', 'nombres', 'apellidos', 'telefono'] }],
        },
        {
          model: ApprenticeGroup,
          as: 'aprendiz_grupos',
          required: false,
          attributes: ['id_aprendiz_grupo', 'estado'],
          include: [
            {
              model: Group,
              as: 'grupo',
              attributes: ['id_grupo', 'numero_ficha', 'jornada', 'estado', 'fecha_inicio', 'fecha_fin', 'id_instructor_lider'],
              include: [
                {
                  model: FormativeProgram,
                  as: 'programa_formacion',
                  attributes: ['id_programa', 'nombre_programa'],
                  include: [{ model: EducationalArea, as: 'area', attributes: ['id_area', 'nombre_area'] }],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!aprendiz) throw { status: 404, message: 'Aprendiz no encontrado' };

    const activeGroups = this._getActiveGroupIdsForApprentice(aprendiz);
    if (!activeGroups.length) {
      throw { status: 403, message: 'No tienes permisos para consultar este aprendiz' };
    }

    const accessibleGroupIds = await this._getAccessibleGroupIdsForRequester(requester);
    const hasIntersection = activeGroups.some((groupId) => accessibleGroupIds.includes(Number(groupId)));

    if (!hasIntersection) {
      throw { status: 403, message: 'No tienes permisos para consultar este aprendiz' };
    }

    if (requester.rol === 'instructor') {
      const leaderGroupIds = (aprendiz.aprendiz_grupos || [])
        .filter((item) => activeGroups.includes(Number(item.grupo?.id_grupo)))
        .filter((item) => Number(item.grupo?.id_instructor_lider) === Number(requester.id_instructor))
        .map((item) => Number(item.grupo.id_grupo));

      if (leaderGroupIds.length) {
        return aprendiz;
      }

      const assignedLinks = await InstructorGroup.findAll({
        where: {
          id_instructor: requester.id_instructor,
          id_grupo: { [Op.in]: activeGroups },
          estado: 'ACTIVO',
        },
        attributes: ['id_grupo'],
      });
      const assignedGroupIds = assignedLinks.map((item) => Number(item.id_grupo));

      if (assignedGroupIds.length) {
        return this._serializeLimitedApprentice(aprendiz, assignedGroupIds);
      }
    }

    return aprendiz;
  }
}

module.exports = ApprenticeService;
