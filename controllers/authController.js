const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Registro
const register = async (req, res) => {
  console.log("Datos recibidos en el body:", req.body); // 👈 Agregado

  const { name, email, password, role, transporte, region } = req.body;

  if (!name || !email || !password || !role || !transporte || !region) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }


  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'El usuario ya existe' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      transporte,
      region
    });

    await newUser.save();
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    console.error('❌ Error detallado en el registro:', error.message, error.stack);
    res.status(500).json({ message: 'Error al registrar el usuario' });
  }
};

// Login (igual al que ya tenías)
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Credenciales incorrectas' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Credenciales incorrectas' });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
  console.error('Error en el registro:', error.message);  // 👈 este es importante
  res.status(500).json({ message: 'Error al registrar el usuario' });
} 
};

module.exports = {
  registerUser: register,
  loginUser: login
};
