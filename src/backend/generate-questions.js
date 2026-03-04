const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

/* ======================================================
   CONFIG — adicione no seu .env ou substitua direto
====================================================== */
const ANTHROPIC_API_KEY      = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL            = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/* ======================================================
   ÁREAS E MATÉRIAS
====================================================== */
const AREAS = {
  PRF: {
    label: "Polícia Rodoviária Federal",
    materias: [
      "Legislação de Trânsito (CTB)",
      "Direito Constitucional",
      "Direito Administrativo",
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Direito Penal",
      "Direitos Humanos",
    ],
  },
  PF: {
    label: "Polícia Federal",
    materias: [
      "Direito Constitucional",
      "Direito Administrativo",
      "Direito Penal",
      "Direito Processual Penal",
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Legislação Especial (Lei de Drogas, Lei de Lavagem)",
    ],
  },
  PC: {
    label: "Polícia Civil",
    materias: [
      "Direito Constitucional",
      "Direito Penal",
      "Direito Processual Penal",
      "Direito Administrativo",
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Legislação Estadual",
    ],
  },
  PM: {
    label: "Polícia Militar",
    materias: [
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Direito Constitucional",
      "Direito Administrativo",
      "Estatuto da Corporação",
      "Geografia e História do Brasil",
      "Atualidades",
    ],
  },
  PL: {
    label: "Polícia Legislativa",
    materias: [
      "Direito Constitucional",
      "Regimento Interno da Câmara/Senado",
      "Direito Administrativo",
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Direito Penal",
      "Direito Processual Penal",
    ],
  },
  PP: {
    label: "Polícia Penal",
    materias: [
      "Lei de Execução Penal (LEP)",
      "Direito Constitucional",
      "Direito Penal",
      "Direito Administrativo",
      "Língua Portuguesa",
      "Raciocínio Lógico e Matemática",
      "Direitos Humanos e Ética",
    ],
  },
};

/* ======================================================
   GERA 10 QUESTÕES PARA UMA ÁREA
====================================================== */
async function generateQuestions(areaId) {
  const area = AREAS[areaId];

  // Seleciona 2 matérias aleatórias para variar por dia
  const shuffled = [...area.materias].sort(() => Math.random() - 0.5);
  const materiasSelecionadas = shuffled.slice(0, 2).join(" e ");

  const prompt = `Você é um especialista em concursos públicos brasileiros, com profundo conhecimento em editais e provas anteriores.

Gere exatamente 10 questões de múltipla escolha para o concurso de ${area.label} (${areaId}), focando nas matérias: ${materiasSelecionadas}.

As questões devem:
- Ser baseadas em editais reais e provas anteriores de concursos policiais brasileiros
- Ter nível de dificuldade médio-alto, compatível com concursos federais/estaduais
- Ter 4 alternativas (A, B, C, D)
- Ter apenas uma resposta correta
- Abordar conteúdos cobrados frequentemente em provas

Responda APENAS com um JSON válido, sem texto adicional, sem markdown, sem comentários:
{
  "questions": [
    {
      "question": "Texto da questão aqui?",
      "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
      "correct": 0,
      "category": "Nome da matéria"
    }
  ]
}

O campo "correct" deve ser o índice (0-3) da alternativa correta.
Gere exatamente 10 questões.`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  });

const text = message.content[0].text.trim();

// Remove markdown code blocks se existirem
const clean = text
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/```\s*$/i, "")
  .trim();

const parsed = JSON.parse(clean);
return parsed.questions;
}

/* ======================================================
   DELETA QUESTÕES ANTIGAS E INSERE NOVAS
====================================================== */
async function replaceQuestions(areaId, questions) {
  // Deleta todas as questões antigas da área
  const { error: deleteError } = await supabase
    .from("questions")
    .delete()
    .eq("area", areaId);

  if (deleteError) {
    console.error(`❌ Erro ao deletar questões de ${areaId}:`, deleteError.message);
    return false;
  }

  // Monta os registros para inserção
  const records = questions.map((q) => ({
    area:     areaId,
    question: q.question,
    options:  q.options,
    correct:  q.correct,
    category: q.category,
  }));

  const { error: insertError } = await supabase
    .from("questions")
    .insert(records);

  if (insertError) {
    console.error(`❌ Erro ao inserir questões de ${areaId}:`, insertError.message);
    return false;
  }

  console.log(`✅ ${areaId}: 10 questões inseridas com sucesso`);
  return true;
}

/* ======================================================
   FUNÇÃO PRINCIPAL
====================================================== */
async function generateDailyQuestions() {
  console.log("🤖 Iniciando geração diária de questões —", new Date().toLocaleString("pt-BR"));

  const areas = Object.keys(AREAS);
  let success = 0;
  let failed  = 0;

  for (const areaId of areas) {
    try {
      console.log(`📝 Gerando questões para ${areaId}...`);
      const questions = await generateQuestions(areaId);

      if (!questions || questions.length === 0) {
        console.error(`❌ ${areaId}: nenhuma questão gerada`);
        failed++;
        continue;
      }

      const ok = await replaceQuestions(areaId, questions);
      if (ok) success++;
      else failed++;

      // Aguarda 2s entre requisições para não sobrecarregar a API
      await new Promise((r) => setTimeout(r, 2000));

    } catch (err) {
      console.error(`❌ Erro ao processar ${areaId}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Resultado: ${success} áreas com sucesso, ${failed} com erro`);
  console.log("✅ Geração concluída —", new Date().toLocaleString("pt-BR"));
}

/* ======================================================
   EXPORTA PARA USO NO SERVER.JS
====================================================== */
module.exports = { generateDailyQuestions };

// Permite rodar diretamente: node generate-questions.js
if (require.main === module) {
  generateDailyQuestions().catch(console.error);
}
