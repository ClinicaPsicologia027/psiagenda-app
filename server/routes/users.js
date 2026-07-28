const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { authenticate, requireRole, hashPassword } = require('../auth');

router.use(authenticate, requireRole('admin'));

router.get('/', async (req, res) => {
  try {
    const users = await dataStore.getUsers();
    res.json(users.map(u => ({ username: u.username, nome: u.nome, role: u.role, profissionalId: u.profissionalId })));
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { username, nome, senha, role, profissionalId } = req.body || {};
  if (!username || !nome || !senha || !role) return res.status(400).json({ error: 'Preencha nome, usuário, senha e perfil.' });
  try {
    const existing = await dataStore.findUserByUsername(username.trim());
    if (existing) return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
    const user = {
      username: username.trim().toLowerCase(), nome, senhaHash: hashPassword(senha), role,
      profissionalId: role === 'profissional' ? (profissionalId || null) : null,
    };
    await dataStore.createUser(user);
    res.status(201).json({ username: user.username, nome: user.nome, role: user.role, profissionalId: user.profissionalId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.put('/:username', async (req, res) => {
  const { nome, senha, role, profissionalId } = req.body || {};
  try {
    const patch = { nome, role, profissionalId: role === 'profissional' ? (profissionalId || null) : null };
    if (senha) patch.senhaHash = hashPassword(senha);
    const updated = await dataStore.updateUser(req.params.username, patch);
    res.json({ username: updated.username, nome: updated.nome, role: updated.role, profissionalId: updated.profissionalId });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.delete('/:username', async (req, res) => {
  if (req.params.username === 'admin') return res.status(400).json({ error: 'Não é possível excluir o admin principal.' });
  try { await dataStore.deleteUser(req.params.username); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
