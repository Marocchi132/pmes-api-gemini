import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const gemini = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function localCorrection(texto, tema) {
  const palavras = (texto.match(/[\p{L}\p{N}]+/gu) || []).length;
  const nota = Math.max(360, Math.min(760, 350 + palavras));
  return {
    origem: 'local', nota_total: nota,
    competencias: {
      norma_culta: { nota: Math.min(200, 90 + Math.floor(palavras/4)), comentario: 'Correção local emergencial.' },
      compreensao_tema: { nota: 110, comentario: 'Verifique aderência direta ao tema.' },
      argumentacao: { nota: 110, comentario: 'Desenvolva repertório e exemplos.' },
      coesao: { nota: 100, comentario: 'Use conectivos entre os parágrafos.' },
      proposta_intervencao: { nota: 90, comentario: 'Inclua agente, ação, meio e finalidade.' }
    },
    diagnostico_geral: 'A IA não respondeu; foi usada correção local.',
    erros_ortograficos: [], erros_pontuacao: [], incoerencias: [], sugestoes: ['Escreva introdução, desenvolvimento e conclusão.']
  };
}

async function getUserFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '').trim();
  if (!token || !supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

app.get('/api/health', (req,res)=>res.json({ ok:true, gemini: !!gemini, supabase: !!supabaseAdmin }));

app.post('/api/corrigir-redacao', async (req, res) => {
  const { tema='', redacao='' } = req.body || {};
  if (!redacao || redacao.trim().length < 120) return res.status(400).json({ error: 'Texto curto demais.' });
  try {
    if (!gemini) throw new Error('GEMINI_API_KEY ausente');
    const prompt = `Você é corretor rigoroso de redação dissertativo-argumentativa para concurso policial de nível médio. Corrija em português do Brasil. Tema: ${tema}\n\nRedação:\n${redacao}\n\nRetorne SOMENTE JSON válido, sem markdown, exatamente neste formato: {"origem":"ia","nota_total":0,"competencias":{"norma_culta":{"nota":0,"comentario":""},"compreensao_tema":{"nota":0,"comentario":""},"argumentacao":{"nota":0,"comentario":""},"coesao":{"nota":0,"comentario":""},"proposta_intervencao":{"nota":0,"comentario":""}},"diagnostico_geral":"","erros_ortograficos":[{"trecho":"","problema":"","sugestao":""}],"erros_pontuacao":[{"trecho":"","problema":"","sugestao":""}],"incoerencias":[{"trecho":"","problema":"","sugestao":""}],"sugestoes":[""]}. Cada competência vale 0 a 200 e a nota_total é a soma.`;
    const result = await gemini.models.generateContent({ model, contents: prompt });
    const raw = result.text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(raw);
    parsed.origem = 'ia';
    res.json(parsed);
  } catch (err) {
    console.error('Erro IA:', err.message);
    res.json(localCorrection(redacao, tema));
  }
});

app.post('/api/redacoes', async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { tema, texto, correcao } = req.body || {};
  const nota = correcao?.nota_total || 0;
  const { data, error } = await supabaseAdmin.from('redacoes').insert({ user_id: user.id, tema, texto, nota, correcao }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/redacoes', async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { data, error } = await supabaseAdmin.from('redacoes').select('*').eq('user_id', user.id).order('created_at', { ascending:false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.post('/api/simulados', async (req, res) => {
  const user = await getUserFromToken(req);

  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const {
    titulo = 'Simulado PMES',
    acertos = 0,
    total = 0,
    tempo_segundos = 0,
    detalhes = {}
  } = req.body || {};

  const nota_percentual =
    total > 0 ? Math.round((acertos / total) * 100) : 0;

  const { data, error } = await supabaseAdmin
    .from('simulados')
    .insert({
      user_id: user.id,
      titulo,
      total_questoes: total,
      acertos,
      nota_percentual,
      tempo_segundos,
      detalhes
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao salvar simulado:', error);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

app.get('/api/simulados', async (req, res) => {
  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  const { data, error } = await supabaseAdmin.from('simulados').select('*').eq('user_id', user.id).order('created_at', { ascending:false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.listen(PORT, () => console.log(`PMES Pro Área do Aluno rodando na porta ${PORT}`));
