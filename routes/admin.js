const express = require('express');
const { param, validationResult } = require('express-validator');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Movimiento = require('../models/movimiento');

// Middleware solo para admin
const soloAdmin = (req, res, next) => {
  if (req.usuario.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso solo permitido para administradores' });
  }
  next();
};

// Obtener usuarios filtrados por rol o región
router.get('/usuarios', authMiddleware, soloAdmin, async (req, res) => {
  const { region, rol } = req.query;

  const filtro = {};
  if (region) filtro.region = region;
  if (rol) filtro.role = rol;

  try {
    const usuarios = await User.find(filtro).select('-password');
    res.json({ total: usuarios.length, usuarios });
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

/**
 * @swagger
 * /api/admin/eliminar-usuario/{id}:
 *   delete:
 *     summary: Eliminar un usuario y sus movimientos (solo admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete('/eliminar-usuario/:id',
  authMiddleware,
  [param('id').isMongoId().withMessage('ID inválido')],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo admin' });
    }

    try {
      const usuario = await User.findByIdAndDelete(req.params.id);
      if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

      await Movimiento.deleteMany({ userId: req.params.id });

      res.json({ message: 'Usuario y sus movimientos eliminados correctamente' });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({ message: 'Error interno al eliminar usuario' });
    }
  }
);

/**
 * @swagger
 * /api/admin/eliminar-movimiento/{id}:
 *   delete:
 *     summary: Eliminar un movimiento específico (admin o dueño)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del movimiento
 *     responses:
 *       200:
 *         description: Movimiento eliminado correctamente
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Movimiento no encontrado
 */
router.delete('/eliminar-movimiento/:id',
  authMiddleware,
  [param('id').isMongoId().withMessage('ID inválido')],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

    try {
      const movimiento = await Movimiento.findById(req.params.id);
      if (!movimiento) return res.status(404).json({ message: 'Movimiento no encontrado' });

      if (req.userRole !== 'admin' && movimiento.userId.toString() !== req.userId) {
        return res.status(403).json({ message: 'No autorizado para eliminar este movimiento' });
      }

      await movimiento.deleteOne();
      res.json({ message: 'Movimiento eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      res.status(500).json({ message: 'Error interno al eliminar movimiento' });
    }
  }
);

// Reporte mensual por día
router.get('/reportes/mensual', authMiddleware, soloAdmin, async (req, res) => {
  const { mes, anio } = req.query;

  if (!mes || !anio) {
    return res.status(400).json({ message: 'Debe especificar mes y año en la consulta' });
  }

  try {
    const inicio = new Date(anio, mes - 1, 1);
    const fin = new Date(anio, mes, 0, 23, 59, 59); // último día del mes

    const movimientos = await Movimiento.find({
      createdAt: { $gte: inicio, $lte: fin }
    });

    const resumenPorDia = {};

    movimientos.forEach((mov) => {
      const dia = new Date(mov.createdAt).toISOString().split('T')[0];

      if (!resumenPorDia[dia]) {
        resumenPorDia[dia] = {
          cantidad: 0,
          sumaVelocidades: 0,
          maxVelocidad: 0,
        };
      }

      resumenPorDia[dia].cantidad += 1;
      resumenPorDia[dia].sumaVelocidades += mov.velocidadPromedio || 0;
      if ((mov.velocidadMaxima || 0) > resumenPorDia[dia].maxVelocidad) {
        resumenPorDia[dia].maxVelocidad = mov.velocidadMaxima || 0;
      }
    });

    const resultado = Object.entries(resumenPorDia).map(([fecha, data]) => ({
      fecha,
      cantidadRecorridos: data.cantidad,
      velocidadPromedio: (data.sumaVelocidades / data.cantidad).toFixed(2),
      velocidadMaxima: data.maxVelocidad.toFixed(2),
    }));

    res.json({ totalDias: resultado.length, resumen: resultado });
  } catch (error) {
    console.error('Error al generar reporte mensual:', error);
    res.status(500).json({ message: 'Error al generar reporte mensual' });
  }
});


module.exports = router;
