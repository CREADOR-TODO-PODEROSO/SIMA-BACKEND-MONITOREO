require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// conexión directa
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD || process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

// modelo de roles
const Role = sequelize.define('roles', {
  id_rol: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nombre: DataTypes.STRING,
  descripcion: DataTypes.STRING,
}, { timestamps: false });

async function createRoles() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la BD');

    const roles = [
      { nombre: 'coordinador', descripcion: 'Coordinadores académicos' },
      { nombre: 'instructor', descripcion: 'Instructores' },
      { nombre: 'aprendiz', descripcion: 'Aprendices' },
    ];

    for (const rol of roles) {
      const existingRole = await Role.findOne({ where: { nombre: rol.nombre } });
      if (!existingRole) {
        await Role.create(rol);
        console.log(`✅ Rol "${rol.nombre}" creado`);
      } else {
        console.log(`⚠️ Rol "${rol.nombre}" ya existe`);
      }
    }

    console.log('✅ Todos los roles verificados/creados');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

createRoles();