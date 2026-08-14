const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { authenticate, requireRole } = require('../auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const all = await dataStore.getProfessionals();
    if (req.user.role === 'profissional') return res.json(all.filter(p => p.id === req.user.profissionalId));
    res.json(all);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Só aceita dias válidos e datas no formato aaaa-mm-dd, pra não gravar lixo no banco.
const DIAS_VALIDOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
function limpaDias(dias) {
  if (!Array.isArray(dias)) return [];
  return dias.filter(d => DIAS_VALIDOS.includes(d));
}
function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d;
}
function limpaExcecoes(lista) {
  if (!Array.isArray(lista)) return [];
  const vistas = new Set();
  return lista
    .filter(e => e && dataValida(e.data))
    .filter(e => { if (vistas.has(e.data)) return false; vistas.add(e.data); return true; })
    .map(e => ({ data: e.data, tipo: e.tipo === 'extra' ? 'extra' : 'falta' }));
}

router.post('/', requireRole('admin'), async (req, res) => {
  const { nome, email, dias, excecoes } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Informe o nome.' });
  const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'prof-' + Date.now();
  try {
    const prof = await dataStore.createProfessional({ id, nome, email: (email || '').trim(), dias: limpaDias(dias), excecoes: limpaExcecoes(excecoes) });
    res.status(201).json(prof);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Recepção também pode ajustar a escala (dias fixos e encaixes/faltas em datas),
// já que é ela quem organiza a agenda no dia a dia. Nome e e-mail seguem só do admin.
router.put('/:id', requireRole('admin', 'recepcao'), async (req, res) => {
  const { nome, email, dias, excecoes } = req.body || {};
  try {
    const patch = {};
    if (req.user.role === 'admin') {
      patch.nome = nome;
      patch.email = (email || '').trim();
    }
    if (dias !== undefined) patch.dias = limpaDias(dias);
    if (excecoes !== undefined) patch.excecoes = limpaExcecoes(excecoes);
    const updated = await dataStore.updateProfessional(req.params.id, patch);
    res.json(updated);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try { await dataStore.deleteProfessional(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
