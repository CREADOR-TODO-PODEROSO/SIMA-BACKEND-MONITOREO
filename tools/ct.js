require('dotenv').config();
const bcrypt = require('bcrypt');
const { Sequelize, DataTypes } = require('sequelize');

// conexión directa (no dependes de tu app)
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

// modelos mínimos (solo lo necesario)
const Role = sequelize.define('roles', {
  id_rol: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  nombre: DataTypes.STRING,
  descripcion: DataTypes.STRING,
}, { timestamps: false });

const User = sequelize.define('usuarios', {
  id_usuario: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  email: DataTypes.STRING,
  password: DataTypes.STRING,
  id_rol: DataTypes.BIGINT,
  estado: DataTypes.STRING,
}, { timestamps: false });

const Person = sequelize.define('personas', {
  id_persona: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  id_usuario: DataTypes.BIGINT,
  tipo_documento: DataTypes.STRING,
  numero_documento: DataTypes.STRING,
  nombres: DataTypes.STRING,
  apellidos: DataTypes.STRING,
  telefono: DataTypes.STRING,
}, { timestamps: false });

async function createCoordinator() {
  try {
    await sequelize.authenticate();
    console.log('Conectado a la BD');

    const email = 'cordinador@gmail.com';
    const numero_documento = '1010139217';
    const passwordPlano = '1010139217';

    // buscar rol coordinador
    const role = await Role.findOne({
      where: { nombre: 'coordinador' },
    });

    if (!role) {
      console.log('❌ No existe el rol "coordinador". Créalo primero.');
      return;
    }

    // validar usuario existente
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      console.log('⚠️ El usuario ya existe');
      return;
    }

    // validar documento existente
    const existingPerson = await Person.findOne({
      where: { numero_documento },
    });

    if (existingPerson) {
      console.log('⚠️ Ya existe una persona con ese documento');
      return;
    }

    // generar hash
    const hashedPassword = await bcrypt.hash(passwordPlano, 10);

    // crear usuario
    const user = await User.create({
      email,
      password: hashedPassword,
      id_rol: role.id_rol,
      estado: 'ACTIVO',
    });

    // crear persona
    await Person.create({
      id_usuario: user.id_usuario,
      tipo_documento: 'CC',
      numero_documento,
      nombres: 'jorge',
      apellidos: 'molina',
      telefono: '909909090',
    });

    console.log('✅ Coordinador creado correctamente');
    console.log('📧 Email:', email);
    console.log('🔑 Password:', passwordPlano);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

createCoordinator();