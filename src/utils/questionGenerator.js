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

// Only the 5 command words actually used in the IGCSE Business paper:
// Define · Identify · Outline · Explain · Justify
const TEMPLATES_BY_DIFFICULTY = {
  EASY: [
    { command: 'Define',   marks: 2, build: (t) => `Define '${t}'.` },
    { command: 'Identify', marks: 2, build: (t) => `Identify two ${t}.` },
    { command: 'Identify', marks: 2, build: (t) => `Identify two examples of ${t}.` }
  ],
  MEDIUM: [
    { command: 'Outline', marks: 3, build: (t, b) => `Outline one example of ${t} for ${b.name}.` },
    { command: 'Outline', marks: 4, build: (t) => `Outline two types of ${t}.` },
    { command: 'Outline', marks: 4, build: (t, b) => `Outline how ${t} could be used by ${b.name}.` }
  ],
  HARD: [
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two ${t} that ${b.name} could use.` },
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two advantages of ${t} for ${b.name}.` },
    { command: 'Explain', marks: 6, build: (t, b) => `Explain two disadvantages of ${t} for ${b.name}.` },
    { command: 'Explain', marks: 6, build: (t, b) => `Explain how ${t} might affect ${b.name}.` }
  ],
  EXPERT: [
    { command: 'Justify', marks: 6, build: (t, b) => `Do you think ${t} is the best approach for ${b.name}? Justify your answer.` },
    { command: 'Justify', marks: 6, build: (t, b) => `Do you think ${b.name} should focus on ${t}? Justify your answer.` },
    { command: 'Justify', marks: 8, build: (t, b) => `Do you think ${b.name} should rely on ${t}? Justify your answer.` }
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
// Only the 5 actual IGCSE Business command words. Define is strict —
// only true definition concepts may feed it.
const TEMPLATE_CAT_COMPAT = {
  Define:   ['definition'],
  Identify: ['list', 'explanation', 'evaluation'],
  Outline:  ['list', 'explanation', 'evaluation'],
  Explain:  ['explanation', 'evaluation', 'list'],
  Justify:  ['evaluation', 'explanation']
};

// Does this row's notes column ask for business context?
const wantsContext = (notes) =>
  /reference\s+the\s+business/i.test(notes || '');

// PDF extraction often pulls in the printed instruction
// "DO NOT WRITE IN THE/THIS MARGIN(S)" from the answer booklet. Strip it
// wherever it appears in questions, answers, notes or topic. Also strip
// orphaned "Question s" or "Marks Answer" table headers that sometimes
// bleed through from the mark-scheme PDF.
const cleanPdfArtifacts = (text) => {
  if (!text) return text || '';
  return text
    .replace(/\bDO\s+NOT\s+WRITE\s+IN\s+(?:THE|THIS|ANY)?\s*MARGINS?\.?/gi, '')
    .replace(/\bDO\s+NOT\s+WRITE\s+IN\s+MARGIN[S]?\.?/gi, '')
    // Common mark-scheme header debris
    .replace(/\bQuestion\s+s\b/g, '')
    .replace(/\bMarks?\s+Answer\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// A topic is "junk" if it's empty, punctuation-only, or just a question marker
// like "1a" / "X" — these produce questions like `Define '.'` or
// `Identify two examples of .` that confuse students.
const isJunkTopic = (topic) => {
  if (!topic) return true;
  const t = topic.trim();
  if (t.length < 2) return true;
  if (/^[\s.,!?'"\-:;()]+$/.test(t)) return true;       // only punctuation
  if (/^\d+[a-h]?$/i.test(t)) return true;              // e.g. "1a", "12"
  if (/^[xy]$/i.test(t)) return true;                   // bare X / Y placeholders
  return false;
};

// Derive a clean topic label from an example question. Mirrors the same
// logic in csvParser.js so built-in JSON rows (which only have
// example_question, no separate topic column) get a usable topic too.
const deriveTopicFromQuestion = (q) => {
  if (!q) return '';
  // Define 'Term' or Define "Term"
  let m = q.match(/^define\s+['"]([^'"]+)['"]/i);
  if (m) return m[1].trim();
  // Identify/State/List/Name [number] <topic>
  m = q.match(/^(?:identify|state|list|name)\s+(?:two|one|four|three|several|the\s+\w+)?\s*(.+?)(?:\.|,|$)/i);
  if (m) return m[1].trim();
  // Outline [number] <topic>
  m = q.match(/^outline\s+(?:two|one|four|three)?\s*(.+?)(?:\.|,|$)/i);
  if (m) return m[1].trim();
  // Explain [number] <topic>
  m = q.match(/^explain\s+(?:(?:two|one|four|three)\s+)?(.+?)(?:\.|,|$)/i);
  if (m) return m[1].trim();
  // Do you think <topic> is/are …
  m = q.match(/^do you think\s+(.+?)\s+(?:is|are|was|were)\b/i);
  if (m) return m[1].trim();
  return q.slice(0, 60).replace(/[.,?!]$/, '').trim();
};

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

    // IGCSE Business has 6 syllabus units. Tag each concept so the teacher
    // can later filter the game by unit.
    const unitRaw = parseInt(row.unit, 10);
    const unit = Number.isFinite(unitRaw) && unitRaw >= 1 && unitRaw <= 6 ? unitRaw : null;

    const explicitCategory = (row.category || '').toLowerCase().trim();
    const category = ['definition','list','explanation','evaluation'].includes(explicitCategory)
      ? explicitCategory
      : detectCategory(row.example_question);

    // Strip PDF artifacts (e.g. "DO NOT WRITE IN THE MARGIN") BEFORE
    // detecting business codes, so we don't accidentally anonymise text
    // inside the artifact and end up with "DO NOT TKD IN TKD MARGIN".
    const cleanQ     = cleanPdfArtifacts(row.example_question);
    const cleanA     = cleanPdfArtifacts(row.model_answer);
    // Bundled JSON rows from past-paper / generated CSVs only have an
    // example_question — derive the topic from it. Uploaded CSVs that
    // include an explicit `topic` column keep theirs.
    const rawTopic   = row.topic && row.topic.trim()
      ? row.topic
      : deriveTopicFromQuestion(cleanQ);
    const cleanTopic = cleanPdfArtifacts(rawTopic);
    const cleanNotes = cleanPdfArtifacts(row.notes);

    // Anonymise any business code that appears in the question. We look in
    // the question text (most reliable signal) and apply the same swap to
    // the answer, notes, and topic so they all stay consistent.
    const codes = detectBusinessCodes(cleanQ);
    const needsContext = wantsContext(cleanNotes) || codes.length > 0;

    const exampleQuestion = anonymiseCodes(cleanQ, codes);
    const modelAnswer     = anonymiseCodes(cleanA, codes);
    const topic           = anonymiseCodes(cleanTopic, codes);
    const notes           = anonymiseCodes(cleanNotes, codes);

    return {
      id: `concept_${Date.now()}_${idx}`,
      topic,
      modelAnswer,
      notes,
      exampleQuestion,
      preferredDifficulty: difficulty,
      preferredMarks: marks,
      category,
      unit,
      requiresContext: needsContext,
      anonymised: codes.length > 0,
      anonymisedCodes: codes,
      keywords: buildKeywords(`${modelAnswer} ${topic}`)
    };
  }).filter(c => {
    // Drop concepts that can't produce a usable question.
    // 1) Junk topic → would render as `Define '.'` / `Identify two examples of .`
    if (isJunkTopic(c.topic)) return false;
    // 2) Definition / list concepts NEED a model answer — that IS the answer
    //    shown when a student gets it wrong. Without it the feedback panel
    //    is useless. Outline/Explain/Justify can survive a weak model answer
    //    because the question itself carries most of the learning.
    if ((c.category === 'definition' || c.category === 'list')
        && (!c.modelAnswer || c.modelAnswer.trim().length < 5)) return false;
    return true;
  });
};

// IGCSE Business syllabus unit labels (used by the teacher dashboard)
export const UNIT_LABELS = {
  1: 'Understanding business activity',
  2: 'People in business',
  3: 'Marketing',
  4: 'Operations management',
  5: 'Financial information and decisions',
  6: 'External influences on business activity'
};

// Map a question's leading command word to the gameplay command + marks.
// Past papers occasionally use Describe / State / Analyse / Discuss / etc;
// we collapse those into the 5 command words actually used in the exam:
//   Define · Identify · Outline · Explain · Justify
const commandFromText = (text, fallbackMarks) => {
  const lower = (text || '').toLowerCase().trim();
  if (lower.startsWith('define'))                                 return { commandWord: 'Define',   marks: fallbackMarks ?? 2 };
  if (/^(identify|state|list|name)\b/.test(lower))                return { commandWord: 'Identify', marks: fallbackMarks ?? 2 };
  if (/^(outline|describe)\b/.test(lower))                        return { commandWord: 'Outline',  marks: fallbackMarks ?? 4 };
  if (/^(explain|analyse|analyze)\b/.test(lower))                 return { commandWord: 'Explain',  marks: fallbackMarks ?? 6 };
  if (lower.startsWith('justify') || /justify your answer/i.test(lower))
                                                                  return { commandWord: 'Justify',  marks: fallbackMarks ?? 6 };
  if (/^(discuss|evaluate|recommend|consider|do you think)\b/.test(lower))
                                                                  return { commandWord: 'Justify',  marks: fallbackMarks ?? 6 };
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
 *
 * options.unitFilter — optional array of syllabus units (1..6). If
 * non-empty, only concepts tagged with one of those units are eligible;
 * concepts with no unit tag are excluded.
 */
export const generateCampaign = (concepts, options = {}) => {
  if (!concepts || concepts.length === 0) return [];

  const { unitFilter = null } = options;
  let pool = concepts;
  if (Array.isArray(unitFilter) && unitFilter.length > 0) {
    const allowed = new Set(unitFilter.map(Number));
    pool = concepts.filter(c => c.unit && allowed.has(c.unit));
    if (pool.length === 0) return []; // unit selection has no content
  }

  // Group concepts by category for fast lookup
  const byCategory = { definition: [], list: [], explanation: [], evaluation: [] };
  for (const c of pool) {
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
        const matched = compat.flatMap(cat => byCategory[cat] || []);
        if (matched.length === 0) continue;
        chosenTemplate = t;
        chosenConcept  = pickRandom(matched);
        break;
      }

      // Fallback: no compatible concept for any template in this tier —
      // pick any concept from the (already unit-filtered) pool.
      if (!chosenConcept) {
        chosenConcept = pickRandom(pool);
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
 * Score the student's answer using semantic concept matching.
 *
 * Uses ../utils/semanticMarker.js to:
 *   • Stem every word (fires/fired/firing → fire)
 *   • Map synonyms to a canonical token (sack/dismiss/terminate → fire)
 *   • Preserve multi-word business terms ("limited liability") as one concept
 *   • Strip concept tokens that appear after a negation word
 *
 * Per question type:
 *   • Define   — paraphrase OR concrete example, must touch the topic
 *   • Identify — split model into list items, match each student segment
 *                against ANY model item by canonical-token overlap
 *   • Outline  — multi-item identify-style, plus development bonus
 *   • Explain  — overall concept coverage with multi-segment bonus
 *   • Justify  — overall concept coverage; both sides earn marks
 *
 * Returns the same shape FeedbackModal already consumes, with extra
 * `keywordsHit` / `keywordsMissed` arrays built from the matched
 * canonical concepts (more useful than the old keyword list).
 */
import {
  markAnswer as semanticMark,
  countAnalysisLinks,
  countContrastMarkers,
  hasJudgement,
  specificityScore,
  lengthAdequacy,
  isCircularDefinition
} from './semanticMarker';

/**
 * Score a student answer in the style of a Cambridge IGCSE examiner.
 *
 * Independent AO-style signals → targeted feedback.
 *   AO1 Knowledge   ← semantic concept overlap
 *   AO2 Application ← business name/type references
 *   AO3 Analysis    ← cause-and-effect connectors (Explain/Justify)
 *   AO4 Evaluation  ← contrast markers + judgement (Justify)
 *
 *  + Length adequacy caps final mark for short answers
 *  + Specificity bonus for numbers, real firms, examples
 *  + Circular-definition penalty for tautologies
 */
export const scoreAnswer = (studentAnswer, question) => {
  const raw = (studentAnswer || '').trim();
  const fullMarks = question.marks && question.marks > 0 ? question.marks : 4;

  if (raw.length < 5) {
    return zeroMarkResult(question, 'No answer provided. Try writing at least a sentence!');
  }

  const cmd = question.commandWord || '';
  const sem = semanticMark(raw, question);
  let coverage = sem.coverage || 0;
  const issues = [];

  // ── AO2 Application — referenced the business? ──
  let usedContext = false;
  if (question.business) {
    const lower = raw.toLowerCase();
    const bizName = (question.business.name || '').toLowerCase();
    const bizType = (question.business.type || '').toLowerCase();
    if ((bizName && lower.includes(bizName)) || (bizType && lower.includes(bizType))) {
      usedContext = true;
      if (['Outline', 'Explain', 'Justify'].includes(cmd)) {
        coverage = Math.min(1, coverage + 0.12);
      }
    }
  }
  if (question.requiresContext && !usedContext && ['Outline', 'Explain', 'Justify'].includes(cmd)) {
    issues.push('No business context — reference the business by name for application marks.');
  }

  // ── AO3 Analysis — cause-and-effect for Explain/Justify ──
  const analysisLinks = countAnalysisLinks(raw);
  if (cmd === 'Explain' || cmd === 'Justify') {
    if (analysisLinks >= 2) coverage = Math.min(1, coverage + 0.12);
    else if (analysisLinks === 1) coverage = Math.min(1, coverage + 0.05);
    else if (coverage >= 0.3) {
      issues.push('You identified the point but didn\'t develop it. Use "because", "so" or "which means" to link cause to effect.');
      coverage = Math.min(coverage, 0.55);
    }
  }

  // ── AO4 Evaluation — Justify needs contrast + judgement ──
  if (cmd === 'Justify') {
    const contrasts = countContrastMarkers(raw);
    const judged = hasJudgement(raw);
    if (contrasts >= 1 && judged) coverage = Math.min(1, coverage + 0.15);
    else {
      if (contrasts === 0 && coverage >= 0.3) {
        issues.push('Add a counter-argument ("However…") for evaluation marks.');
        coverage = Math.min(coverage, 0.6);
      }
      if (!judged && coverage >= 0.3) {
        issues.push('End with a clear judgement — "Overall I think… because…".');
        coverage = Math.min(coverage, 0.65);
      }
    }
  }

  // ── Specificity bonus ──
  const spec = specificityScore(raw);
  if (spec >= 2) coverage = Math.min(1, coverage + 0.06);
  else if (spec >= 1) coverage = Math.min(1, coverage + 0.03);

  // ── Circular definition penalty ──
  if (cmd === 'Define' && isCircularDefinition(raw, question.topic)) {
    coverage = 0;
    issues.unshift('You restated the term instead of defining it. Explain in your own words or give an example.');
  }

  // ── Length cap for high-mark questions ──
  const lenAd = lengthAdequacy(raw, fullMarks);
  if (lenAd < 0.5 && fullMarks >= 4) {
    coverage = Math.min(coverage, lenAd + 0.4);
    if (cmd !== 'Define' && cmd !== 'Identify') {
      issues.push(`Your answer is too short for a ${fullMarks}-mark question. Develop each point with more detail.`);
    }
  }

  // ── Identify item-count feedback ──
  if (sem.mode === 'identify' && sem.matchedItems) {
    const matched = sem.matchedItems.length;
    const need = sem.requiredCount || 1;
    if (matched < need) {
      issues.push(`You gave ${matched} of ${need} required items. Add ${need - matched} more.`);
    }
  }

  // ── Coverage → marks (out of question's mark scheme) ──
  let marksAwarded = Math.round(coverage * fullMarks);
  if (coverage < 0.15) marksAwarded = 0;

  const gamePointsMax = getGamePoints(question.difficulty);
  const pointsAwarded = Math.round(gamePointsMax * (marksAwarded / fullMarks));
  const correct = marksAwarded > 0;

  let feedback;
  if (marksAwarded === fullMarks) {
    feedback = `Full marks — ${marksAwarded}/${fullMarks}. ${usedContext ? 'Strong use of business context.' : 'Sharp, focused answer.'}`;
  } else if (marksAwarded >= Math.ceil(fullMarks / 2)) {
    feedback = `${marksAwarded}/${fullMarks} marks. ${issues[0] || 'Good ideas — develop them further next time.'}`;
  } else if (marksAwarded > 0) {
    feedback = `${marksAwarded}/${fullMarks} marks. ${issues[0] || 'On the right track but missing key elements.'}`;
  } else {
    feedback = `0/${fullMarks} marks. ${issues[0] || generateLearningFeedback(question)}`;
  }

  const hitList = (sem.hits || []).slice(0, 6);
  const missingList = (sem.missing || []).slice(0, 6);
  const surfacedAnswer = question.modelAnswer && question.modelAnswer.trim().length > 5
    ? question.modelAnswer
    : (!correct ? buildFallbackAnswer(question) : '');

  return {
    correct,
    pointsAwarded,
    marksAwarded,
    fullMarks,
    coverage,
    mode: sem.mode,
    feedback,
    examinerNotes: issues.slice(0, 3),
    analysisLinks,
    usedContext,
    keywordsHit: hitList,
    keywordsMissed: missingList,
    matchedItems: sem.matchedItems || null,
    suggestedAnswer: surfacedAnswer,
    markingNotes: question.notes || ''
  };
};

const zeroMarkResult = (question, msg) => ({
  correct: false,
  pointsAwarded: 0,
  marksAwarded: 0,
  fullMarks: question.marks || 4,
  coverage: 0,
  feedback: msg,
  examinerNotes: [],
  keywordsHit: [],
  keywordsMissed: [],
  suggestedAnswer: question.modelAnswer && question.modelAnswer.trim().length > 5
    ? question.modelAnswer
    : buildFallbackAnswer(question)
});

const buildFallbackAnswer = (question) => {
  const topic = question.topic || 'the concept';
  switch (question.commandWord) {
    case 'Define':
      return `A precise definition of "${topic}" — explain in your own words what it means, and where helpful give a short example (e.g. with numbers or a real situation).`;
    case 'Identify':
      return `List clear, distinct examples of ${topic}. The mark scheme wants short, specific items (no full sentences).`;
    case 'Outline':
      return `Two short reasons or examples of ${topic}, each with one developed point (cause → effect) referencing the business.`;
    case 'Explain':
      return `Two reasons relating to ${topic}, each developed with a cause-and-effect chain that links the point to the business context (use the business name).`;
    case 'Justify':
      return `Argue for or against ${topic}: give 2 points on each side, then a final judgement that says which is stronger and why for this business.`;
    default:
      return `Develop an answer focused on ${topic} — give clear points and link each to the business.`;
  }
};

const getGamePoints = (difficulty) => ({
  EASY: 40, MEDIUM: 60, HARD: 100, EXPERT: 160
}[difficulty] || 50);

const generateLearningFeedback = (question) => {
  const cmd = question.commandWord;
  const base = {
    Define:   'DEFINE wants the meaning of the term. A precise definition is best, but a clear example demonstrating the concept (e.g. with numbers) also earns marks.',
    Identify: 'IDENTIFY asks for clear items, listed in short form. Separate each item with a full stop, "/" or a new line.',
    Outline:  'OUTLINE means short reasons or steps with a brief development. Reference the business for full marks. Separate each point with "." "/" or a new line.',
    Explain:  'EXPLAIN needs methods/reasons AND development with cause-and-effect chains. Reference the business for full marks. Separate each point with "." "/" or a new line.',
    Justify:  'JUSTIFY needs a clear position, with reasons WHY it is best AND why alternatives are weaker. Both sides for full marks.'
  }[cmd] || 'Review the key concepts and try again.';
  return base;
};

export const calculateStealAmount = (victimScore, difficulty) => {
  const pct = { EASY: 0.1, MEDIUM: 0.15, HARD: 0.2, EXPERT: 0.3 }[difficulty] || 0.15;
  const cap = { EASY: 30, MEDIUM: 50, HARD: 80, EXPERT: 120 }[difficulty] || 50;
  return Math.min(Math.floor(victimScore * pct), cap);
};
