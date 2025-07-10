const cron = require('node-cron');
const User = require('../models/User');
const NotificacionExpo = require('../utils/notificaciones');

// Ejecutar a las 7:00 a.m. todos los días (hora de Bogotá)
cron.schedule('0 7 * * *', async () => {
  try {
    console.log('📢 Enviando notificaciones de las 7:00 a.m. a usuarios...');

    // Filtrar usuarios que sean ingenieros o inspectores
    const usuarios = await User.find({ role: { $in: ['ingeniero', 'inspector'] } });

    for (const user of usuarios) {
      if (user.pushToken && user.pushToken.startsWith('ExponentPushToken')) {
        await NotificacionExpo.enviarNotificacion({
          to: user.pushToken,
          title: 'Inicio de jornada',
          body: '¿Deseas comenzar tu jornada laboral?',
          data: { tipo: 'inicio_jornada' }
        });
      } else {
        console.log(`ℹ️ Usuario ${user.email} no tiene un pushToken válido`);
      }
    }

    console.log('✅ Notificaciones de las 7:00 a.m. enviadas correctamente');
  } catch (error) {
    console.error('❌ Error al enviar notificaciones:', error.message);
  }
}, {
  timezone: 'America/Bogota'
});
