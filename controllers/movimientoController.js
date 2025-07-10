const Movimiento = require('../models/movimiento');
const User = require('../models/User');

// ──────────────── INICIAR JORNADA SI APLICA ────────────────
const iniciarJornadaSiAplica = async (req, res) => {
  try {
    const { velocidad, ubicacion } = req.body;
    if (velocidad <= 10) {
      return res.status(400).json({ mensaje: 'Esperando a qué empieces' });
    }

    const yaActiva = await Movimiento.findOne({ userId: req.userId, estado: 'activa' });
    if (yaActiva) {
      return res.status(200).json({ mensaje: 'Has empezado tu jornaada' });
    }

    const nueva = new Movimiento({
      userId: req.userId,
      inicio: new Date(),
      movimientos: [{ timestamp: new Date(), velocidad, ubicacion }],
      estado: 'activa'
    });

    await nueva.save();
    res.status(201).json({ mensaje: 'Jornada iniciada automáticamente.', jornada: nueva });
  } catch (error) {
    console.error('Error al iniciar jornada:', error);
    res.status(500).json({ mensaje: 'Error interno al iniciar jornada.' });
  }
};

// ──────────────── CALCULAR DISTANCIA ENTRE DOS PUNTOS ────────────────
const calcularDistancia = (lat1, lon1, lat2, lon2) => {
  const Rm = 3959;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c & Rm * c; 
};

// ──────────────── REGISTRAR MOVIMIENTO EN CURSO ────────────────
const registrarMovimiento = async (req, res) => {
  try {
    const { velocidad, ubicacion } = req.body;
    const jornada = await Movimiento.findOne({ userId: req.userId, estado: 'activa' });
    if (!jornada) return res.status(400).json({ mensaje: 'No hay una jornada activa.' });

    const nuevoMovimiento = { timestamp: new Date(), velocidad, ubicacion };
    jornada.movimientos.push(nuevoMovimiento);

    if (jornada.movimientos.length > 1) {
      const prev = jornada.movimientos.at(-2).ubicacion;
      const curr = ubicacion;
      const distancia = calcularDistancia(prev.lat, prev.lng, curr.lat, curr.lng);
      jornada.distanciaKm += distancia;
    }

    const totalVel = jornada.movimientos.reduce((acc, m) => acc + m.velocidad, 0);
    jornada.velocidadPromedio = parseFloat((totalVel / jornada.movimientos.length).toFixed(2));
    jornada.velocidadMaxima = Math.max(jornada.velocidadMaxima || 0, velocidad);

    await jornada.save();
    res.status(200).json({ mensaje: 'Movimiento registrado.', jornada });
  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ mensaje: 'Error interno al registrar movimiento.' });
  }
};

// ──────────────── GUARDAR TOKEN PUSH ────────────────
const guardarPushToken = async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

    user.pushToken = req.body.pushToken;
    await user.save();

    res.json({ message: 'Token guardado correctamente ✅' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al guardar token' });
  }
};

// ──────────────── HISTORIAL DE MOVIMIENTOS ────────────────
const historialMovimientos = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await Movimiento.countDocuments({ userId: req.userId });
    const movimientos = await Movimiento.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ page, limit, total, totalPages: Math.ceil(total / limit), movimientos });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    res.status(500).json({ message: 'Error al obtener movimientos' });
  }
};

// ──────────────── REGISTRO MANUAL (INICIO-FIN) ────────────────
const registrarMovimientoManual = async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

  try {
    const { inicio, fin, distanciaKm, velocidadPromedio } = req.body;
    const nuevo = new Movimiento({ userId: req.userId, inicio, fin, distanciaKm, velocidadPromedio });
    await nuevo.save();
    res.status(201).json({ message: 'Movimiento registrado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al registrar movimiento' });
  }
};

// ──────────────── ACTUALIZAR EN CURSO ────────────────
const actualizarMovimiento = async (req, res) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

  try {
    const movimiento = await Movimiento.findOne({ userId: req.userId, estado: 'en curso' });
    if (!movimiento) return res.status(404).json({ message: 'No hay movimiento en curso' });

    const { velocidad, ubicacion } = req.body;
    movimiento.movimientos.push({ timestamp: new Date(), velocidad, ubicacion });

    const velocidades = movimiento.movimientos.map(m => m.velocidad);
    movimiento.velocidadPromedio = parseFloat((velocidades.reduce((a, b) => a + b, 0) / velocidades.length).toFixed(2));
    movimiento.velocidadMaxima = Math.max(...velocidades);

    const ahora = new Date();
    const hace5Min = new Date(ahora.getTime() - 5 * 60 * 1000);
    const ultimos5 = movimiento.movimientos.filter(m => m.timestamp >= hace5Min);
    const todosQuietos = ultimos5.length > 0 && ultimos5.every(m => m.velocidad <= 1);

    if (todosQuietos || ahora.getHours() >= 19) {
      movimiento.estado = 'finalizado';
      movimiento.fin = ahora;
    }

    await movimiento.save();
    res.json({ message: movimiento.estado === 'finalizado' ? 'Finalizado automáticamente' : 'Actualizado', estado: movimiento.estado });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al actualizar movimiento' });
  }
};

// ──────────────── FINALIZAR MANUAL ────────────────
const finalizarJornadaManual = async (req, res) => {
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
};

module.exports = {
  iniciarJornadaSiAplica,
  calcularDistancia,
  registrarMovimiento,
  guardarPushToken,
  historialMovimientos,
  registrarMovimientoManual,
  actualizarMovimiento,
  finalizarJornadaManual
};
