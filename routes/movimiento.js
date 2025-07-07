// routes/movimiento.js
const express = require('express');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');

/**
 * @swagger
 * tags:
 *   name: Movimientos
 *   description: Gestión de movimientos (usuarios y admin)
 */

/**
 * @swagger
 * /movimientos:
 *   post:
 *     summary: Registrar un nuevo movimiento manualmente
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
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { inicio, fin, distanciaKm, velocidadPromedio } = req.body;
    const nuevo = new Movimiento({ userId: req.userId, inicio, fin, distanciaKm, velocidadPromedio });
    await nuevo.save();
    res.status(201).json({ message: 'Movimiento registrado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar movimiento' });
  }
});

/**
 * @swagger
 * /movimientos/update:
 *   post:
 *     summary: Actualizar un movimiento en curso (agregar velocidad y ubicación)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               velocidad:
 *                 type: number
 *               ubicacion:
 *                 type: object
 *                 properties:
 *                   lat:
 *                     type: number
 *                   lng:
 *                     type: number
 *     responses:
 *       200:
 *         description: Movimiento actualizado o finalizado automáticamente
 *       400:
 *         description: Faltan datos
 *       404:
 *         description: No hay movimiento en curso
 */
router.post('/update', authMiddleware, async (req, res) => {
  try {
    const { velocidad, ubicacion } = req.body;
    if (!velocidad || !ubicacion || !ubicacion.lat || !ubicacion.lng) {
      return res.status(400).json({ message: 'Faltan datos del movimiento' });
    }

    const movimiento = await Movimiento.findOne({ userId: req.userId, estado: 'en curso' });
    if (!movimiento) return res.status(404).json({ message: 'No hay movimiento en curso' });

    movimiento.movimientos.push({ timestamp: new Date(), velocidad, ubicacion });

    // Calcular velocidad promedio y máxima
    const velocidades = movimiento.movimientos.map(m => m.velocidad);
    movimiento.velocidadPromedio = parseFloat((velocidades.reduce((a, b) => a + b, 0) / velocidades.length).toFixed(2));
    movimiento.velocidadMaxima = Math.max(...velocidades);

    // Verificar si debe finalizar automáticamente
    const ahora = new Date();
    const hace5Min = new Date(ahora.getTime() - 5 * 60 * 1000);
    const ultimos5min = movimiento.movimientos.filter(m => m.timestamp >= hace5Min);
    const todosQuietos = ultimos5min.length > 0 && ultimos5min.every(m => m.velocidad <= 1);

    if (todosQuietos || ahora.getHours() >= 19) {
      movimiento.estado = 'finalizado';
      movimiento.fin = ahora;
    }

    await movimiento.save();
    res.json({
      message: movimiento.estado === 'finalizado' ? 'Finalizado automáticamente' : 'Movimiento actualizado',
      estado: movimiento.estado
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar movimiento' });
  }
});

/**
 * @swagger
 * /movimientos/finalizar:
 *   post:
 *     summary: Finalizar manualmente un movimiento
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Finalizado correctamente
 *       404:
 *         description: No hay movimiento en curso
 */
router.post('/finalizar', authMiddleware, async (req, res) => {
  try {
    const movimiento = await Movimiento.findOne({ userId: req.userId, estado: 'en curso' });
    if (!movimiento) return res.status(404).json({ message: 'No hay movimiento en curso' });

    movimiento.estado = 'finalizado';
    movimiento.fin = new Date();
    await movimiento.save();

    res.json({ message: 'Movimiento finalizado manualmente', movimiento });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al finalizar movimiento' });
  }
});

/**
 * @swagger
 * /movimientos/token:
 *   post:
 *     summary: Guardar token push del usuario
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pushToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token guardado
 */
router.post('/token', authMiddleware, async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ message: 'Token requerido' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    user.pushToken = pushToken;
    await user.save();
    res.json({ message: 'Token guardado correctamente ✅' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar token' });
  }
});

/**
 * @swagger
 * /movimientos/resumen:
 *   get:
 *     summary: Generar resumen por región o fecha (admin)
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
 *         description: Resumen generado o archivo descargado
 *       403:
 *         description: Acceso denegado
 */
router.get('/resumen', authMiddleware, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo admin' });
    }

    const { region, fecha, excel } = req.query;
    const filtro = {};

    if (fecha) {
      const inicio = new Date(`${fecha}T00:00:00`);
      const fin = new Date(`${fecha}T23:59:59`);
      filtro.createdAt = { $gte: inicio, $lte: fin };
    }

    if (region) {
      const users = await User.find({ region });
      const ids = users.map(u => u._id);
      filtro.userId = { $in: ids };
    }

    const movimientos = await Movimiento.find(filtro).populate('userId', 'name email role region');

    const resumen = movimientos.map(m => ({
      nombre: m.userId.name,
      email: m.userId.email,
      region: m.userId.region,
      role: m.userId.role,
      fecha: m.createdAt.toISOString().split('T')[0],
      distanciaKm: m.distanciaKm,
      velocidadPromedio: m.velocidadPromedio,
      estado: m.estado
    }));

    if (excel === 'true') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Resumen');

      sheet.columns = [
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Región', key: 'region', width: 15 },
        { header: 'Rol', key: 'role', width: 10 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Distancia (km)', key: 'distanciaKm', width: 18 },
        { header: 'Velocidad Promedio', key: 'velocidadPromedio', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 }
      ];

      sheet.addRows(resumen);
      res.setHeader('Content-Disposition', 'attachment; filename=resumen_jornadas.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      await workbook.xlsx.write(res);
      return res.end();
    }

    res.json({ total: resumen.length, resumen });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al generar resumen' });
  }
});

module.exports = router;
