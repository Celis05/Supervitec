module.exports = (req, res, next) => {
  if (req.usuario && req.usuario.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ message: 'Acceso denegado. Solo el administrador puede realizar esta acción.' });
  }
};
