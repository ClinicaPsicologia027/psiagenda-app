const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url) console.warn('⚠️  SUPABASE_URL não definida — configure as variáveis de ambiente.');
if (!key) console.warn('⚠️  SUPABASE_KEY não definida — configure as variáveis de ambiente.');

const supabase = createClient(url, key);

module.exports = supabase;
