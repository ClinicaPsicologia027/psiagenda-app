# PsiAgenda — app da clínica de psicologia com login por perfil e Supabase como banco de dados

App de agendamento para a clínica, com:
- Login próprio para cada profissional/recepção/administrador
- **O banco de dados é um projeto Supabase (Postgres)** — profissionais, usuários e horários ficam gravados nas tabelas `profissionais`, `usuarios` e `agendamentos`
- Calendário para escolher o dia, igual ao fluxo do FisioAgenda
- Horários de sessão totalmente editáveis: a recepção (ou o admin) cria, edita e remove os horários do dia; o(a) profissional só preenche o paciente e as observações dos horários já criados

> ⚠️ **Sobre segurança:** a tabela `usuarios` guarda os logins da equipe (com senha criptografada — nunca em texto puro). A chave usada pelo servidor (`SUPABASE_KEY`) tem acesso total ao banco — nunca a exponha no front-end nem a compartilhe fora do ambiente do servidor.

---

## 1. Rodando no seu computador (para testar antes de publicar)

Pré-requisito: ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais nova).

```bash
cd psiagenda-app
npm install
cp .env.example .env
npm start
```

Abra `http://localhost:3000`. Enquanto não existir nenhum usuário `admin` cadastrado na tabela `usuarios`, você consegue entrar com o login "de primeiro acesso":
- **usuário:** `admin`
- **senha:** `admin123`

Assim que a clínica criar um usuário `admin` de verdade na tabela `usuarios` (pelo app ou direto no Supabase), esse login de primeiro acesso deixa de funcionar e o app passa a validar sempre contra o banco de dados real.

---

## 2. Criando o banco de dados no Supabase

1. Crie uma conta em **[supabase.com](https://supabase.com)** e um novo projeto (plano gratuito).
2. No painel do projeto, vá em **SQL Editor → New query**, cole o conteúdo do arquivo `supabase-schema.sql` (nesta pasta) e clique em **Run**. Isso cria as tabelas `profissionais`, `usuarios` e `agendamentos`.
3. Vá em **Project Settings → API** e copie:
   - **Project URL** → é o seu `SUPABASE_URL`
   - **secret key** (às vezes chamada de `service_role key`, em "Project API keys") → é o seu `SUPABASE_KEY`

> ⚠️ Existem duas chaves parecidas no Supabase: a **publishable** (pública, começa com `sb_publishable_...`) e a **secret** (só do servidor, começa com `sb_secret_...` ou é a `service_role key`). Este app precisa da **secret** — a publishable não tem permissão suficiente e, se usada, exporia o banco sem proteção nenhuma.

---

## 3. Publicando o app na internet (para acessar do celular)

Sugestão de hospedagem com plano gratuito: **[Render](https://render.com)**.

1. Suba esta pasta para um repositório no GitHub (sem `node_modules` e sem `.env` — já estão no `.gitignore`).
2. No Render: **New → Web Service**, conecte o repositório.
3. **Build command:** `npm install` — **Start command:** `npm start`
4. Em **Environment**, adicione:
   ```
   JWT_SECRET=<uma frase aleatória e secreta>
   SUPABASE_URL=<o Project URL copiado>
   SUPABASE_KEY=<a secret key copiada>
   ```
5. Você vai receber uma URL tipo `https://psiagenda.onrender.com` — é o link que vai pro celular de cada profissional.

---

## 4. Entrando no app pela primeira vez

1. Abra a URL do app publicado.
2. Entre com **admin** / **admin123** (login de primeiro acesso, válido até existir um `admin` real na tabela `usuarios`).
3. Cadastre as(os) profissionais na aba **Profissionais**, cadastre usuários de verdade na aba **Usuários** (perfis: Admin, Profissional, Recepção), e troque a senha do admin criando um novo usuário admin por lá (ou editando direto no Supabase).

---

## 5. Como funciona a agenda

- **Recepção** e **Admin**: escolhem o dia no calendário, escolhem a profissional, e criam/editam/removem os horários daquele dia (início, fim, paciente, observações).
- **Profissional**: vê a própria agenda do dia, com os horários já definidos pela recepção/admin — pode preencher e editar o paciente e as observações, mas não pode mudar o horário nem criar/excluir horários.
- **Admin**: além de tudo isso, cadastra e remove profissionais e usuários.

---

## 6. Estrutura do projeto

```
psiagenda-app/
  server/
    index.js              → servidor Express
    auth.js                → login, hash de senha, JWT
    supabaseClient.js       → cria o cliente do Supabase a partir das variáveis de ambiente
    dataStore.js             → traduz entre o app e as tabelas do Supabase
    routes/
      auth.js                    → POST /api/auth/login
      professionals.js            → CRUD de profissionais
      users.js                     → CRUD de usuários (admin)
      appointments.js               → horários de sessão
  public/
    index.html             → o app que abre no navegador do celular
  supabase-schema.sql      → script para criar as tabelas no Supabase
  .env.example
  package.json
```

## 7. Próximos passos possíveis

- Notificações por WhatsApp/SMS lembrando o paciente da sessão.
- Relatórios (sessões por profissional/mês, etc.) usando consultas SQL direto no Supabase.
- Ativar Row Level Security no Supabase caso, no futuro, o front-end passe a falar direto com o banco (hoje não é o caso — só o servidor acessa o Supabase).

Qualquer um desses, é só pedir.
