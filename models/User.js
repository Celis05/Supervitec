const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ingeniero', 'inspector', 'admin'], required: true },
  transporte: { type: String, enum: ['moto', 'carro'], required: true },
  region: { type: String, enum: ['Risaralda', 'Caldas', 'Quindío'], required: true },
  pushToken: { type: String } // 🆕 Aquí se guarda el token de Expo
});

module.exports = mongoose.model('User', userSchema);
