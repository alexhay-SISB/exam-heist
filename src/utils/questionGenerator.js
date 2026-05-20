/**
 * Question Generation Engine
 * Takes extracted concepts from PDFs and generates new questions
 * with varied business scenarios so students learn concepts,
 * not memorize specific exam questions.
 */

// Alternative business scenarios for variation
const BUSINESS_TEMPLATES = [
  { name: 'BRX', type: 'bookshop', sector: 'tertiary', size: 'small', employees: 4, years: 5, feature: 'family-owned' },
  { name: 'CLM', type: 'clothing manufacturer', sector: 'secondary', size: 'medium', employees: 150, years: 12, feature: 'export-focused' },
  { name: 'GFT', type: 'gift shop', sector: 'tertiary', size: 'small', employees: 3, years: 7, feature: 'niche-handmade' },
  { name: 'MPC', type: 'mobile phone company', sector: 'tertiary', size: 'large', employees: 5000, years: 20, feature: 'national-coverage' },
  { name: 'RST', type: 'restaurant chain', sector: 'tertiary', size: 'large', employees: 800, years: 25, feature: 'multi-location' },
  { name: 'TKD', type: 'toy manufacturer', sector: 'secondary', size: 'medium', employees: 200, years: 15, feature: 'expanding-globally' },
  { name: 'ECT', type: 'electronics retailer', sector: 'tertiary', size: 'medium', employees: 60, years: 10, feature: 'online-and-physical' },
  { name: 'FRM', type: 'organic farm', sector: 'primary', size: 'small', employees: 8, years: 18, feature: 'sustainable' },
  { name: 'SLN', type: 'beauty salon', sector: 'tertiary', size: 'small', employees: 5, years: 4, feature: 'premium-service' },
  { name: 'CNS', type: 'construction firm', sector: 'secondary', size: 'large', employees: 2500, years: 35, feature: 'commercial-projects' },
  { name: 'BKR', type: 'bakery', sector: 'secondary', size: 'small', employees: 7, years: 3, feature: 'artisan' },
  { name: 'TRV', type: 'travel agency', sector: 'tertiary', size: 'medium', employees: 45, years: 22, feature: 'specialist-holidays' },
  { name: 'GYM', type: 'fitness gym', sector: 'tertiary', size: 'medium', employees: 35, years: 8, feature: 'subscription-model' },
  { name: 'FRN', type: 'furniture maker', sector: 'secondary', size: 'small', employees: 12, years: 30, feature: 'handcrafted' },
  { name: 'PHR', type: 'pharmacy chain', sector: 'tertiary', size: 'large', employees: 1200, years: 40, feature: 'multi-branch' },
  { name: 'CAR', type: 'car dealership', sector: 'tertiary', size: 'medium', employees: 80, years: 15, feature: 'luxury-brands' },
  { name: 'JWL', type: 'jewellery designer', sector: 'secondary', size: 'small', employees: 6, years: 11, feature: 'bespoke-orders' },
  { name: 'WEB', type: 'web design agency', sector: 'tertiary', size: 'small', employees: 14, years: 6, feature: 'B2B-clients' }
];

/**
 * Generate a varied question from a concept extracted from PDFs
 */
export const generateQuestion = (concept, conceptDatabase, randomSeed = Math.random()) => {
  // Pick a random business scenario for context
  const businessIndex = Math.floor(randomSeed * BUSINESS_TEMPLATES.length);
  const business = BUSINESS_TEMPLATES[businessIndex];

  // Generate business context paragraph
  const context = generateBusinessContext(business, concept);

  // Generate question stem based on command word
  const questionText = buildQuestionText(concept, business);

  return {
    id: `q_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    concept: concept.topic,
    commandWord: concept.commandWord,
    marks: concept.marks,
    difficulty: concept.difficulty,
    businessContext: context,
    business: business,
    questionText: questionText,
    expectedKeywords: concept.expectedKeywords || [],
    acceptableAnswers: concept.acceptableAnswers || [],
    explanation: concept.explanation || ''
  };
};

const generateBusinessContext = (business, concept) => {
  const sizeDesc = business.size === 'small' ? 'small' :
                   business.size === 'medium' ? 'medium-sized' : 'large';

  let context = `${business.name} is a ${sizeDesc} ${business.type}`;

  if (business.sector === 'secondary') {
    context += ' operating in the secondary sector';
  } else if (business.sector === 'tertiary') {
    context += ' operating in the service sector';
  } else if (business.sector === 'primary') {
    context += ' operating in the primary sector';
  }

  context += `. It has ${business.employees} employees`;
  context += ` and has been in business for ${business.years} years.`;

  // Add concept-specific detail
  if (concept.topic.includes('motivation')) {
    context += ` The owners want to find ways to motivate the workforce.`;
  } else if (concept.topic.includes('recruitment')) {
    context += ` The business is planning to expand and needs to hire new employees.`;
  } else if (concept.topic.includes('leadership')) {
    context += ` The managers are considering which leadership style to adopt.`;
  } else if (concept.topic.includes('quality')) {
    context += ` Maintaining high quality is essential for the business.`;
  } else if (concept.topic.includes('market')) {
    context += ` The business operates in a competitive market.`;
  } else if (concept.topic.includes('communication')) {
    context += ` Good communication is vital for operations.`;
  } else if (concept.topic.includes('objective')) {
    context += ` The business has recently reviewed its objectives.`;
  } else if (concept.topic.includes('span of control')) {
    context += ` The management structure is being reviewed.`;
  }

  return context;
};

const buildQuestionText = (concept, business) => {
  const cmd = concept.commandWord || 'Explain';
  const topic = concept.topic;

  switch (cmd) {
    case 'Define':
      return `Define '${topic}'.`;

    case 'Identify':
      const n = concept.marks || 2;
      return `Identify ${numberWord(n)} ${topic}.`;

    case 'Outline':
      return `Outline two ${topic} for ${business.name}.`;

    case 'Explain':
      return `Explain two ${topic} that ${business.name} could use.`;

    case 'Justify':
      return `Do you think ${topic} is the best approach for ${business.name}? Justify your answer.`;

    default:
      return `${cmd} ${topic} for ${business.name}.`;
  }
};

const numberWord = (n) => {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five'];
  return words[n] || n.toString();
};

/**
 * Build a question bank from parsed exam data
 */
export const buildQuestionBank = (parsedExam, parsedAnswers) => {
  const concepts = [];

  parsedExam.forEach((caseStudy) => {
    caseStudy.questions.forEach((q) => {
      const answerKey = `${caseStudy.caseStudyNumber}${q.subQuestion}`;
      const answer = parsedAnswers[answerKey];

      concepts.push({
        topic: q.concept,
        commandWord: q.commandWord,
        marks: q.marks,
        difficulty: q.difficulty,
        originalQuestion: q.questionText,
        originalContext: caseStudy.businessContext.rawText,
        expectedKeywords: answer ? answer.keywords : [],
        acceptableAnswers: answer ? answer.acceptableAnswers : [],
        partialCreditNotes: answer ? answer.partialCreditNotes : null,
        requiresContext: q.requiresContext
      });
    });
  });

  return concepts;
};

/**
 * Generate a campaign worth of questions (50-60 questions)
 * Mixed across difficulty tiers
 */
export const generateCampaign = (questionBank) => {
  if (!questionBank || questionBank.length === 0) {
    return [];
  }

  const campaign = [];
  const byDifficulty = {
    EASY: questionBank.filter(q => q.difficulty === 'EASY'),
    MEDIUM: questionBank.filter(q => q.difficulty === 'MEDIUM'),
    HARD: questionBank.filter(q => q.difficulty === 'HARD'),
    EXPERT: questionBank.filter(q => q.difficulty === 'EXPERT')
  };

  // Helper: generate N questions from a concept pool
  const generateFromPool = (pool, count) => {
    if (pool.length === 0) return [];
    const questions = [];
    for (let i = 0; i < count; i++) {
      const concept = pool[Math.floor(Math.random() * pool.length)];
      questions.push(generateQuestion(concept, questionBank, Math.random()));
    }
    return questions;
  };

  // Easy tier: 12 questions
  campaign.push(...generateFromPool(byDifficulty.EASY, 12));

  // Medium tier: 15 questions
  campaign.push(...generateFromPool(byDifficulty.MEDIUM, 15));

  // Hard tier: 12 questions
  campaign.push(...generateFromPool(byDifficulty.HARD, 12));

  // Expert tier: 8 questions
  campaign.push(...generateFromPool(byDifficulty.EXPERT, 8));

  // Fill in if any pools are empty by using available pools
  while (campaign.length < 40) {
    const allPools = Object.values(byDifficulty).filter(p => p.length > 0);
    if (allPools.length === 0) break;
    const pool = allPools[Math.floor(Math.random() * allPools.length)];
    const concept = pool[Math.floor(Math.random() * pool.length)];
    campaign.push(generateQuestion(concept, questionBank, Math.random()));
  }

  return campaign;
};

/**
 * Score a student's answer against expected keywords
 * Returns points awarded and feedback
 */
export const scoreAnswer = (studentAnswer, question) => {
  const answer = studentAnswer.toLowerCase().trim();

  if (answer.length < 3) {
    return {
      correct: false,
      pointsAwarded: 0,
      feedback: 'No answer provided. Try writing at least a sentence!',
      keywordsHit: [],
      keywordsMissed: question.expectedKeywords
    };
  }

  // Check how many expected keywords are present
  const keywordsHit = [];
  const keywordsMissed = [];

  question.expectedKeywords.forEach(kw => {
    const cleanKw = kw.toLowerCase().replace(/[^\w\s]/g, '').trim();
    if (cleanKw.length === 0) return;

    // Check if main words of keyword appear
    const mainWords = cleanKw.split(/\s+/).filter(w => w.length > 3);
    const hits = mainWords.filter(w => answer.includes(w));

    if (hits.length >= Math.ceil(mainWords.length * 0.5)) {
      keywordsHit.push(kw);
    } else {
      keywordsMissed.push(kw);
    }
  });

  // Score based on keyword coverage
  const totalKeywords = question.expectedKeywords.length || 1;
  const coverage = keywordsHit.length / totalKeywords;

  let pointsAwarded = 0;
  let correct = false;
  let feedback = '';

  // Calculate game points based on difficulty
  const gamePointsMax = getGamePoints(question.difficulty);

  if (coverage >= 0.6) {
    pointsAwarded = gamePointsMax;
    correct = true;
    feedback = `Excellent! You demonstrated good understanding of ${question.concept}.`;
  } else if (coverage >= 0.3) {
    pointsAwarded = Math.floor(gamePointsMax * 0.5);
    correct = true;
    feedback = `Partial credit. You touched on the topic but could develop your answer further.`;
  } else {
    pointsAwarded = 0;
    correct = false;
    feedback = generateLearningFeedback(question, studentAnswer);
  }

  return {
    correct,
    pointsAwarded,
    feedback,
    keywordsHit,
    keywordsMissed: keywordsMissed.slice(0, 3),
    suggestedAnswer: question.acceptableAnswers[0] || ''
  };
};

const getGamePoints = (difficulty) => {
  const points = {
    EASY: 40,
    MEDIUM: 60,
    HARD: 100,
    EXPERT: 160
  };
  return points[difficulty] || 50;
};

const generateLearningFeedback = (question, studentAnswer) => {
  const cmd = question.commandWord;

  switch (cmd) {
    case 'Define':
      return `For a DEFINE question, give a precise technical definition. Avoid examples or descriptions.`;
    case 'Identify':
      return `IDENTIFY asks for specific items. List them clearly without long explanations.`;
    case 'Outline':
      return `OUTLINE requires you to give reasons AND reference the business context. Make sure to use details from the scenario.`;
    case 'Explain':
      return `EXPLAIN means you need to give methods/reasons AND develop each with cause-and-effect reasoning.`;
    case 'Justify':
      return `JUSTIFY needs you to take a clear position, compare alternatives, and explain WHY your choice is best.`;
    default:
      return `Review the key concepts and try again. Look at the suggested answer below.`;
  }
};

/**
 * Calculate steal amount based on victim's recent score and question difficulty
 */
export const calculateStealAmount = (victimScore, questionDifficulty) => {
  const baseSteal = {
    EASY: 0.1,
    MEDIUM: 0.15,
    HARD: 0.2,
    EXPERT: 0.3
  };

  const percentage = baseSteal[questionDifficulty] || 0.15;
  const amount = Math.floor(victimScore * percentage);

  // Cap steals to reasonable amounts
  const maxSteal = {
    EASY: 30,
    MEDIUM: 50,
    HARD: 80,
    EXPERT: 120
  };

  return Math.min(amount, maxSteal[questionDifficulty] || 50);
};
