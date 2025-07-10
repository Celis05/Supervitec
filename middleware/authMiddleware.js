const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware para verificar y autenticar el token JWT.
 * Agrega el usuario autenticado a `req.usuario`.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.header('Authorization');

  // Validar cabecera de autorización
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado o mal formado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscar al usuario autenticado
    const usuarioEncontrado = await User.findById(decoded.userId).select('-password');

    if (!usuarioEncontrado) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Agregar datos del usuario a la petición
    req.usuario = usuarioEncontrado;
    req.userId = usuarioEncontrado._id;
    req.userRole = usuarioEncontrado.role;

    next(); // Continuar con la siguiente función o ruta protegida
  } catch (err) {
    console.error('❌ Error al verificar el token:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'El token ha expirado' });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Token inválido' });
    }

    return res.status(401).json({ message: 'Error de autenticación con token' });
  }
};

module.exports = authMiddleware;
