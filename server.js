import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(express.json({ limit: '120kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const competenciaSchema = {
  type: Type.OBJECT,
  properties: {
    nome: { type: Type.STRING },
    nota: { type: Type.INTEGER },
    comentario: { type: Type.STRING }
  },
  required: ['nome', 'nota', 'comentario']
};

const erroSchema = {
  type: Type.OBJECT,
  properties: {
    trecho: { type: Type.STRING },
    problema: { type: Type.STRING },
    sugestao: { type: Type.STRING }
  },
  required: ['trecho', 'problema', 'sugestao']
};

const schema = {
  type: Type.OBJECT,
  properties: {
    nota_total: { type: Type.INTEGER },
    diagnostico_geral: { type: Type.STRING },
    competencias: {
      type: Type.OBJECT,
      properties: {
        norma_culta: competenciaSchema,
        compreensao_tema: competenciaSchema,
        argumentacao: competenciaSchema,
        coesao: competenciaSchema,
        proposta_intervencao: competenciaSchema
      },
      required: ['norma_culta', 'compreensao_tema', 'argumentacao', 'coesao', 'proposta_intervencao']
    },
    erros_ortograficos: { type: Type.ARRAY, items: erroSchema },
    erros_pontuacao: { type: Type.ARRAY, items: erroSchema },
    incoerencias: { type: Type.ARRAY, items: { type: Type.STRING } },
    sugestoes_melhoria: { type: Type.ARRAY, items: { type: Type.STRING } },
    trechos_reescritos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING },
          reescrito: { type: Type.STRING },
          motivo: { type: Type.STRING }
        },
        required: ['original', 'reescrito', 'motivo']
      }
    }
  },
  required: [
    'nota_total',
    'diagnostico_geral',
    'competencias',
    'erros_ortograficos',
    'erros_pontuacao',
    'incoerencias',
    'sugestoes_melhoria',
    'trechos_reescritos'
  ]
};

function limitarNota(valor, max = 1000) {
  const n = Number(valor);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(max, Math.round(n)));
}

function normalizarResposta(data) {
  const comps = data.competencias || {};
  for (const chave of ['norma_culta', 'compreensao_tema', 'argumentacao', 'coesao', 'proposta_intervencao']) {
    if (!comps[chave]) comps[chave] = { nome: chave, nota: 0, comentario: 'Não avaliado.' };
    comps[chave].nota = limitarNota(comps[chave].nota, 200);
  }
  data.competencias = comps;

  const soma = Object.values(comps).reduce((acc, c) => acc + limitarNota(c.nota, 200), 0);
  data.nota_total = limitarNota(data.nota_total || soma, 1000);

  data.diagnostico_geral = data.diagnostico_geral || 'Correção concluída.';
  data.erros_ortograficos = Array.isArray(data.erros_ortograficos) ? data.erros_ortograficos : [];
  data.erros_pontuacao = Array.isArray(data.erros_pontuacao) ? data.erros_pontuacao : [];
  data.incoerencias = Array.isArray(data.incoerencias) ? data.incoerencias : [];
  data.sugestoes_melhoria = Array.isArray(data.sugestoes_melhoria) ? data.sugestoes_melhoria : [];
  data.trechos_reescritos = Array.isArray(data.trechos_reescritos) ? data.trechos_reescritos : [];
  return data;
}

app.post('/api/corrigir-redacao', async (req, res) => {
  try {
    const { tema, redacao } = req.body || {};

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    }
    if (typeof tema !== 'string' || tema.trim().length < 10) {
      return res.status(400).json({ error: 'Tema inválido.' });
    }
    if (typeof redacao !== 'string' || redacao.trim().length < 200) {
      return res.status(400).json({ error: 'Redação muito curta para correção por IA.' });
    }
    if (redacao.length > 12000) {
      return res.status(413).json({ error: 'Redação muito longa.' });
    }

    const prompt = `Corrija a redação abaixo como avaliador exigente de concurso público de nível médio para área policial no Brasil.\n\nTema: ${tema}\n\nRedação do aluno:\n${redacao}\n\nCritérios obrigatórios:\n- Dê nota de 0 a 200 para cada competência: norma culta, compreensão do tema, argumentação, coesão e proposta de intervenção.\n- A nota total deve ser a soma das cinco competências, de 0 a 1000.\n- Seja rigoroso, como banca de concurso.\n- Aponte erros reais de ortografia, gramática, pontuação, coesão, incoerência e argumentação.\n- Não invente erros inexistentes.\n- Não reescreva a redação inteira; reescreva no máximo 3 trechos problemáticos.\n- Responda somente em JSON válido, sem markdown.`;

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: schema,
        systemInstruction: 'Você é um corretor rigoroso de redações de concursos públicos brasileiros, com foco em PMES e concursos policiais. Responda somente em JSON válido no formato pedido.'
      }
    });

    const text = response.text;
    const data = normalizarResposta(JSON.parse(text));
    res.json(data);
  } catch (err) {
    console.error('Erro Gemini:', err);
    res.status(500).json({ error: 'Erro ao corrigir redação com Gemini.' });
  }
});

app.listen(PORT, () => {
  console.log(`PMES Pro com Gemini rodando em http://localhost:${PORT}`);
});
