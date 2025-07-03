const express = require('express');
const router = express.Router();
const {
  registrarMovimiento,
  finalizarMovimiento,
  obtenerHistorial
} = require('../controllers/movimientoController');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/registrar', verifyToken, registrarMovimiento);
router.post('/finalizar', verifyToken, finalizarMovimiento);
router.get('/historial', verifyToken, obtenerHistorial);

module.exports = router;
