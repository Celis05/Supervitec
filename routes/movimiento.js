const express = require('express');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');
const soloAdmin = require('../middleware/soloAdmin');


/**
 * @swagger
 * tags:
 *   name: Movimientos
 *   description: Gestión de movimientos (usuarios y admin)
 */

router.post('/iniciar', authMiddleware, async (req, res) => {
  try {
    const jornadaActiva = await Movimiento.findOne({ userId: req.usuario._id, estado: 'activa' });

    if (jornadaActiva) {
      return res.status(400).json({ message: 'Ya tienes una jornada activa' });
    }

    const nueva = new Movimiento({
      userId: req.usuario._id,
      inicio: new Date(),
      estado: 'activa',
      movimientos: [],
    });

    await nueva.save();
    res.status(201).json({ message: 'Jornada iniciada ✅', movimiento: nueva });
  } catch (error) {
    console.error('Error al iniciar jornada:', error);
    res.status(500).json({ message: 'Error al iniciar jornada' });
  }
});

router.post('/agregar', authMiddleware, async (req, res) => {
  const { lat, lng, velocidad } = req.body;

  if (!lat || !lng || typeof velocidad === 'undefined') {
    return res.status(400).json({ message: 'Datos incompletos: lat, lng y velocidad son obligatorios' });
  }

  try {
    const jornada = await Movimiento.findOne({ userId: req.usuario._id, estado: 'activa' });

    if (!jornada) {
      return res.status(404).json({ message: 'No tienes una jornada activa actualmente' });
    }

    const nuevoMovimiento = {
      timestamp: new Date(),
      lat,
      lng,
      velocidad,
    };

    jornada.movimientos.push(nuevoMovimiento);
    await jornada.save();

    res.status(200).json({ message: 'Movimiento registrado ✅', movimiento: nuevoMovimiento });
  } catch (error) {
    console.error('Error al agregar movimiento:', error);
    res.status(500).json({ message: 'Error al registrar el movimiento' });
  }
});

router.delete('/movimientos/:id', authMiddleware, soloAdmin, async (req, res) => {
  try {
    const eliminado = await Movimiento.findByIdAndDelete(req.params.id);
    if (!eliminado) return res.status(404).json({ message: 'Movimiento no encontrado' });
    res.json({ message: 'Movimiento eliminado correctamente' });
  } catch (err) {
    console.error('Error al eliminar movimiento:', err);
    res.status(500).json({ message: 'Error al eliminar movimiento' });
  }
});


router.post('/finalizar', authMiddleware, async (req, res) => {
  try {
    const jornada = await Movimiento.findOne({ userId: req.usuario._id, estado: 'activa' });

    if (!jornada) {
      return res.status(404).json({ message: 'No hay jornada activa para finalizar' });
    }

    const ahora = new Date();
    jornada.fin = ahora;
    jornada.estado = 'finalizada';

    // Cálculo de distancia total y velocidades
    let distanciaTotal = 0;
    let sumaVelocidades = 0;
    let maximaVelocidad = 0;

    const movimientos = jornada.movimientos;

    for (let i = 0; i < movimientos.length - 1; i++) {
      const a = movimientos[i];
      const b = movimientos[i + 1];

      const rad = x => (x * Math.PI) / 180;
      const R = 6371; // radio de la Tierra en km
      const dLat = rad(b.lat - a.lat);
      const dLon = rad(b.lng - a.lng);
      const lat1 = rad(a.lat);
      const lat2 = rad(b.lat);

      const aCalc = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));
      const d = R * c;

      distanciaTotal += d;
    }

    movimientos.forEach(m => {
      sumaVelocidades += m.velocidad;
      if (m.velocidad > maximaVelocidad) {
        maximaVelocidad = m.velocidad;
      }
    });

    jornada.distanciaKm = distanciaTotal.toFixed(2);
    jornada.velocidadPromedio = movimientos.length ? (sumaVelocidades / movimientos.length).toFixed(2) : 0;
    jornada.velocidadMaxima = maximaVelocidad;

    await jornada.save();

    res.status(200).json({
      message: 'Jornada finalizada correctamente ✅',
      resumen: {
        duracionHoras: ((jornada.fin - jornada.inicio) / (1000 * 60 * 60)).toFixed(2),
        distanciaKm: jornada.distanciaKm,
        velocidadPromedio: jornada.velocidadPromedio,
        velocidadMaxima: jornada.velocidadMaxima
      }
    });
  } catch (error) {
    console.error('Error al finalizar jornada:', error);
    res.status(500).json({ message: 'Error al finalizar la jornada' });
  }
});

router.get('/mis', authMiddleware, async (req, res) => {
  try {
    const jornadas = await Movimiento.find({ userId: req.usuario._id }).sort({ inicio: -1 });
    
    res.status(200).json({
      total: jornadas.length,
      jornadas,
    });
  } catch (error) {
    console.error('Error al obtener mis jornadas:', error);
    res.status(500).json({ message: 'Error al obtener los movimientos del usuario' });
  }
});

// GET /api/movimientos/historial
router.get('/historial', authMiddleware, async (req, res) => {
  const { fecha, region, role } = req.query;

  if (!fecha) {
    return res.status(400).json({ message: 'Debe proporcionar una fecha en formato YYYY-MM-DD' });
  }

  try {
    const fechaInicio = new Date(`${fecha}T00:00:00.000Z`);
    const fechaFin = new Date(`${fecha}T23:59:59.999Z`);

    let userIds = [req.usuario._id]; // Por defecto solo el usuario autenticado

    // Si el usuario es admin, puede filtrar otros
    if (req.usuario.role === 'admin') {
      const filtros = {};

      if (region) filtros.region = region;
      if (role) filtros.role = role;

      const usuarios = await User.find(filtros).select('_id');
      userIds = usuarios.map(u => u._id);
    }

    const historial = await Movimiento.find({
      userId: { $in: userIds },
      createdAt: { $gte: fechaInicio, $lte: fechaFin }
    }).sort({ createdAt: 1 });

    res.json({ historial });
  } catch (error) {
    console.error('❌ Error al consultar historial:', error);
    res.status(500).json({ message: 'Error al consultar el historial' });
  }
});


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

router.get('/resumen', authMiddleware, async (req, res) => {
  const { fecha, region, role } = req.query;

  if (!fecha) {
    return res.status(400).json({ message: 'La fecha es requerida en formato YYYY-MM-DD' });
  }

  try {
    const fechaInicio = new Date(`${fecha}T00:00:00.000Z`);
    const fechaFin = new Date(`${fecha}T23:59:59.999Z`);

    let filtrosUsuarios = {};
    if (req.usuario.role === 'admin') {
      if (region) filtrosUsuarios.region = region;
      if (role) filtrosUsuarios.role = role;
    } else {
      filtrosUsuarios._id = req.usuario._id;
    }

    const usuarios = await User.find(filtrosUsuarios).select('_id name email role region');

    const resumen = [];

    for (const usuario of usuarios) {
      const movimientos = await Movimiento.find({
        userId: usuario._id,
        createdAt: { $gte: fechaInicio, $lte: fechaFin }
      }).sort({ createdAt: 1 });

      if (movimientos.length === 0) continue;

      const totalDistancia = movimientos.reduce((acc, m) => acc + (m.distanciaKm || 0), 0);
      const promedioVelocidad = movimientos.reduce((acc, m) => acc + (m.velocidadPromedio || 0), 0) / movimientos.length;

      resumen.push({
        nombre: usuario.name,
        email: usuario.email,
        rol: usuario.role,
        region: usuario.region,
        cantidadMovimientos: movimientos.length,
        horaInicio: movimientos[0].createdAt,
        horaFin: movimientos[movimientos.length - 1].createdAt,
        distanciaTotalKm: totalDistancia.toFixed(2),
        velocidadPromedioKmH: promedioVelocidad.toFixed(2),
      });
    }

    res.json({ fecha, filtros: { region, role }, resumen });
  } catch (error) {
    console.error('❌ Error al generar resumen:', error);
    res.status(500).json({ message: 'Error al generar el resumen' });
  }
});


module.exports = router;
