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

/**
 * Build a question bank from parsed CSV rows.
 * Each row becomes a CONCEPT (topic + answer + notes + optional example).
 */
export const buildQuestionBankFromCSV = (csvRows) => {
  return csvRows.map((row, idx) => {
    const difficulty = validDifficulty(row.difficulty);
    // Pick up an explicit marks column from PDF-derived CSVs. Falls back to
    // null so generateQuestion can decide a sensible default per template.
    const marksRaw = parseInt(row.marks, 10);
    const marks = Number.isFinite(marksRaw) && marksRaw > 0 ? marksRaw : null;
    return {
      id: `concept_${Date.now()}_${idx}`,
      topic: row.topic,
      modelAnswer: row.model_answer,
      notes: row.notes || '',
      exampleQuestion: row.example_question || '',
      preferredDifficulty: difficulty,
      preferredMarks: marks,
      keywords: buildKeywords(`${row.model_answer} ${row.topic}`)
    };
  });
};

/**
 * Generate a single varied question from a concept.
 */
export const generateQuestion = (concept, forcedDifficulty = null) => {
  const business = pickRandom(BUSINESS_TEMPLATES);
  const difficulty = forcedDifficulty || concept.preferredDifficulty || pickRandom(['EASY', 'MEDIUM', 'HARD', 'EXPERT']);

  // ~25% of the time, use the teacher's original example question (with business name swap)
  let questionText, commandWord, marks;
  if (concept.exampleQuestion && Math.random() < 0.25) {
    questionText = concept.exampleQuestion.replace(/\b[A-Z]{2,5}\b/g, business.name);
    const lower = questionText.toLowerCase();
    if (lower.startsWith('define')) { commandWord = 'Define'; marks = 2; }
    else if (lower.startsWith('identify') || lower.startsWith('state')) { commandWord = 'Identify'; marks = 2; }
    else if (lower.startsWith('outline')) { commandWord = 'Outline'; marks = 4; }
    else if (lower.startsWith('justify') || lower.includes('justify your answer')) { commandWord = 'Justify'; marks = 6; }
    else if (lower.startsWith('discuss')) { commandWord = 'Discuss'; marks = 8; }
    else if (lower.startsWith('evaluate')) { commandWord = 'Evaluate'; marks = 8; }
    else { commandWord = 'Explain'; marks = 6; }
  } else {
    const template = pickRandom(TEMPLATES_BY_DIFFICULTY[difficulty]);
    questionText = template.build(concept.topic, business);
    commandWord = template.command;
    marks = template.marks;
  }

  // If the concept came from a PDF with explicit marks AND we used the
  // teacher's example_question (which preserves the original marks intent),
  // prefer that. Templated questions keep their template marks.
  const finalMarks = (concept.preferredMarks && questionText === concept.exampleQuestion?.replace(/\b[A-Z]{2,5}\b/g, business.name))
    ? concept.preferredMarks
    : marks;

  return {
    id: `q_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
    topic: concept.topic,
    commandWord,
    marks: finalMarks,
    difficulty,
    business,
    businessContext: generateBusinessContext(business),
    questionText,
    modelAnswer: concept.modelAnswer,
    notes: concept.notes,
    expectedKeywords: concept.keywords,
    requiresContext: finalMarks >= 4
  };
};

/**
 * Build a full campaign: ~47 questions across difficulty tiers.
 * Each concept contributes questions across difficulties so the same topic
 * gets tested in multiple ways.
 */
export const generateCampaign = (concepts) => {
  if (!concepts || concepts.length === 0) return [];

  const campaign = [];
  const tiers = [
    { difficulty: 'EASY', count: 12 },
    { difficulty: 'MEDIUM', count: 15 },
    { difficulty: 'HARD', count: 12 },
    { difficulty: 'EXPERT', count: 8 }
  ];

  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const concept = pickRandom(concepts);
      campaign.push(generateQuestion(concept, tier.difficulty));
    }
  }

  // Shuffle within difficulty tiers so the same topic doesn't repeat back-to-back
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
