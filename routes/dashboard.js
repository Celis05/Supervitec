// routes/dashboard.js
const express = require('express');
const router = express.Router();
const Movimiento = require('../models/movimiento');
const User = require('../models/User');
const ExcelJS = require('exceljs');
const authMiddleware = require('../middleware/authMiddleware');

// Middleware solo admin
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado: solo admin' });
  }
  next();
};

// ─────────────────────────────────────
// GET /api/dashboard/resumen-diario
// ─────────────────────────────────────
router.get('/resumen-diario', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { region, fecha, excel } = req.query;
    let filtro = {};

    if (fecha) {
      const inicioDia = new Date(`${fecha}T00:00:00`);
      const finDia = new Date(`${fecha}T23:59:59`);
      filtro.createdAt = { $gte: inicioDia, $lte: finDia };
    }

    if (region) {
      const usuarios = await User.find({ region });
      const ids = usuarios.map(u => u._id);
      filtro.userId = { $in: ids };
    }

    const movimientos = await Movimiento.find(filtro).populate('userId', 'name email region role');
    const resumen = movimientos.map(m => ({
      nombre: m.userId.name,
      email: m.userId.email,
      region: m.userId.region,
      role: m.userId.role,
      fecha: m.createdAt.toISOString().split('T')[0],
      distanciaKm: m.distanciaKm || 0,
      velocidadPromedio: m.velocidadPromedio || 0,
      estado: m.estado
    }));

    if (excel === 'true') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Resumen Diario');
      sheet.columns = [
        { header: 'Nombre', key: 'nombre', width: 20 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Región', key: 'region', width: 15 },
        { header: 'Rol', key: 'role', width: 15 },
        { header: 'Fecha', key: 'fecha', width: 15 },
        { header: 'Distancia (km)', key: 'distanciaKm', width: 18 },
        { header: 'Velocidad Prom.', key: 'velocidadPromedio', width: 18 },
        { header: 'Estado', key: 'estado', width: 15 }
      ];
      sheet.addRows(resumen);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=resumen_diario.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const paginated = resumen.slice((page - 1) * limit, page * limit);

    res.json({
      filtros: { region, fecha },
      total: resumen.length,
      totalPages: Math.ceil(resumen.length / limit),
      page,
      limit,
      resumen: paginated
    });

  } catch (error) {
    console.error('Error en resumen diario:', error);
    res.status(500).json({ message: 'Error al generar el resumen diario' });
  }
});

// ─────────────────────────────────────
// GET /api/dashboard/mensual
// ─────────────────────────────────────
router.get('/mensual', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { mes, region } = req.query;
    if (!mes) return res.status(400).json({ message: 'Debe proporcionar el mes en formato YYYY-MM' });

    const inicioMes = new Date(`${mes}-01T00:00:00`);
    const finMes = new Date(new Date(inicioMes).setMonth(inicioMes.getMonth() + 1));

    let filtro = { createdAt: { $gte: inicioMes, $lt: finMes } };

    if (region) {
      const usuarios = await User.find({ region });
      const ids = usuarios.map(u => u._id);
      filtro.userId = { $in: ids };
    }

    const movimientos = await Movimiento.find(filtro);

    const resumenPorDia = {};

    movimientos.forEach(mov => {
      const dia = mov.createdAt.toISOString().split('T')[0];
      if (!resumenPorDia[dia]) {
        resumenPorDia[dia] = {
          fecha: dia,
          totalRecorridos: 0,
          velocidades: [],
          maximas: []
        };
      }
      resumenPorDia[dia].totalRecorridos++;
      if (typeof mov.velocidadPromedio === 'number') resumenPorDia[dia].velocidades.push(mov.velocidadPromedio);
      if (typeof mov.velocidadMaxima === 'number') resumenPorDia[dia].maximas.push(mov.velocidadMaxima);
    });

    const resultado = Object.values(resumenPorDia).map(d => {
      const promedio = d.velocidades.length ? (d.velocidades.reduce((a, b) => a + b, 0) / d.velocidades.length).toFixed(2) : 0;
      const maxima = d.maximas.length ? Math.max(...d.maximas) : 0;
      return {
        fecha: d.fecha,
        totalRecorridos: d.totalRecorridos,
        velocidadPromedioDia: parseFloat(promedio),
        velocidadMaximaDia: parseFloat(maxima)
      };
    });

    res.json({ mes, region, resumen: resultado });

  } catch (error) {
    console.error('Error en resumen mensual:', error);
    res.status(500).json({ message: 'Error al generar el resumen mensual' });
  }
});

module.exports = router;
