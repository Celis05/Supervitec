/**
 * @swagger
 * tags:
 *   name: Usuarios
 *   description: Gestión de usuarios (solo admins)
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/authMiddleware');
const ExcelJS = require('exceljs');
const Movimiento = require('../models/movimiento');

// ==================== AUTH ====================

/**
 * @swagger
 * /users/register:
 *   post:
 *     summary: Registrar un nuevo usuario (solo admin o para desarrollo inicial)
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role, region]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *               region:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, region } = req.body;

    const existe = await User.findOne({ email });
    if (existe) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashed = await bcrypt.hash(password, 10);

    const nuevoUsuario = new User({ name, email, password: hashed, role, region });
    await nuevoUsuario.save();

    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ message: 'Error al registrar usuario' });
  }
});

/**
 * @swagger
 * /users/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Usuarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso, retorna token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await User.findOne({ email });
    if (!usuario) return res.status(404).json({ message: 'Usuario no encontrado' });

    const esValido = await bcrypt.compare(password, usuario.password);
    if (!esValido) return res.status(401).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { userId: usuario._id, role: usuario.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: usuario._id, name: usuario.name, email: usuario.email, role: usuario.role } });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ message: 'Error al iniciar sesión' });
  }
});

// ==================== ADMIN: GESTIÓN USUARIOS ====================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Obtener todos los usuarios (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

    const usuarios = await User.find().select('-password');
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Editar usuario por ID (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               role:
 *                 type: string
 *               region:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

    const actualizado = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'Usuario actualizado', actualizado });
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Eliminar usuario por ID (solo admin)
 *     tags: [Usuarios]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Usuario eliminado
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    if (req.userRole !== 'admin') return res.status(403).json({ message: 'Acceso denegado' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

module.exports = router;
