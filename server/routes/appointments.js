const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { authenticate, requireRole } = require('../auth');
const googleCal = require('../google');

router.use(authenticate);

function canAccessProf(user, profId) {
  if (user.role === 'profissional') return user.profissionalId === profId;
  return true; // admin e recepção acessam qualquer profissional
}

// Sincroniza com o Google Agenda da profissional (se ela tiver conectado).
// É "melhor esforço": se der erro (token revogado, sem internet do Google, etc.)
// o agendamento no PsiAgenda continua valendo normalmente — só registramos o erro.
function eventPayload(appt) {
  return {
    summary: 'Sessão' + (appt.paciente ? ' — ' + appt.paciente : ''),
    description: appt.obs || '',
    date: appt.date, startTime: appt.horarioInicio, endTime: appt.horarioFim,
  };
}
async function syncCreate(profId, appt) {
  try {
    const token = await dataStore.getProfessionalGoogleToken(profId);
    if (!token) return;
    const eventId = await googleCal.createEvent(token, eventPayload(appt));
    await dataStore.setAppointmentGoogleEventId(appt.id, eventId);
  } catch (e) { console.error('Google Agenda (criar):', e.message); }
}
async function syncUpdate(profId, appt) {
  try {
    if (!appt.googleEventId) return syncCreate(profId, appt);
    const token = await dataStore.getProfessionalGoogleToken(profId);
    if (!token) return;
    await googleCal.updateEvent(token, appt.googleEventId, eventPayload(appt));
  } catch (e) { console.error('Google Agenda (atualizar):', e.message); }
}
async function syncDelete(profId, appt) {
  try {
    if (!appt || !appt.googleEventId) return;
    const token = await dataStore.getProfessionalGoogleToken(profId);
    if (!token) return;
    await googleCal.deleteEvent(token, appt.googleEventId);
  } catch (e) { console.error('Google Agenda (excluir):', e.message); }
}

// Lista os horários de uma profissional num dia específico.
router.get('/:profId/:date', async (req, res) => {
  if (!canAccessProf(req.user, req.params.profId)) return res.status(403).json({ error: 'Sem permissão.' });
  try {
    const list = await dataStore.getAppointmentsForProfDate(req.params.profId, req.params.date);
    res.json(list);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Soma dias a uma data "YYYY-MM-DD" sem depender do fuso horário local
// (trabalha tudo em UTC pra não correr risco de virar o dia errado).
function addDaysToDateStr(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

// Cria um novo horário — só recepção e admin definem os horários do dia.
// Se "repeatWeeks" vier > 1, cria o mesmo horário/paciente também nas semanas
// seguintes (mesmo dia da semana), como agendamentos independentes — cada um
// pode depois ser editado ou excluído sem afetar os outros.
router.post('/:profId', requireRole('admin', 'recepcao'), async (req, res) => {
  const { date, horarioInicio, horarioFim, paciente, obs, repeatWeeks } = req.body || {};
  if (!date || !horarioInicio || !horarioFim) return res.status(400).json({ error: 'Informe data, início e fim.' });
  const totalWeeks = Math.min(Math.max(parseInt(repeatWeeks, 10) || 1, 1), 4);
  try {
    const createdList = [];
    for (let i = 0; i < totalWeeks; i++) {
      const d = i === 0 ? date : addDaysToDateStr(date, i * 7);
      const created = await dataStore.createAppointment(req.params.profId, d, horarioInicio, horarioFim, paciente || '', obs || '');
      await syncCreate(req.params.profId, created);
      createdList.push(created);
    }
    res.status(201).json(totalWeeks > 1 ? createdList : createdList[0]);
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
    await syncUpdate(req.params.profId, updated);
    res.json(updated);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// Remove um horário — só recepção e admin.
router.delete('/:profId/:id', requireRole('admin', 'recepcao'), async (req, res) => {
  if (!canAccessProf(req.user, req.params.profId)) return res.status(403).json({ error: 'Sem permissão.' });
  try {
    const existing = await dataStore.getAppointmentById(req.params.id);
    await dataStore.deleteAppointment(req.params.id);
    await syncDelete(req.params.profId, existing);
    res.json({ ok: true });
  }
  catch (e) { res.status(502).json({ error: e.message }); }
});

module.exports = router;
