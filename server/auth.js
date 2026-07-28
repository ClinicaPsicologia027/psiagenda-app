const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-no-.env';

function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10);
}
function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}
function signToken(user) {
  return jwt.sign(
    { username: user.username, role: user.role, nome: user.nome, profissionalId: user.profissionalId || null },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Sem permissão para esta ação.' });
    next();
  };
}

module.exports = { hashPassword, checkPassword, signToken, authenticate, requireRole };
