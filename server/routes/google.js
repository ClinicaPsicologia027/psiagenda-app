const express = require('express');
const router = express.Router();
const dataStore = require('../dataStore');
const { authenticate, requireRole } = require('../auth');
const googleCal = require('../google');

// O admin pede o link de autorização pra uma profissional específica.
router.get('/connect/:profId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const prof = await dataStore.getProfessionalById(req.params.profId);
    if (!prof) return res.status(404).json({ error: 'Profissional não encontrado(a).' });
    if (!prof.email) return res.status(400).json({ error: 'Cadastre o e-mail do Google dessa profissional antes de conectar.' });
    const url = googleCal.getAuthUrl(prof.id);
    res.json({ url });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// O Google chama essa rota diretamente depois que a profissional autoriza — sem token do app.
router.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(resultPage(false, 'A autorização foi cancelada.'));
  if (!code || !state) return res.send(resultPage(false, 'Faltam parâmetros na resposta do Google.'));
  try {
    const tokens = await googleCal.exchangeCode(code);
    if (!tokens.refresh_token) {
      return res.send(resultPage(false, 'O Google não devolveu um acesso permanente. Se essa profissional já autorizou antes, remova o acesso do PsiAgenda em myaccount.google.com/permissions e tente conectar de novo.'));
    }
    await dataStore.setProfessionalGoogleToken(state, tokens.refresh_token);
    res.send(resultPage(true, 'Google Agenda conectada com sucesso! Você já pode fechar esta janela.'));
  } catch (e) {
    res.send(resultPage(false, e.message));
  }
});

// Desconectar (admin) — apaga o refresh_token guardado.
router.post('/disconnect/:profId', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await dataStore.setProfessionalGoogleToken(req.params.profId, null);
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

function resultPage(ok, message) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
  <title>PsiAgenda — Google Agenda</title></head>
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:60px 24px;color:#2b2b2b;">
    <div style="font-size:40px;">${ok ? '✅' : '⚠️'}</div>
    <h2 style="margin:12px 0;">${ok ? 'Conectado!' : 'Algo deu errado'}</h2>
    <p style="color:#555;max-width:420px;margin:0 auto;">${message}</p>
  </body></html>`;
}

module.exports = router;
