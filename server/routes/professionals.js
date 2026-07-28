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

router.post('/', requireRole('admin'), async (req, res) => {
  const { nome } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Informe o nome.' });
  const id = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'prof-' + Date.now();
  try {
    const prof = await dataStore.createProfessional({ id, nome });
    res.status(201).json(prof);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { nome } = req.body || {};
  try {
    const updated = await dataStore.updateProfessional(req.params.id, { nome });
    res.json(updated);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try { await dataStore.deleteProfessional(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
