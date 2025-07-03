const mongoose = require('mongoose');

const movimientoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  inicio: { type: Date, required: true },
  fin: { type: Date, required: true },
  distanciaKm: { type: Number, required: true },
  velocidadPromedio: { type: Number, required: true },
  movimientos: [
    {
      timestamp: { type: Date, required: true },
      velocidad: { type: Number }, // km/h
      ubicacion: {
        lat: Number,
        lng: Number
      }
    }
  ],
  estado: { type: String, enum: ['en curso', 'finalizado'], default: 'en curso' }
}, { timestamps: true });

module.exports = mongoose.model('Movimiento', movimientoSchema);
