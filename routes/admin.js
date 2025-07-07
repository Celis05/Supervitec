// routes/admin.js
const express = require('express');
const { param, validationResult } = require('express-validator');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const Movimiento = require('../models/movimiento');

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

module.exports = router;
