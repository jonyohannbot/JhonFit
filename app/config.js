/* Jhon Fit — configuração do backend (Supabase).
   Estes dois valores são PÚBLICOS por natureza: vão para o navegador de qualquer forma.
   Quem protege os dados é o Row Level Security do banco (ver supabase/schema.sql).
   NUNCA coloque aqui a chave "service_role" / "secret".
   Deixe vazio para rodar em modo local (sem login, dados só no aparelho). */
self.JF_CONFIG = {
  supabaseUrl: '',
  supabaseKey: '',
};
