const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { authenticate, requireRole } = require('../auth');

router.use(authenticate);

function canAccessProf(user, profId) {
  if (user.role === 'profissional') return user.profissionalId === profId;
  return true; // admin e recepção acessam qualquer profissional
}

// Lista os horários de uma profissional num dia específico.
router.get('/:profId/:date', async (req, res) => {
  if (!canAccessProf(req.user, req.params.profId)) return res.status(403).json({ error: 'Sem permissão.' });
  try {
    const list = await dataStore.getAppointmentsForProfDate(req.params.profId, req.params.date);
    res.json(list);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Cria um novo horário — só recepção e admin definem os horários do dia.
router.post('/:profId', requireRole('admin', 'recepcao'), async (req, res) => {
  const { date, horarioInicio, horarioFim, paciente, obs } = req.body || {};
  if (!date || !horarioInicio || !horarioFim) return res.status(400).json({ error: 'Informe data, início e fim.' });
  try {
    const created = await dataStore.createAppointment(req.params.profId, date, horarioInicio, horarioFim, paciente || '', obs || '');
    res.status(201).json(created);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Atualiza um horário existente.
// - profissional: só pode alterar paciente/observações da própria agenda.
// - recepção/admin: podem alterar tudo, inclusive início e fim do horário.
router.put('/:profId/:id', async (req, res) => {
  if (!canAccessProf(req.user, req.params.profId)) return res.status(403).json({ error: 'Sem permissão.' });
  const { horarioInicio, horarioFim, paciente, obs } = req.body || {};
  const patch = {};
  if (paciente !== undefined) patch.paciente = paciente;
  if (obs !== undefined) patch.obs = obs;
  if (horarioInicio !== undefined || horarioFim !== undefined) {
    if (req.user.role === 'profissional') return res.status(403).json({ error: 'Só a recepção ou o admin podem alterar o horário.' });
    if (horarioInicio !== undefined) patch.horarioInicio = horarioInicio;
    if (horarioFim !== undefined) patch.horarioFim = horarioFim;
  }
  try {
    const updated = await dataStore.updateAppointment(req.params.id, patch);
    res.json(updated);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Remove um horário — só recepção e admin.
router.delete('/:profId/:id', requireRole('admin', 'recepcao'), async (req, res) => {
  if (!canAccessProf(req.user, req.params.profId)) return res.status(403).json({ error: 'Sem permissão.' });
  try { await dataStore.deleteAppointment(req.params.id); res.json({ ok: true }); }
  catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
