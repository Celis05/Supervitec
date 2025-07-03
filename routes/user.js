const express = require('express');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const authMiddleware = require('../middleware/authMiddleware');

// Ruta de prueba
router.get('/', (req, res) => {
  res.json({ message: 'Ruta /api/users funcionando correctamente ✅' });
});

// Ruta protegida para registrar un movimiento
router.post('/movimientos', authMiddleware, async (req, res) => {
  try {
    const { inicio, fin, distanciaKm, velocidadPromedio } = req.body;

    const nuevoMovimiento = new Movimiento({
      userId: req.userId, // viene del token JWT decodificado
      inicio,
      fin,
      distanciaKm,
      velocidadPromedio
    });

    await nuevoMovimiento.save();
    res.status(201).json({ message: 'Movimiento registrado exitosamente' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el movimiento' });
  }
});
// 🆕 Ruta protegida para obtener historial de movimientos del usuario
router.get('/movimientos', authMiddleware, async (req, res) => {
  try {
    const movimientos = await Movimiento.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ message: 'Error al obtener los movimientos' });
  }
});
// 🆕 Ruta para actualizar un movimiento en curso (agregar posición)
router.post('/movimientos/update', authMiddleware, async (req, res) => {
  try {
    const { velocidad, ubicacion } = req.body;

    if (velocidad === undefined || !ubicacion || ubicacion.lat === undefined || ubicacion.lng === undefined) {
  return res.status(400).json({ message: 'Faltan datos del movimiento' });
}


    const movimiento = await Movimiento.findOne({ userId: req.userId, estado: 'en curso' });

    if (!movimiento) {
      return res.status(404).json({ message: 'No hay movimiento en curso' });
    }

    // Agrega la nueva posición
    movimiento.movimientos.push({
      timestamp: new Date(),
      velocidad,
      ubicacion
    });

    // Verifica si ha estado quieto por más de 5 min
    const ahora = new Date();
    const hace5Min = new Date(ahora.getTime() - 5 * 60 * 1000);
    const ultimos5min = movimiento.movimientos.filter(m => m.timestamp >= hace5Min);
    const todosQuietos = ultimos5min.length > 0 && ultimos5min.every(m => m.velocidad <= 1);

    // Verifica si ya pasaron las 7:00 p.m.
    const esDespuesDe7pm = ahora.getHours() >= 19;

    if (todosQuietos || esDespuesDe7pm) {
      movimiento.estado = 'finalizado';
      movimiento.fin = ahora;
    }

    await movimiento.save();

    res.json({
      message: todosQuietos || esDespuesDe7pm
        ? 'Movimiento actualizado y finalizado automáticamente'
        : 'Movimiento actualizado',
      estado: movimiento.estado
    });

  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ message: 'Error al actualizar movimiento' });
  }
});

// 🆕 Ruta para finalizar manualmente un movimiento en curso
router.post('/movimientos/finalizar', authMiddleware, async (req, res) => {
  try {
    const movimiento = await Movimiento.findOne({ userId: req.userId, estado: 'en curso' });

    if (!movimiento) {
      return res.status(404).json({ message: 'No hay movimiento en curso para finalizar' });
    }

    movimiento.estado = 'finalizado';
    movimiento.fin = new Date();

    await movimiento.save();

    res.json({ message: 'Movimiento finalizado manualmente', movimiento });
  } catch (error) {
    console.error('Error al finalizar movimiento:', error);
    res.status(500).json({ message: 'Error al finalizar movimiento' });
  }
});




module.exports = router;
