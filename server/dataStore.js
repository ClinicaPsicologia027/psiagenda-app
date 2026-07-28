// Banco de dados = tabelas Postgres no Supabase. Este módulo traduz entre os objetos
// que o resto do app usa (profissional, usuário, horário) e as linhas das
// tabelas "profissionais", "usuarios" e "agendamentos" no Supabase.
const supabase = require('./supabaseClient');

function must(error) {
  if (error) throw new Error(error.message || 'Erro ao acessar o banco de dados (Supabase).');
}

/* ---------------- PROFISSIONAIS ---------------- */
// "googleConnected" é derivado (não expomos o refresh_token pro front-end).
function rowToProf(row) {
  return { id: row.id, nome: row.nome, email: row.email || '', googleConnected: !!row.google_refresh_token };
}
// Nunca inclui o google_refresh_token aqui — ele só é alterado pelas funções
// específicas abaixo (setProfessionalGoogleToken), nunca por uma edição normal de nome/e-mail.
function profToRow(p) {
  return { id: p.id, nome: p.nome, email: p.email || null };
}
async function getProfessionals() {
  const { data, error } = await supabase.from('profissionais').select('*').order('nome', { ascending: true });
  must(error);
  return (data || []).map(rowToProf);
}
async function getProfessionalById(id) {
  const { data, error } = await supabase.from('profissionais').select('*').eq('id', id).maybeSingle();
  must(error);
  return data ? rowToProf(data) : null;
}
async function createProfessional(p) {
  const { error } = await supabase.from('profissionais').insert(profToRow(p));
  must(error);
  return rowToProf(profToRow(p));
}
async function updateProfessional(id, patch) {
  const { data, error } = await supabase.from('profissionais').select('*').eq('id', id).maybeSingle();
  must(error);
  if (!data) throw new Error('Profissional não encontrado(a) no banco de dados.');
  const current = rowToProf(data);
  const updated = { ...current, ...patch, id };
  const { error: e2 } = await supabase.from('profissionais').update(profToRow(updated)).eq('id', id);
  must(e2);
  return updated;
}
async function deleteProfessional(id) {
  const { error } = await supabase.from('profissionais').delete().eq('id', id);
  must(error);
}
// Guarda (ou remove, se token=null) o refresh_token do Google Agenda da profissional.
async function setProfessionalGoogleToken(id, token) {
  const { error } = await supabase.from('profissionais').update({ google_refresh_token: token }).eq('id', id);
  must(error);
}
// Usado internamente (sync com o Google) — nunca sai numa resposta da API pro front-end.
async function getProfessionalGoogleToken(id) {
  const { data, error } = await supabase.from('profissionais').select('google_refresh_token').eq('id', id).maybeSingle();
  must(error);
  return data ? data.google_refresh_token : null;
}

/* ---------------- USUARIOS ---------------- */
function rowToUser(row) {
  return { username: row.username, nome: row.nome, senhaHash: row.senha_hash, role: row.role, profissionalId: row.profissional_id || null };
}
function userToRow(u) {
  return { username: u.username, nome: u.nome, senha_hash: u.senhaHash, role: u.role, profissional_id: u.profissionalId || null };
}
async function getUsers() {
  const { data, error } = await supabase.from('usuarios').select('*');
  must(error);
  return (data || []).map(rowToUser);
}
async function findUserByUsername(username) {
  const { data, error } = await supabase.from('usuarios').select('*').ilike('username', username).maybeSingle();
  must(error);
  return data ? rowToUser(data) : null;
}
async function createUser(u) {
  const { error } = await supabase.from('usuarios').insert(userToRow(u));
  must(error);
  return u;
}
async function updateUser(username, patch) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('username', username).maybeSingle();
  must(error);
  if (!data) throw new Error('Usuário não encontrado no banco de dados.');
  const current = rowToUser(data);
  const updated = { ...current, ...patch, username };
  const { error: e2 } = await supabase.from('usuarios').update(userToRow(updated)).eq('username', username);
  must(e2);
  return updated;
}
async function deleteUser(username) {
  const { error } = await supabase.from('usuarios').delete().eq('username', username);
  must(error);
}

/* ---------------- AGENDAMENTOS (horários de sessão) ---------------- */
// Cada linha é um horário concreto: início, fim, paciente e observações.
// Diferente do app de fisioterapia, aqui não existe uma grade fixa de horários —
// a recepção (ou o admin) cria e edita os horários livremente, dia a dia.
function rowToAppt(row) {
  return {
    id: row.id,
    profissionalId: row.profissional_id,
    date: row.data,
    horarioInicio: row.horario_inicio,
    horarioFim: row.horario_fim,
    paciente: row.paciente || '',
    obs: row.obs || '',
    googleEventId: row.google_event_id || null,
  };
}
async function getAppointmentsForProfDate(profId, date) {
  const { data, error } = await supabase
    .from('agendamentos').select('*')
    .eq('profissional_id', profId).eq('data', date)
    .order('horario_inicio', { ascending: true });
  must(error);
  return (data || []).map(rowToAppt);
}
async function getAppointmentById(id) {
  const { data, error } = await supabase.from('agendamentos').select('*').eq('id', id).maybeSingle();
  must(error);
  return data ? rowToAppt(data) : null;
}
// Grava o id do evento criado no Google Agenda, pra poder atualizar/excluir depois.
async function setAppointmentGoogleEventId(id, googleEventId) {
  const { error } = await supabase.from('agendamentos').update({ google_event_id: googleEventId }).eq('id', id);
  must(error);
}
async function createAppointment(profId, date, horarioInicio, horarioFim, paciente, obs) {
  const { data, error } = await supabase.from('agendamentos').insert({
    profissional_id: profId,
    data: date,
    horario_inicio: horarioInicio,
    horario_fim: horarioFim,
    paciente: paciente || '',
    obs: obs || '',
  }).select('*').single();
  must(error);
  return rowToAppt(data);
}
async function updateAppointment(id, patch) {
  const row = {};
  if (patch.paciente !== undefined) row.paciente = patch.paciente;
  if (patch.obs !== undefined) row.obs = patch.obs;
  if (patch.horarioInicio !== undefined) row.horario_inicio = patch.horarioInicio;
  if (patch.horarioFim !== undefined) row.horario_fim = patch.horarioFim;
  const { data, error } = await supabase.from('agendamentos').update(row).eq('id', id).select('*').single();
  must(error);
  return rowToAppt(data);
}
async function deleteAppointment(id) {
  const { error } = await supabase.from('agendamentos').delete().eq('id', id);
  must(error);
}

module.exports = {
  getProfessionals, getProfessionalById, createProfessional, updateProfessional, deleteProfessional,
  setProfessionalGoogleToken, getProfessionalGoogleToken,
  getUsers, findUserByUsername, createUser, updateUser, deleteUser,
  getAppointmentsForProfDate, getAppointmentById, createAppointment, updateAppointment, deleteAppointment,
  setAppointmentGoogleEventId,
};
