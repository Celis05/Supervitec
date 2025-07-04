const cron = require('node-cron');
const axios = require('axios');
const User = require('../models/User'); // o tu modelo donde guardas tokens
const NotificacionExpo = require('../utils/notificaciones'); //archivo que envia notificación

// Ejecutar todos los días a las 7:00 a.m.
cron.schedule('0 7 * * *', async () => {
  try {
    const usuarios = await User.find({ role: { $in: ['ingeniero', 'inspector'] } });

    for (const user of usuarios) {
      if (user.pushToken) {
        await NotificacionExpo.enviarNotificacion({
          to: user.pushToken,
          title: 'Inicio de jornada',
          body: '¿Deseas comenzar tu jornada laboral?',
          data: { tipo: 'inicio_jornada' }
        });
      }
    }

    console.log('✅ Notificaciones de las 7:00 a.m. enviadas');
  } catch (error) {
    console.error('❌ Error al enviar notificaciones:', error.message);
  }
});
