const axios = require('axios');

const enviarNotificacion = async ({ to, title, body, data }) => {
  await axios.post('https://exp.host/--/api/v2/push/send', {
    to,
    title,
    body,
    data
  }, {
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json'
    }
  });
};

module.exports = { enviarNotificacion };
