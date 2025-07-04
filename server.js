require('dotenv').config();
require('./utils/notificaciones'); // se ejecuta y programa la tarea
require('./tasks/enviarNotificaciones');

// ───── Dependencias ─────
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 peticiones por IP
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});


// ───── Rutas ─────
const logger = require('../utils/logger');

try {
  
} catch (error) {
  logger.error('Error al procesar movimiento:', error);
  return res.status(500).json({ message: 'Error interno' });
}

const { swaggerUi, swaggerSpec } = require('./docs/swagger');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger'); // Ajusta ruta según tu estructura
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const User = require('./models/User');


// Logs HTTP con morgan y redirigir a winston
app.use(morgan('combined', {
  stream: {
    write: message => logger.info(message.trim())
  }
}));

app.use(limiter); // aplica globalmente a todas las rutas

const app = express();

// Seguridad con Helmet
app.use(helmet());

// Habilitar CORS (ajusta origen según sea necesario)
app.use(cors({
  origin: 'http://localhost:5000', // o tu dominio de frontend
  credentials: true
}));

// Limitar tamaño del body (previene ataques tipo payload grande)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use('/api/users', require('./routes/usersRoutes'));
// Otros middlewares y rutas...

// Logs HTTP con morgan y redirigir a winston
app.use(morgan('combined', {
  stream: {
    write: message => logger.info(message.trim())
  }
}));

// ───── Middlewares ─────
app.use(cors());
app.use(express.json());


// ───── Rutas ─────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// ───── Crear Admin si no existe ─────
const crearAdmin = async () => {
  try {
    const existeAdmin = await User.findOne({ email: 'admin@miapp.com' });

    if (!existeAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);

      const admin = new User({
        name: 'Administrador',
        email: 'admin@miapp.com',
        password: hashedPassword,
        role: 'admin',
        transporte: 'carro',
        region: 'Risaralda'
      });

      await admin.save();
      console.log('✅ Usuario admin creado correctamente');
    } else {
      console.log('⚠️ Ya existe un usuario admin');
    }
  } catch (error) {
    console.error('❌ Error al crear el admin:', error.message);
  }
};

const cron = require('node-cron');

// Cron job que se ejecuta todos los días a las 7:00 a.m.
cron.schedule('0 7 * * *', () => {
  console.log('📢 Notificación 7:00 a.m. - Es hora de iniciar la jornada');
}, {
  timezone: 'America/Bogota'
  });

// ───── Conexión a MongoDB y arranque del servidor ─────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB');
    await crearAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
  });

  
module.exports = app;