const express = require('express');
const { body, validationResult, param } = require('express-validator');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const authMiddleware = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');
const User = require('../models/User');
const mongoose = require('mongoose');

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
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post(
  '/movimientos',
  authMiddleware,
  [
  body('inicio')
    .notEmpty().withMessage('El campo inicio es requerido')
    .isISO8601().withMessage('El campo inicio debe ser una fecha válida'),
  body('fin')
    .notEmpty().withMessage('El campo fin es requerido')
    .isISO8601().withMessage('El campo fin debe ser una fecha válida')
    .custom((fin, { req }) => {
      if (new Date(fin) <= new Date(req.body.inicio)) {
        throw new Error('La fecha fin debe ser mayor que la fecha de inicio');
      }
      return true;
    }),
  body('distanciaKm')
    .isNumeric().withMessage('distanciaKm debe ser numérico')
    .custom((val) => val > 0).withMessage('distanciaKm debe ser mayor que 0'),
  body('velocidadPromedio')
    .isNumeric().withMessage('velocidadPromedio debe ser numérico')
    .custom((val) => val > 0).withMessage('velocidadPromedio debe ser mayor que 0')
],

  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }

    try {
      const { inicio, fin, distanciaKm, velocidadPromedio } = req.body;
      const nuevoMovimiento = new Movimiento({
        userId: req.userId,
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
  }
);

/**
 * @swagger
 * /users/movimientos:
 *   get:
 *     summary: Obtener historial de movimientos del usuario
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de movimientos del usuario
 *       401:
 *         description: No autorizado
 */
router.get('/movimientos', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Movimiento.countDocuments({ userId: req.userId });
    const movimientos = await Movimiento.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      movimientos
    });
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
 *     requestBody:
 *       required: true
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
 *         description: Movimiento actualizado
 *       404:
 *         description: Movimiento en curso no encontrado
 */
router.post(
  '/movimientos/update',
  authMiddleware,
  [
    body('velocidad').isNumeric().withMessage('La velocidad debe ser numérica'),
    body('ubicacion.lat').isFloat().withMessage('La latitud debe ser un número'),
    body('ubicacion.lng').isFloat().withMessage('La longitud debe ser un número')
  ],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
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
      message: todosQuietos || esDespuesDe7pm
        ? 'Movimiento actualizado y finalizado automáticamente'
        : 'Movimiento actualizado',
      estado: movimiento.estado
    });

  }
);

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
 *     summary: Obtener resumen de jornadas (solo admin)
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
 *           format: date
 *       - in: query
 *         name: excel
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resumen obtenido correctamente
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = (page - 1) * limit;
    const paginatedResumen = resumen.slice(startIndex, startIndex + limit);


    res.json({
  filtrosAplicados: { region, fecha },
  total: resumen.length,
  totalPages: Math.ceil(resumen.length / limit),
  page,
  limit,
  resumen: paginatedResumen
});

  } catch (error) {
    console.error('Error en resumen:', error);
    res.status(500).json({ message: 'Error al obtener resumen' });
  }
});

/**
 * @swagger
 * /users/token:
 *   post:
 *     summary: Guardar token push del usuario
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
 *       500:
 *         description: Error al guardar el token
 */
router.post(
  '/token',
  authMiddleware,
  [body('pushToken').notEmpty().withMessage('El token es requerido')],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ message: 'Token no proporcionado' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    user.pushToken = pushToken;
    await user.save();

    res.json({ message: 'Token guardado correctamente ✅' });
  });

/**
 * @swagger
 * /users/mensual:
 *   get:
 *     summary: Obtener resumen mensual con velocidad máxima y promedio por día (solo admin)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mes
 *         schema:
 *           type: string
 *           example: "2025-07"
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Resumen mensual obtenido
 *       403:
 *         description: Acceso denegado
 */
router.get('/mensual', authMiddleware, async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({ message: 'Acceso denegado: solo admin' });
    }

    const { mes, region } = req.query;
    if (!mes) return res.status(400).json({ message: 'Debe proporcionar el mes (YYYY-MM)' });

    const fechaInicio = new Date(`${mes}-01T00:00:00`);
    const fechaFin = new Date(new Date(fechaInicio).setMonth(fechaInicio.getMonth() + 1));

    const filtro = {
      createdAt: { $gte: fechaInicio, $lt: fechaFin }
    };

    if (region) {
      const usuarios = await User.find({ region });
      const userIds = usuarios.map(u => u._id);
      filtro.userId = { $in: userIds };
    }

    const movimientos = await Movimiento.find(filtro);

    const resumenPorDia = {};

    movimientos.forEach(mov => {
      const dia = new Date(mov.createdAt).toISOString().split('T')[0];
      if (!resumenPorDia[dia]) {
        resumenPorDia[dia] = {
          fecha: dia,
          totalRecorridos: 0,
          velocidades: [],
          maximas: []
        };
      }

      resumenPorDia[dia].totalRecorridos += 1;
      if (typeof mov.velocidadPromedio === 'number') resumenPorDia[dia].velocidades.push(mov.velocidadPromedio);
      if (typeof mov.velocidadMaxima === 'number') resumenPorDia[dia].maximas.push(mov.velocidadMaxima);
    });

    const resultado = Object.values(resumenPorDia).map(dia => {
      const suma = dia.velocidades.reduce((a, b) => a + b, 0);
      const promedio = dia.velocidades.length ? parseFloat((suma / dia.velocidades.length).toFixed(2)) : 0;
      const maxima = dia.maximas.length ? Math.max(...dia.maximas) : 0;
      return {
        fecha: dia.fecha,
        totalRecorridos: dia.totalRecorridos,
        velocidadPromedioDia: promedio,
        velocidadMaximaDia: maxima
      };
    });

    res.json({ mes, region, resumen: resultado });
  } catch (error) {
    console.error('Error al obtener dashboard mensual:', error);
    res.status(500).json({ message: 'Error al obtener dashboard mensual' });
  }
});

/**
 * @swagger
 * /users/eliminar-usuario/{id}:
 *   delete:
 *     summary: Eliminar un usuario (solo admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a eliminar
 *     responses:
 *       200:
 *         description: Usuario eliminado correctamente
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete(
  '/eliminar-usuario/:id',
  authMiddleware,
  [param('id').isMongoId().withMessage('ID inválido')],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }

    try {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acceso denegado: solo admin' });
      }

      const usuario = await User.findByIdAndDelete(req.params.id);
      if (!usuario) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }

      await Movimiento.deleteMany({ userId: req.params.id }); // Borra sus movimientos también

      res.json({ message: 'Usuario y sus movimientos eliminados correctamente' });
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      res.status(500).json({ message: 'Error al eliminar usuario' });
    }
  }
);

/**
 * @swagger
 * /users/eliminar-movimiento/{id}:
 *   delete:
 *     summary: Eliminar un movimiento (admin o dueño)
 *     tags: [Movimientos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del movimiento a eliminar
 *     responses:
 *       200:
 *         description: Movimiento eliminado correctamente
 *       403:
 *         description: Acceso denegado
 *       404:
 *         description: Movimiento no encontrado
 */
router.delete(
  '/eliminar-movimiento/:id',
  authMiddleware,
  [param('id').isMongoId().withMessage('ID inválido')],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ errores: errores.array() });
    }

    try {
      const movimiento = await Movimiento.findById(req.params.id);
      if (!movimiento) {
        return res.status(404).json({ message: 'Movimiento no encontrado' });
      }

      if (req.userRole !== 'admin' && movimiento.userId.toString() !== req.userId) {
        return res.status(403).json({ message: 'Acceso denegado: no autorizado para eliminar este movimiento' });
      }

      await movimiento.deleteOne();
      res.json({ message: 'Movimiento eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar movimiento:', error);
      res.status(500).json({ message: 'Error al eliminar movimiento' });
    }
  }
);



module.exports = router;