const express = require('express');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const authMiddleware = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');
const User = require('../models/User');


/**
 * @swagger
 * /users/movimientos:
 *   post:
 *     summary: Registrar un nuevo movimiento
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inicio:
 *                 type: string
 *               fin:
 *                 type: string
 *               distanciaKm:
 *                 type: number
 *               velocidadPromedio:
 *                 type: number
 *     responses:
 *       201:
 *         description: Movimiento registrado exitosamente
 *       500:
 *         description: Error del servidor
 */
router.post('/movimientos', authMiddleware, async (req, res) => {
  try {
    const { inicio, fin, distanciaKm, velocidadPromedio } = req.body;
    const nuevoMovimiento = new Movimiento({ userId: req.userId, inicio, fin, distanciaKm, velocidadPromedio });
    await nuevoMovimiento.save();
    res.status(201).json({ message: 'Movimiento registrado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar el movimiento' });
  }
});

/**
 * @swagger
 * /users/movimientos:
 *   get:
 *     summary: Obtener el historial de movimientos del usuario autenticado
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de movimientos
 *       500:
 *         description: Error al obtener movimientos
 */
router.get('/movimientos', authMiddleware, async (req, res) => {
  try {
    const movimientos = await Movimiento.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(movimientos);
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ message: 'Error al obtener los movimientos' });
  }
});

/**
 * @swagger
 * /users/movimientos/update:
 *   post:
 *     summary: Actualizar un movimiento en curso (agregar posición)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Movimiento actualizado
 *       400:
 *         description: Faltan datos
 *       404:
 *         description: No hay movimiento en curso
 */
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
    movimiento.movimientos.push({ timestamp: new Date(), velocidad, ubicacion });
    const ahora = new Date();
    const hace5Min = new Date(ahora.getTime() - 5 * 60 * 1000);
    const ultimos5min = movimiento.movimientos.filter(m => m.timestamp >= hace5Min);
    const todosQuietos = ultimos5min.length > 0 && ultimos5min.every(m => m.velocidad <= 1);
    const esDespuesDe7pm = ahora.getHours() >= 19;
    if (todosQuietos || esDespuesDe7pm) {
      movimiento.estado = 'finalizado';
      movimiento.fin = ahora;
    }
    await movimiento.save();
    res.json({
      message: todosQuietos || esDespuesDe7pm ? 'Movimiento actualizado y finalizado automáticamente' : 'Movimiento actualizado',
      estado: movimiento.estado
    });
  } catch (error) {
    console.error('Error al actualizar movimiento:', error);
    res.status(500).json({ message: 'Error al actualizar movimiento' });
  }
});

/**
 * @swagger
 * /users/movimientos/finalizar:
 *   post:
 *     summary: Finalizar manualmente un movimiento en curso
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Movimiento finalizado correctamente
 *       404:
 *         description: No hay movimiento en curso
 */
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

/**
 * @swagger
 * /users/resumen:
 *   get:
 *     summary: Obtener resumen de jornadas por fecha o región (admin)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *       - in: query
 *         name: excel
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Resumen generado
 *       403:
 *         description: Acceso denegado
 */
router.get('/resumen', authMiddleware, async (req, res) => {
  try {
    const userRole = req.userRole;
    if (userRole !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo admin' });
    }
    const { region, fecha, excel } = req.query;
    let filtro = {};
    if (fecha) {
      const inicioDia = new Date(fecha + 'T00:00:00');
      const finDia = new Date(fecha + 'T23:59:59');
      filtro.createdAt = { $gte: inicioDia, $lte: finDia };
    }
    if (region) {
      const usuarios = await User.find({ region });
      const userIds = usuarios.map(u => u._id);
      filtro.userId = { $in: userIds };
    }
    const movimientos = await Movimiento.find(filtro).populate('userId', 'name email region role');
    const resumen = movimientos.map(mov => ({
      nombre: mov.userId.name,
      email: mov.userId.email,
      role: mov.userId.role,
      region: mov.userId.region,
      fecha: mov.createdAt.toISOString().split('T')[0],
      distanciaKm: mov.distanciaKm,
      velocidadPromedio: mov.velocidadPromedio,
      estado: mov.estado
    }));
    if (excel === 'true') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Resumen de Jornadas');
      worksheet.columns = [
        { header: 'Nombre', key: 'nombre', width: 25 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Rol', key: 'role', width: 15 },
        { header: 'Región', key: 'region', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Distancia (km)', key: 'distanciaKm', width: 18 },
        { header: 'Velocidad Promedio', key: 'velocidadPromedio', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 }
      ];
      worksheet.addRows(resumen);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=resumen_jornadas.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }
    res.json({ filtrosAplicados: { region, fecha }, total: resumen.length, resumen });
  } catch (error) {
    console.error('Error en resumen:', error);
    res.status(500).json({ message: 'Error al obtener resumen' });
  }
});

/**
 * @swagger
 * /users/token:
 *   post:
 *     summary: Guardar token push del usuario autenticado
 *     tags: [Notificaciones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token guardado correctamente
 *       400:
 *         description: Token no proporcionado
 *       404:
 *         description: Usuario no encontrado
 */
router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ message: 'El pushToken es requerido' });
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    user.pushToken = pushToken;
    await user.save();
    res.json({ message: 'Token de notificación guardado correctamente ✅' });
  } catch (error) {
    console.error('Error al guardar token push:', error);
    res.status(500).json({ message: 'Error al guardar el token' });
  }
});

module.exports = router;
