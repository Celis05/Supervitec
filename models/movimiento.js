const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inicio: Date,
  fin: Date,
  distanciaKm: { type: Number, default: 0 },
  velocidadPromedio: { type: Number, default: 0 },
  velocidadMaxima: { type: Number, default: 0 },
  movimientos: [{
    timestamp: Date,
    velocidad: Number,
    ubicacion: {
      lat: Number,
      lng: Number
    }
  }],
  estado: { type: String, enum: ['activa', 'en curso', 'finalizado'], default: 'activa' }
}, { timestamps: true });


module.exports = mongoose.model('Movimiento', movimientoSchema);
