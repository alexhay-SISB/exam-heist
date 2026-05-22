/**
 * Question Generation Engine (CSV-driven)
 *
 * The teacher uploads a CSV of TOPICS (with model answers and marking notes).
 * The engine then generates VARIED question stems across difficulty tiers,
 * so students learn the concept area rather than memorising one question.
 */

const BUSINESS_TEMPLATES = [
  { name: 'BRX', type: 'bookshop', sector: 'tertiary', size: 'small', employees: 4, years: 5 },
  { name: 'CLM', type: 'clothing manufacturer', sector: 'secondary', size: 'medium', employees: 150, years: 12 },
  { name: 'GFT', type: 'gift shop', sector: 'tertiary', size: 'small', employees: 3, years: 7 },
  { name: 'MPC', type: 'mobile phone company', sector: 'tertiary', size: 'large', employees: 5000, years: 20 },
  { name: 'RST', type: 'restaurant chain', sector: 'tertiary', size: 'large', employees: 800, years: 25 },
  { name: 'TKD', type: 'toy manufacturer', sector: 'secondary', size: 'medium', employees: 200, years: 15 },
  { name: 'ECT', type: 'electronics retailer', sector: 'tertiary', size: 'medium', employees: 60, years: 10 },
  { name: 'FRM', type: 'organic farm', sector: 'primary', size: 'small', employees: 8, years: 18 },
  { name: 'SLN', type: 'beauty salon', sector: 'tertiary', size: 'small', employees: 5, years: 4 },
  { name: 'CNS', type: 'construction firm', sector: 'secondary', size: 'large', employees: 2500, years: 35 },
  { name: 'BKR', type: 'bakery', sector: 'secondary', size: 'small', employees: 7, years: 3 },
  { name: 'TRV', type: 'travel agency', sector: 'tertiary', size: 'medium', employees: 45, years: 22 },
  { name: 'GYM', type: 'fitness gym', sector: 'tertiary', size: 'medium', employees: 35, years: 8 },
  { name: 'FRN', type: 'furniture maker', sector: 'secondary', size: 'small', employees: 12, years: 30 },
  { name: 'PHR', type: 'pharmacy chain', sector: 'tertiary', size: 'large', employees: 1200, years: 40 },
  { name: 'CAR', type: 'car dealership', sector: 'tertiary', size: 'medium', employees: 80, years: 15 },
  { name: 'JWL', type: 'jewellery designer', sector: 'secondary', size: 'small', employees: 6, years: 11 },
  { name: 'WEB', type: 'web design agency', sector: 'tertiary', size: 'small', employees: 14, years: 6 }
];

const TEMPLATES_BY_DIFFICULTY = {
  EASY: [
    { command: 'Define', marks: 2, build: (t) => `Define '${t}'.` },
    { command: 'Identify', marks: 2, build: (t) => `Identify two ${t}.` },
    { command: 'State', marks: 2, build: (t) => `State two examples of ${t}.` }
  ],
  MEDIUM: [
    { command: 'Outline', marks: 3, build: (t, b) => `Outline one example of ${t} for ${b.name}.` },
    { command: 'Outline', marks: 4, build: (t) => `Outline two types of ${t}.` },
    { command: 'Describe', marks: 4, build: (t, b) => `Describe how ${t} could be used by ${b.name}.` }
  ],
  HARD: [
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two ${t} that ${b.name} could use.` },
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two advantages of ${t} for ${b.name}.` },
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two disadvantages of ${t} for ${b.name}.` },
    { command: 'Analyse', marks: 6, build: (t, b) => `Analyse how ${t} might affect ${b.name}.` }
  ],
  EXPERT: [
    { command: 'Justify', marks: 6, build: (t, b) => `Do you think ${t} is the best approach for ${b.name}? Justify your answer.` },
    { command: 'Discuss', marks: 8, build: (t, b) => `Discuss whether ${b.name} should rely on ${t}.` },
    { command: 'Evaluate', marks: 8, build: (t, b) => `Evaluate the use of ${t} by ${b.name}.` },
    { command: 'Recommend', marks: 6, build: (t, b) => `Recommend whether ${b.name} should focus on ${t}. Justify your answer.` }
  ]
};

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateBusinessContext = (business) => {
  const sizeDesc = business.size === 'small' ? 'small' : business.size === 'medium' ? 'medium-sized' : 'large';
  const sectorDesc = business.sector === 'tertiary' ? 'service sector' : `${business.sector} sector`;
  return `${business.name} is a ${sizeDesc} ${business.type} operating in the ${sectorDesc}. It has ${business.employees} employees and has been in business for ${business.years} years.`;
};

const validDifficulty = (d) => ['EASY', 'MEDIUM', 'HARD', 'EXPERT'].includes((d || '').toUpperCase()) ? d.toUpperCase() : null;

const buildKeywords = (text) => {
  if (!text) return [];
  const stopwords = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'are', 'has', 'have', 'can', 'could', 'would',
    'business', 'should', 'each', 'their', 'them', 'they', 'from', 'into', 'such', 'when',
    'which', 'these', 'those', 'than', 'then', 'about', 'will', 'also'
  ]);
  const words = text.toLowerCase().replace(/[^a-z\s\-]/g, ' ').split(/\s+/).filter(Boolean);
  const freq = {};
  for (const w of words) {
    if (w.length < 4 || stopwords.has(w)) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
};

// ────────────────────────────────────────────────────────────────────
//  Business-code anonymisation + category tagging
//
//  Past-paper questions reference a specific business by a 3-5 letter
//  acronym (TCH, DCN, DSY, OSR…). For replay variety, we strip the code
//  from the question + answer + notes and replace it with `{BUSINESS}`,
//  then substitute a randomly picked fictional business at game time.
// ────────────────────────────────────────────────────────────────────

// Tokens that look like business codes but aren't — never anonymise these.
const BUSINESS_CODE_BLACKLIST = new Set([
  // Syllabus acronyms
  'USP','JIT','TQM','GDP','ROCE','PLC','LTD','SME','SMES','CSR','CEO','CFO','COO','HRM','MD','VAT',
  'AGM','CSR','PEST','SWOT','SMART','SAAS','PAYE','GAAP','EBIT','EBITDA','APR','TUC','AMRT',
  // Geo/orgs
  'UK','USA','EU','UN','US','OECD','WTO','NGO','OPEC','NAFTA','ASEAN','MNC','MNCS','FDI','IMF','WHO',
  // Mark scheme jargon
  'OFR','APP','ANL','EVAL','MARK','MARKS','NOTE','NOTES','TOTAL','POINTS','MAX','MIN','REF','OWN',
  'AWARD','CREDIT','ACCEPT','REJECT','NEW','OLD',
  // Common stop-word style all-caps
  'THE','AND','BUT','NOT','FOR','HAS','HOW','OWN','OUT','WAY','TWO','ONE','BIG','TOP','ALL',
  'BEEN','HAVE','MAKE','MORE','MOST','MUST','NEED','ONCE','ONLY','SOME','SUCH','THAN',
  'THEN','THEY','VERY','WHAT','WHEN','WHERE','WHICH','WHILE','WILL','WITH','WORK','YEAR',
  'BUSINESS','PRODUCT','MARKET','GROWTH','BRAND','PROFIT','SALES'
]);

// Find 3-5 letter all-caps tokens that look like business codes.
const detectBusinessCodes = (text) => {
  if (!text) return [];
  const tokens = text.match(/\b[A-Z]{3,5}\b/g) || [];
  const found = new Set();
  for (const t of tokens) {
    if (BUSINESS_CODE_BLACKLIST.has(t)) continue;
    found.add(t);
  }
  return [...found];
};

// Replace every occurrence of any code in `codes` with `{BUSINESS}`.
const anonymiseCodes = (text, codes) => {
  if (!text || !codes.length) return text || '';
  let out = text;
  for (const code of codes) {
    out = out.replace(new RegExp(`\\b${code}\\b`, 'g'), '{BUSINESS}');
  }
  return out;
};

// Substitute `{BUSINESS}` placeholders with a chosen business name.
const substituteBusiness = (text, name) =>
  (text || '').replace(/\{BUSINESS\}/g, name);

// Decide a concept's category from its example_question command word.
// Drives template matching at campaign-generation time so Define prompts
// only pull from definition concepts, etc.
const detectCategory = (exampleQuestion) => {
  const q = (exampleQuestion || '').trim().toLowerCase();
  if (!q) return 'explanation';
  if (/^define\b/.test(q)) return 'definition';
  if (/^(identify|state|list|name)\b/.test(q)) return 'list';
  if (/^outline\b/.test(q)) return 'list';
  if (/^(explain|analyse|describe)\b/.test(q)) return 'explanation';
  if (/^(do\s+you\s+think|justify|discuss|evaluate|recommend|consider)\b/.test(q)) return 'evaluation';
  return 'explanation';
};

// Which template command words can use which concept categories.
// Define is strict — only true definition concepts may feed it.
const TEMPLATE_CAT_COMPAT = {
  Define:    ['definition'],
  Identify:  ['list', 'explanation', 'evaluation'],
  State:     ['list', 'explanation', 'evaluation'],
  Outline:   ['list', 'explanation', 'evaluation'],
  Describe:  ['list', 'explanation', 'evaluation'],
  Explain:   ['explanation', 'evaluation', 'list'],
  Analyse:   ['explanation', 'evaluation'],
  Justify:   ['evaluation', 'explanation'],
  Discuss:   ['evaluation', 'explanation'],
  Evaluate:  ['evaluation', 'explanation'],
  Recommend: ['evaluation', 'explanation'],
  Calculate: ['explanation', 'evaluation', 'list'],
  Suggest:   ['explanation', 'evaluation']
};

// Does this row's notes column ask for business context?
const wantsContext = (notes) =>
  /reference\s+the\s+business/i.test(notes || '');

/**
 * Build a question bank from parsed CSV rows.
 * - Auto-detects category from example_question (Define/Identify/…)
 * - Strips business codes from past-paper rows that require context and
 *   replaces them with the `{BUSINESS}` placeholder.
 * - Stores both the textbook keywords and the original difficulty/marks.
 */
export const buildQuestionBankFromCSV = (csvRows) => {
  return csvRows.map((row, idx) => {
    const difficulty = validDifficulty(row.difficulty);
    const marksRaw = parseInt(row.marks, 10);
    const marks = Number.isFinite(marksRaw) && marksRaw > 0 ? marksRaw : null;

    const explicitCategory = (row.category || '').toLowerCase().trim();
    const category = ['definition','list','explanation','evaluation'].includes(explicitCategory)
      ? explicitCategory
      : detectCategory(row.example_question);

    // Anonymise any business code that appears in the question. We look in
    // the question text (most reliable signal) and apply the same swap to
    // the answer, notes, and topic so they all stay consistent.
    const codes = detectBusinessCodes(row.example_question);
    const needsContext = wantsContext(row.notes) || codes.length > 0;

    const exampleQuestion = anonymiseCodes(row.example_question, codes);
    const modelAnswer    = anonymiseCodes(row.model_answer, codes);
    const topic          = anonymiseCodes(row.topic, codes);
    const notes          = anonymiseCodes(row.notes, codes);

    return {
      id: `concept_${Date.now()}_${idx}`,
      topic,
      modelAnswer,
      notes,
      exampleQuestion,
      preferredDifficulty: difficulty,
      preferredMarks: marks,
      category,
      requiresContext: needsContext,
      anonymised: codes.length > 0,
      anonymisedCodes: codes,
      keywords: buildKeywords(`${modelAnswer} ${topic}`)
    };
  });
};

// Map a question's leading command word to the gameplay command + marks.
const commandFromText = (text, fallbackMarks) => {
  const lower = (text || '').toLowerCase().trim();
  if (lower.startsWith('define'))                                 return { commandWord: 'Define',   marks: fallbackMarks ?? 2 };
  if (/^(identify|state|list|name)\b/.test(lower))                return { commandWord: 'Identify', marks: fallbackMarks ?? 2 };
  if (lower.startsWith('outline'))                                return { commandWord: 'Outline',  marks: fallbackMarks ?? 4 };
  if (lower.startsWith('describe'))                               return { commandWord: 'Describe', marks: fallbackMarks ?? 4 };
  if (lower.startsWith('analyse'))                                return { commandWord: 'Analyse',  marks: fallbackMarks ?? 6 };
  if (lower.startsWith('discuss'))                                return { commandWord: 'Discuss',  marks: fallbackMarks ?? 8 };
  if (lower.startsWith('evaluate'))                               return { commandWord: 'Evaluate', marks: fallbackMarks ?? 8 };
  if (lower.startsWith('recommend'))                              return { commandWord: 'Recommend',marks: fallbackMarks ?? 6 };
  if (lower.startsWith('justify') || /justify your answer/i.test(lower))
                                                                  return { commandWord: 'Justify',  marks: fallbackMarks ?? 6 };
  if (lower.startsWith('do you think'))                           return { commandWord: 'Justify',  marks: fallbackMarks ?? 6 };
  return { commandWord: 'Explain', marks: fallbackMarks ?? 6 };
};

/**
 * Generate a single playable question from a concept.
 * - For ANONYMISED past-paper concepts, we always reuse the original
 *   example_question (because the model answer is tuned to it) and just
 *   inject a fresh business name + auto context paragraph.
 * - For pristine concepts (no business code), we apply one of the templates.
 */
export const generateQuestion = (concept, forcedDifficulty = null, forcedTemplate = null) => {
  const business = pickRandom(BUSINESS_TEMPLATES);

  // Anonymised concepts MUST keep their original phrasing because the answer
  // was written for that specific question. Pristine concepts use templates.
  const useOriginalQ = concept.anonymised && concept.exampleQuestion;

  let questionText, commandWord, marks, difficulty;

  if (useOriginalQ) {
    questionText = concept.exampleQuestion;
    const cmd = commandFromText(questionText, concept.preferredMarks);
    commandWord = cmd.commandWord;
    marks       = cmd.marks;
    difficulty  = forcedDifficulty || concept.preferredDifficulty || 'HARD';
  } else if (concept.exampleQuestion && Math.random() < 0.30 && !forcedTemplate) {
    // Occasionally use the teacher's original wording for variety
    questionText = concept.exampleQuestion;
    const cmd = commandFromText(questionText, concept.preferredMarks);
    commandWord = cmd.commandWord;
    marks       = cmd.marks;
    difficulty  = forcedDifficulty || concept.preferredDifficulty || 'MEDIUM';
  } else {
    difficulty = forcedDifficulty || concept.preferredDifficulty || pickRandom(['EASY','MEDIUM','HARD','EXPERT']);
    const template = forcedTemplate || pickRandom(TEMPLATES_BY_DIFFICULTY[difficulty]);
    questionText = template.build(concept.topic, business);
    commandWord  = template.command;
    marks        = template.marks;
  }

  // Inject the picked business name into every placeholder.
  questionText            = substituteBusiness(questionText, business.name);
  const finalTopic        = substituteBusiness(concept.topic, business.name);
  const finalModelAnswer  = substituteBusiness(concept.modelAnswer, business.name);
  const finalNotes        = substituteBusiness(concept.notes, business.name);

  const requiresContext = concept.requiresContext || marks >= 4;

  return {
    id: `q_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    topic: finalTopic,
    commandWord,
    marks,
    difficulty,
    business,
    businessContext: generateBusinessContext(business),
    questionText,
    modelAnswer: finalModelAnswer,
    notes: finalNotes,
    expectedKeywords: concept.keywords,
    requiresContext
  };
};

/**
 * Build a full campaign: ~47 questions across difficulty tiers.
 * Each slot picks a template AND a category-compatible concept, so Define
 * prompts only pull from definition concepts and Explain answers don't
 * end up under Define-style questions.
 */
export const generateCampaign = (concepts) => {
  if (!concepts || concepts.length === 0) return [];

  // Group concepts by category for fast lookup
  const byCategory = { definition: [], list: [], explanation: [], evaluation: [] };
  for (const c of concepts) {
    const cat = byCategory[c.category] ? c.category : 'explanation';
    byCategory[cat].push(c);
  }

  const campaign = [];
  const tiers = [
    { difficulty: 'EASY',   count: 12 },
    { difficulty: 'MEDIUM', count: 15 },
    { difficulty: 'HARD',   count: 12 },
    { difficulty: 'EXPERT', count: 8 }
  ];

  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      // Try templates in shuffled order, pick the first one with concepts.
      const templates = [...TEMPLATES_BY_DIFFICULTY[tier.difficulty]];
      templates.sort(() => Math.random() - 0.5);

      let chosenTemplate = null, chosenConcept = null;
      for (const t of templates) {
        const compat = TEMPLATE_CAT_COMPAT[t.command] || ['explanation'];
        const pool = compat.flatMap(cat => byCategory[cat] || []);
        if (pool.length === 0) continue;
        chosenTemplate = t;
        chosenConcept  = pickRandom(pool);
        break;
      }

      // Fallback: no compatible concept for any template in this tier —
      // pick any concept and let generateQuestion decide.
      if (!chosenConcept) {
        chosenConcept = pickRandom(concepts);
        chosenTemplate = null;
      }

      campaign.push(generateQuestion(chosenConcept, tier.difficulty, chosenTemplate));
    }
  }

  return campaign;
};

// Split a student answer into discrete items.
// Per spec: separators are period, forward slash, and newline. Semicolons
// and common list-prefix markers (1. / 1) / (1) / a) / - / •) are also
// handled gracefully so the student doesn't get penalised for tidy lists.
const splitIntoSegments = (text) => {
  if (!text) return [];
  return text
    .split(/[.\n\/;]+/)
    .map(s => s
      .replace(/^\s*[\(\[]?\s*\d+\s*[\)\]\.\:]\s*/, '')   // "1.", "(1)", "1)"
      .replace(/^\s*[\(\[]?\s*[a-h]\s*[\)\]\.\:]\s*/i, '') // "a)", "(a)"
      .replace(/^[-•*\s]+/, '')                            // bullets
      .trim()
    )
    .filter(s => s.length >= 3);
};

// How many items the question asks for (Identify two, Outline three, etc.)
const detectRequiredCount = (questionText) => {
  if (!questionText) return 1;
  const m = questionText.toLowerCase().match(/\b(two|three|four|five|six|2|3|4|5|6)\b/);
  if (!m) return 1;
  const map = { two: 2, three: 3, four: 4, five: 5, six: 6 };
  return map[m[1]] || parseInt(m[1], 10) || 1;
};

const isDefineQuestion = (question) =>
  question.commandWord === 'Define' || /^\s*define\b/i.test(question.questionText || '');

// Concrete-example signals. Cambridge mark schemes credit a definition that
// is illustrated by an example, even if the abstract definition isn't spelled
// out in textbook form.
const hasExampleMarkers = (answer) => {
  if (!answer) return false;
  if (/\b(for\s+example|for\s+instance|e\.?\s*g\.?|such\s+as|like|including|imagine|suppose|when|where|if)\b/i.test(answer)) return true;
  if (/\$\s*\d|\d+\s*%|\d+\s*(dollars?|pounds?|euros?|cents?|years?|employees?|customers?|units?|items?|products?|hours?|days?|months?|kg|g|kilo)/i.test(answer)) return true;
  if (/\d+\s*(=|\+|-|–|—|to|×|\*|x)\s*\d+/.test(answer)) return true; // 5-2=3, 10 to 15, etc.
  return false;
};

const topicTouched = (answer, topic) => {
  if (!topic) return false;
  const al = (answer || '').toLowerCase();
  const tl = topic.toLowerCase();
  if (al.includes(tl)) return true;
  const tWords = tl.split(/\s+/).filter(w => w.length >= 4);
  return tWords.some(w => al.includes(w));
};

/**
 * Score the student's answer using the model answer and notes.
 * - Compares keyword coverage against the model answer
 * - For "two things" questions, splits the student's answer on . / or newline
 *   and credits per-segment
 * - For Define questions, also credits an illustrative example that
 *   demonstrates the concept (per Cambridge mark scheme practice)
 * - If the question requires context (marks>=4), bonus credit for using the
 *   business name / context details (driven by the teacher's notes column).
 */
export const scoreAnswer = (studentAnswer, question) => {
  const raw = studentAnswer || '';
  const answer = raw.toLowerCase().trim();

  if (answer.length < 5) {
    return {
      correct: false,
      pointsAwarded: 0,
      feedback: 'No answer provided. Try writing at least a sentence!',
      keywordsHit: [],
      keywordsMissed: question.expectedKeywords || [],
      suggestedAnswer: question.modelAnswer || ''
    };
  }

  const keywords = question.expectedKeywords || [];
  const keywordsHit = keywords.filter(kw => answer.includes(kw.toLowerCase()));
  const keywordsMissed = keywords.filter(kw => !keywordsHit.includes(kw));

  const totalKeywords = Math.max(keywords.length, 1);
  let coverage = keywordsHit.length / totalKeywords;

  // ── Multi-item question: "Identify two…", "Outline two…", "Explain two…" ──
  // Split the answer on the separators the user specified (. / newline) plus
  // graceful handling of semicolons and list prefixes. Each segment is checked
  // for at least one expected keyword; coverage is segments-hit / required.
  const requiredCount = detectRequiredCount(question.questionText);
  let itemsCoverage = null;
  if (requiredCount >= 2) {
    const segments = splitIntoSegments(raw);
    if (segments.length > 0) {
      const segmentsWithKeyword = segments.filter(seg => {
        const sl = seg.toLowerCase();
        return keywords.some(kw => sl.includes(kw.toLowerCase()));
      }).length;
      itemsCoverage = Math.min(1, segmentsWithKeyword / requiredCount);
      // Use whichever scoring is more generous — overall coverage or per-item.
      coverage = Math.max(coverage, itemsCoverage);
    }
  }

  // ── Define question: an illustrative example counts ──
  // Cambridge allows a definition to be evidenced by an example demonstrating
  // the concept. If the student's answer contains an example marker AND
  // touches the topic, credit them even when textbook keywords are missing.
  if (isDefineQuestion(question) && hasExampleMarkers(answer) && topicTouched(answer, question.topic)) {
    const boosted = keywordsHit.length > 0 ? 0.7 : 0.5;
    coverage = Math.max(coverage, boosted);
  }

  // Context bonus: if the question requires context and the student references the business
  let usedContext = false;
  if (question.requiresContext && question.business) {
    const bizName = question.business.name.toLowerCase();
    const bizType = question.business.type.toLowerCase();
    if (answer.includes(bizName) || answer.includes(bizType)) {
      usedContext = true;
      coverage = Math.min(1, coverage + 0.15);
    }
  }

  const gamePointsMax = getGamePoints(question.difficulty);
  let pointsAwarded = 0;
  let correct = false;
  let feedback = '';

  if (coverage >= 0.6) {
    pointsAwarded = gamePointsMax;
    correct = true;
    feedback = `Excellent answer on ${question.topic}.${usedContext ? ' Good use of the business context!' : ''}`;
  } else if (coverage >= 0.3) {
    pointsAwarded = Math.floor(gamePointsMax * 0.5);
    correct = true;
    feedback = `Partial credit. You touched on ${question.topic} but could develop your answer further.`;
    if (question.requiresContext && !usedContext) {
      feedback += ' Tip: reference the business by name to earn context marks.';
    }
  } else {
    pointsAwarded = 0;
    correct = false;
    feedback = generateLearningFeedback(question);
  }

  return {
    correct,
    pointsAwarded,
    feedback,
    keywordsHit,
    keywordsMissed: keywordsMissed.slice(0, 4),
    suggestedAnswer: question.modelAnswer || '',
    markingNotes: question.notes || ''
  };
};

const getGamePoints = (difficulty) => ({
  EASY: 40, MEDIUM: 60, HARD: 100, EXPERT: 160
}[difficulty] || 50);

const generateLearningFeedback = (question) => {
  const cmd = question.commandWord;
  const base = {
    Define: 'DEFINE wants the meaning of the term. A precise definition is best, but a clear example demonstrating the concept (e.g. with numbers) also earns marks.',
    Identify: 'IDENTIFY asks for clear items, listed in short form. Separate each item with a full stop, "/" or a new line.',
    State: 'STATE asks you to list items briefly without explanation. Separate each item with a full stop, "/" or a new line.',
    Outline: 'OUTLINE means short reasons or steps. Reference the business for full marks.',
    Describe: 'DESCRIBE asks you to give detail about how/what happens.',
    Explain: 'EXPLAIN needs methods/reasons AND development with cause-and-effect chains.',
    Analyse: 'ANALYSE means break the topic down and explore impacts on the business.',
    Justify: 'JUSTIFY needs a clear position, with reasons WHY it is best (and why alternatives are weaker).',
    Discuss: 'DISCUSS needs both sides — strengths and weaknesses — then a judgement.',
    Evaluate: 'EVALUATE needs strengths, weaknesses, and a reasoned conclusion using context.',
    Recommend: 'RECOMMEND needs a clear choice with developed reasons linked to the business.'
  }[cmd] || 'Review the key concepts and try again.';
  return base;
};

export const calculateStealAmount = (victimScore, difficulty) => {
  const pct = { EASY: 0.1, MEDIUM: 0.15, HARD: 0.2, EXPERT: 0.3 }[difficulty] || 0.15;
  const cap = { EASY: 30, MEDIUM: 50, HARD: 80, EXPERT: 120 }[difficulty] || 50;
  return Math.min(Math.floor(victimScore * pct), cap);
};
