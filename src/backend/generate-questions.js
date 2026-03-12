require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");

const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;
const SUPABASE_URL         = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const genAI    = new GoogleGenerativeAI(GEMINI_API_KEY);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const AREAS = {
  PRF: { label: "Polícia Rodoviária Federal", materias: ["Legislação de Trânsito (CTB)", "Direito Constitucional", "Direito Administrativo", "Língua Portuguesa", "Raciocínio Lógico e Matemática", "Direito Penal", "Direitos Humanos, Informática"] },
  PF:  { label: "Polícia Federal",            materias: ["Direito Constitucional", "Direito Administrativo", "Direito Penal", "Direito Processual Penal", "Língua Portuguesa", "Raciocínio Lógico e Matemática", "Legislação Especial (Lei de Drogas, Lei de Lavagem), Informática"] },
  PC:  { label: "Polícia Civil",              materias: ["Direito Constitucional", "Direito Penal", "Direito Processual Penal", "Direito Administrativo", "Língua Portuguesa", "Raciocínio Lógico e Matemática", "Legislação Estadual, Informática"] },
  PM:  { label: "Polícia Militar",            materias: ["Língua Portuguesa", "Raciocínio Lógico e Matemática", "Direito Constitucional", "Direito Administrativo", "Estatuto da Corporação", "Geografia e História do Brasil", "Atualidades, Informática"] },
  PL:  { label: "Polícia Legislativa",        materias: ["Direito Constitucional", "Regimento Interno da Câmara/Senado", "Direito Administrativo", "Língua Portuguesa", "Raciocínio Lógico e Matemática", "Direito Penal", "Direito Processual Penal, Informática"] },
  PP:  { label: "Polícia Penal",              materias: ["Lei de Execução Penal (LEP)", "Direito Constitucional", "Direito Penal", "Direito Administrativo", "Língua Portuguesa", "Raciocínio Lógico e Matemática", "Direitos Humanos e Ética, Informática"] },
};

async function generateQuestions(areaId) {
  const area = AREAS[areaId];
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

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const text = result.response.text().trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(text);
  return parsed.questions;
}

async function replaceQuestions(areaId, questions) {
  const { error: deleteError } = await supabase.from("questions").delete().eq("area", areaId);
  if (deleteError) { console.error(`❌ Erro ao deletar questões de ${areaId}:`, deleteError.message); return false; }

  const records = questions.map((q) => ({ area: areaId, question: q.question, options: q.options, correct: q.correct, category: q.category }));
  const { error: insertError } = await supabase.from("questions").insert(records);
  if (insertError) { console.error(`❌ Erro ao inserir questões de ${areaId}:`, insertError.message); return false; }

  console.log(`✅ ${areaId}: 10 questões inseridas com sucesso`);
  return true;
}

async function generateDailyQuestions() {
  console.log("🤖 Iniciando geração diária de questões —", new Date().toLocaleString("pt-BR"));
  const areas = Object.keys(AREAS);
  let success = 0, failed = 0;

  for (const areaId of areas) {
    try {
      console.log(`📝 Gerando questões para ${areaId}...`);
      const questions = await generateQuestions(areaId);
      if (!questions || questions.length === 0) { console.error(`❌ ${areaId}: nenhuma questão gerada`); failed++; continue; }
      const ok = await replaceQuestions(areaId, questions);
      if (ok) success++; else failed++;
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`❌ Erro ao processar ${areaId}:`, err.message);
      failed++;
    }
  }

  console.log(`\n📊 Resultado: ${success} áreas com sucesso, ${failed} com erro`);
  console.log("✅ Geração concluída —", new Date().toLocaleString("pt-BR"));
}

module.exports = { generateDailyQuestions };
if (require.main === module) { generateDailyQuestions().catch(console.error); }