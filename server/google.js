// Integração com a API do Google Calendar (OAuth 2.0), usando apenas 'fetch' nativo
// do Node — sem depender do pacote 'googleapis' (mais leve para publicar no Render).
// Cada profissional autoriza o PsiAgenda a criar/editar eventos na agenda dela;
// guardamos só o "refresh_token" (não expira sozinho) e pedimos um "access_token"
// novo a cada chamada.

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TIMEZONE = 'America/Sao_Paulo';

function checkConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error('Integração com o Google não configurada (faltam GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI).');
  }
}

// Monta o link para o admin mandar a profissional autorizar o acesso.
// "state" carrega o id da profissional, pra sabermos de quem é o token quando o Google chamar de volta.
function getAuthUrl(profId) {
  checkConfigured();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPE,
    state: profId,
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
}

// Troca o "code" que o Google manda no callback por tokens (inclui o refresh_token).
async function exchangeCode(code) {
  checkConfigured();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Falha ao trocar o código de autorização com o Google.');
  return data; // { access_token, refresh_token, expires_in, ... }
}

// Usa o refresh_token guardado pra pegar um access_token novo (eles expiram em ~1h).
async function getAccessToken(refreshToken) {
  checkConfigured();
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Falha ao renovar o acesso ao Google Agenda. A profissional pode precisar conectar de novo.');
  return data.access_token;
}

function toEventBody({ summary, description, date, startTime, endTime }) {
  return {
    summary,
    description: description || '',
    start: { dateTime: `${date}T${startTime}:00`, timeZone: TIMEZONE },
    end: { dateTime: `${date}T${endTime}:00`, timeZone: TIMEZONE },
  };
}

async function createEvent(refreshToken, evt) {
  const accessToken = await getAccessToken(refreshToken);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(toEventBody(evt)),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Falha ao criar evento no Google Agenda.');
  return data.id;
}

async function updateEvent(refreshToken, eventId, evt) {
  const accessToken = await getAccessToken(refreshToken);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify(toEventBody(evt)),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.error && data.error.message) || 'Falha ao atualizar evento no Google Agenda.');
  }
}

async function deleteEvent(refreshToken, eventId) {
  const accessToken = await getAccessToken(refreshToken);
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + accessToken },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.error && data.error.message) || 'Falha ao excluir evento no Google Agenda.');
  }
}

module.exports = { getAuthUrl, exchangeCode, createEvent, updateEvent, deleteEvent };
