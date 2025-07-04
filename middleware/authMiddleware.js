const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const authHeader = req.header('Authorization');

  // Validar existencia y formato del header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado o mal formado.' });
  }

  const token = authHeader.split(' ')[1]; // Extraemos el token después de "Bearer"

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
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
