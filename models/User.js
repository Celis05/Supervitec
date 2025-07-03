const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['ingeniero', 'inspector'], required: true },
  transporte: { type: String, enum: ['moto', 'carro'], required: true },
  region: { type: String, enum: ['Risaralda', 'Caldas', 'Quindío'], required: true },
});

module.exports = mongoose.model('User', userSchema);
