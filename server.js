require('dotenv').config();
require('./utils/notificaciones');
require('./tasks/enviarNotificaciones');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');

const movimientoRoutes = require('./routes/movimiento');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');

const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const User = require('./models/User');

// Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

// ───── Seguridad ─────
app.use(helmet());
app.use(cors({ origin: 'http://localhost:5000', credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ───── Logs y límite de peticiones ─────
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Demasiadas peticiones desde esta IP, intenta de nuevo más tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ───── Rutas ─────
app.get('/', (req, res) => res.send('API de Supervitec funcionando ✅'));
app.get('/api', (req, res) => res.send('API de Supervitec funcionando ✅'));


app.use('/api/users', userRoutes);
app.use('/api/movimientos', movimientoRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);

// ───── Documentación Swagger ─────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ───── Middleware de errores ─────
app.use(errorHandler);

// ───── Cron 7:00 AM ─────
cron.schedule('0 7 * * *', () => {
  console.log('📢 Notificación automática: ¡Hora de iniciar jornada!');
}, { timezone: 'America/Bogota' });

// ───── Crear Admin por defecto ─────
const crearAdmin = async () => {
  try {
    const existeAdmin = await User.findOne({ email: 'celisariasjuan@gmail.com' });
    if (!existeAdmin) {
      const hashedPassword = await bcrypt.hash('supervitec_123', 10);
      const admin = new User({
        name: 'Administrador',
        email: 'celisariasjuan@gmail.com',
        password: hashedPassword,
        role: 'admin',
        transporte: 'carro',
        region: 'Caldas'
      });
      await admin.save();
      console.log('✅ Usuario admin creado automáticamente');
    } else {
      console.log('ℹ️ Admin ya existente');
    }
  } catch (err) {
    console.error('❌ Error al crear admin:', err.message);
  }
};

// ───── Conexión y arranque ─────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('✅ Conectado a MongoDB');
    await crearAdmin();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📘 Swagger disponible en http://localhost:${PORT}/api-docs`);
    });
  })
  .catch((err) => {
    console.error('❌ Error al conectar a MongoDB:', err.message);
  });
