const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { checkPassword, signToken } = require('../auth');

// Hash de 'admin123' — usado só no primeiro acesso, enquanto ainda não existir
// nenhum usuário "admin" cadastrado na tabela "usuarios" do Supabase.
// Assim que a clínica criar o admin de verdade lá, este hash deixa de ser usado.
const BOOTSTRAP_ADMIN_HASH = '$2b$10$SGe50RRiA6RUW1oxSfcY5.4eMNA5jn10Qv6g7AK1iba5gQg.sXvC2';

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Informe usuário e senha.' });
  const uname = String(username).trim().toLowerCase();

  try {
    const user = await dataStore.findUserByUsername(uname);
    if (user) {
      if (!checkPassword(password, user.senhaHash)) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      const token = signToken(user);
      return res.json({ token, user: { username: user.username, nome: user.nome, role: user.role, profissionalId: user.profissionalId } });
    }
    if (uname === 'admin' && checkPassword(password, BOOTSTRAP_ADMIN_HASH)) {
      const bootstrapUser = { username: 'admin', nome: 'Administrador(a)', role: 'admin', profissionalId: null };
      return res.json({ token: signToken(bootstrapUser), user: bootstrapUser });
    }
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  } catch (e) {
    res.status(502).json({ error: e.message || 'Não foi possível acessar o banco de dados (Supabase).' });
  }
});

module.exports = router;
