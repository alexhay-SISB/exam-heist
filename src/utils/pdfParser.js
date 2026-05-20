import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Extract all text from a PDF file
 */
export const extractTextFromPDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    pages.push(pageText);
  }

  return pages;
};

/**
 * Parse exam paper structure - identify case studies and questions
 */
export const parseExamPaper = (pages) => {
  const fullText = pages.join('\n');

  // Detect command words
  const commandWords = ['Define', 'Identify', 'Outline', 'Explain', 'Justify', 'Calculate', 'Describe', 'Discuss', 'Analyse', 'Evaluate'];

  // Split into case studies - look for numbered sections (1, 2, 3, 4)
  const caseStudies = splitIntoCaseStudies(fullText);

  return caseStudies.map((caseStudyText, index) => {
    const context = extractBusinessContext(caseStudyText);
    const questions = extractQuestions(caseStudyText, commandWords);

    return {
      caseStudyNumber: index + 1,
      businessContext: context,
      questions: questions
    };
  });
};

/**
 * Split exam text into separate case studies
 */
const splitIntoCaseStudies = (text) => {
  // Look for numbered case studies (1, 2, 3, 4 at start of paragraphs)
  const caseStudyPattern = /(?:^|\n)\s*(\d+)\s+([A-Z][A-Z]+|[A-Z][a-z]+)/g;
  const matches = [...text.matchAll(caseStudyPattern)];

  if (matches.length < 2) {
    // Fallback: split by major section markers
    return text.split(/(?:END OF PAPER|BLANK PAGE)/i).filter(s => s.trim().length > 200);
  }

  const sections = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const section = text.slice(start, end);
    if (section.length > 100) {
      sections.push(section);
    }
  }

  return sections;
};

/**
 * Extract business context from a case study
 */
const extractBusinessContext = (text) => {
  // Look for the introductory paragraph (before the first question marker)
  const firstQuestionMatch = text.match(/\(a\)/);
  const contextEnd = firstQuestionMatch ? firstQuestionMatch.index : Math.min(800, text.length);
  const contextText = text.slice(0, contextEnd);

  // Extract key business attributes
  const context = {
    rawText: contextText.trim(),
    businessName: extractBusinessName(contextText),
    businessType: extractBusinessType(contextText),
    employeeCount: extractEmployeeCount(contextText),
    sector: extractSector(contextText),
    yearsActive: extractYearsActive(contextText),
    keywords: extractKeywords(contextText)
  };

  return context;
};

const extractBusinessName = (text) => {
  // Look for capitalized acronyms or first capitalized word
  const acronymMatch = text.match(/\b([A-Z]{2,5})\b/);
  if (acronymMatch) return acronymMatch[1];

  const nameMatch = text.match(/^[\s\d]*([A-Z][a-z]+)/);
  return nameMatch ? nameMatch[1] : 'The business';
};

const extractBusinessType = (text) => {
  const types = [
    'bakery', 'restaurant', 'photography', 'travel', 'chemical', 'manufacturer',
    'retail', 'shop', 'cafe', 'salon', 'agency', 'consultancy', 'company',
    'business', 'firm', 'enterprise', 'startup'
  ];

  for (const type of types) {
    if (text.toLowerCase().includes(type)) {
      return type;
    }
  }
  return 'business';
};

const extractEmployeeCount = (text) => {
  const match = text.match(/(\d+(?:[,\s]\d{3})*)\s*(?:employees|workers|staff)/i);
  if (match) {
    return parseInt(match[1].replace(/[,\s]/g, ''));
  }
  return null;
};

const extractSector = (text) => {
  if (/primary sector/i.test(text)) return 'primary';
  if (/secondary sector/i.test(text)) return 'secondary';
  if (/tertiary sector|service sector/i.test(text)) return 'tertiary';
  return null;
};

const extractYearsActive = (text) => {
  const match = text.match(/(\d+)\s*years?\s*(?:ago|old|in business)/i);
  return match ? parseInt(match[1]) : null;
};

const extractKeywords = (text) => {
  // Important business terms that appear in the context
  const allKeywords = [
    'sole trader', 'partnership', 'limited company', 'joint venture',
    'niche market', 'mass market', 'cost-plus pricing', 'penetration pricing',
    'added value', 'marketing mix', 'customer loyalty', 'brand image',
    'autocratic', 'democratic', 'laissez-faire', 'span of control',
    'delegation', 'motivation', 'recruitment', 'training',
    'profit', 'revenue', 'costs', 'expansion', 'objectives'
  ];

  return allKeywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
};

/**
 * Extract questions from a case study
 */
const extractQuestions = (text, commandWords) => {
  const questions = [];

  // Pattern matches (a), (b), (c), (d), (e) sub-questions
  const subQuestionPattern = /\(([a-e])\)\s+([^\(]+?)(?=\([a-e]\)|\[\d+\]|$)/gs;
  const matches = [...text.matchAll(subQuestionPattern)];

  matches.forEach((match) => {
    const letter = match[1];
    const questionText = match[2].trim();

    // Find mark value [X]
    const marksMatch = text.slice(match.index).match(/\[(\d+)\]/);
    const marks = marksMatch ? parseInt(marksMatch[1]) : null;

    // Detect command word
    const commandWord = detectCommandWord(questionText, commandWords);

    // Extract the concept being tested
    const concept = extractConcept(questionText);

    questions.push({
      subQuestion: letter,
      questionText: cleanQuestionText(questionText),
      marks: marks,
      commandWord: commandWord,
      concept: concept,
      difficulty: assignDifficulty(commandWord, marks),
      requiresContext: marks >= 4
    });
  });

  return questions;
};

const cleanQuestionText = (text) => {
  return text
    .replace(/\.{3,}/g, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const detectCommandWord = (text, commandWords) => {
  const lower = text.toLowerCase();
  for (const word of commandWords) {
    const pattern = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
    if (pattern.test(text)) {
      return word;
    }
  }
  // Check for justify in evaluative questions
  if (/justify your answer|do you think/i.test(text)) return 'Justify';
  return 'Explain';
};

const extractConcept = (text) => {
  // Extract the main concept being tested (usually in quotes or after command word)
  const quotedMatch = text.match(/['"]([^'"]+)['"]/);
  if (quotedMatch) return quotedMatch[1];

  // Extract noun phrase after command word
  const commandMatch = text.match(/(?:Define|Explain|Outline|Identify|Justify)\s+(?:two\s+|one\s+|the\s+)?([a-z\s\-]+?)(?:\s+(?:that|which|of|to|for|why|how)|\.|\?)/i);
  if (commandMatch) return commandMatch[1].trim();

  return text.slice(0, 50);
};

const assignDifficulty = (commandWord, marks) => {
  if (!marks) return 'MEDIUM';
  if (marks <= 2) return 'EASY';
  if (marks <= 4) return 'MEDIUM';
  if (marks <= 6 && ['Explain', 'Outline'].includes(commandWord)) return 'HARD';
  if (marks >= 6 && commandWord === 'Justify') return 'EXPERT';
  return 'HARD';
};

/**
 * Parse mark scheme / answer key
 */
export const parseAnswerKey = (pages) => {
  const fullText = pages.join('\n');

  // Look for answer entries like "1(a)", "2(b)", etc.
  const answerPattern = /(\d+)\s*\(([a-e])\)\s+([^]*?)(?=\d+\s*\([a-e]\)|\[\d+\]\s+(?:Note|Only|Do not|This is)|$)/g;
  const matches = [...fullText.matchAll(answerPattern)];

  const answers = {};
  matches.forEach(match => {
    const qNum = match[1];
    const subQ = match[2];
    const answerText = match[3].trim();

    const key = `${qNum}${subQ}`;
    answers[key] = {
      questionNumber: qNum,
      subQuestion: subQ,
      answerText: answerText,
      acceptableAnswers: extractAcceptableAnswers(answerText),
      keywords: extractAnswerKeywords(answerText),
      partialCreditNotes: extractPartialCredit(answerText)
    };
  });

  return answers;
};

const extractAcceptableAnswers = (text) => {
  // Extract bulleted points
  const bulletPattern = /[•\*]\s*([^•\*\n]+)/g;
  const bullets = [...text.matchAll(bulletPattern)].map(m => m[1].trim());

  // Extract OR alternatives
  const orPattern = /OR\s+([^OR\n]+)/g;
  const alternatives = [...text.matchAll(orPattern)].map(m => m[1].trim());

  return [...bullets, ...alternatives].filter(a => a.length > 5 && a.length < 300);
};

const extractAnswerKeywords = (text) => {
  // Extract [k] knowledge markers
  const keywordPattern = /([a-zA-Z\s\-/]+)\s*\[k\]/g;
  return [...text.matchAll(keywordPattern)].map(m => m[1].trim().slice(-50));
};

const extractPartialCredit = (text) => {
  const partialMatch = text.match(/Partial definition[^.]+/);
  return partialMatch ? partialMatch[0] : null;
};
