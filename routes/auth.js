const express = require('express');
const router = express.Router(); 
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const authMiddleware = require('../middleware/authMiddleware');
const { registerUser, loginUser }= require('../controllers/authController');
const Movimiento = require('../models/movimiento');




/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ingeniero, inspector]
 *               transporte:
 *                 type: string
 *               region:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente
 *       400:
 *         description: Error en los datos de entrada
 */



router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('El nombre es obligatorio'),
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
    body('role').isIn(['ingeniero', 'inspector']).withMessage('Rol inválido'),
    body('region').isIn(['Caldas', 'Quindio', 'Risaralda']).withMessage('Región inválida'),
    body('transporte').isIn(['carro', 'moto']).withMessage('Transporte inválido')
  ],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

    const { name, email, password, role, region, transporte } = req.body;

    try {
      const existe = await User.findOne({ email });
      if (existe) return res.status(400).json({ message: 'Ya existe un usuario con ese correo' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const nuevoUsuario = new User({ name, email, password: hashedPassword, role, region, transporte });
      await nuevoUsuario.save();

      res.status(201).json({ message: 'Usuario registrado exitosamente ✅' });
    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({ message: 'Error al registrar usuario' });
    }
  }
);


// Ruta protegida para obtener el usuario autenticado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ usuario: req.usuario });
  } catch (error) {
    console.error('Error al devolver usuario:', error.message);
    res.status(500).json({ message: 'Error del servidor' });
  }
});


/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Autenticación exitosa, se retorna el token
 *       401:
 *         description: Credenciales inválidas
 */

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Correo inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida')
  ],
  async (req, res) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) return res.status(400).json({ errores: errores.array() });

    const { email, password } = req.body;

    try {
      const usuario = await User.findOne({ email });
      if (!usuario) return res.status(400).json({ message: 'Credenciales inválidas' });

      const valido = await bcrypt.compare(password, usuario.password);
      if (!valido) return res.status(400).json({ message: 'Contraseña incorrecta' });

      const token = jwt.sign(
        { userId: usuario._id, role: usuario.role },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({ token, usuario: { id: usuario._id, name: usuario.name, role: usuario.role, region: usuario.region } });
    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ message: 'Error en autenticación' });
    }
  }
);



module.exports = router;
