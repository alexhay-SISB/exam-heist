/**
 * Built-in question banks bundled with the app.
 *
 * These are loaded into memory on app startup and merged into the
 * list returned by `listQuestionBanks()`. They cannot be deleted
 * from the dashboard (the delete button is hidden for built-ins).
 *
 * Two sources:
 *   1. `builtInQuestions.json` — 730 IGCSE Paper 1 past-paper questions
 *      (with unit tags 1–6, model answers, marking notes, difficulty).
 *   2. `builtInDefinitions.json` — 311 IGCSE vocabulary terms
 *      (unit-tagged definitions → played as `Define '<term>'.` questions).
 */

import { buildQuestionBankFromCSV } from '../utils/questionGenerator';
import questionRows    from './builtInQuestions.json';
import definitionRows  from './builtInDefinitions.json';
import practice300Rows from './builtInPractice300.json';

// Normalise the definitions CSV's `key term`/`definition` shape into the
// row schema the question-generator expects (mirrors the live CSV parser).
const defsAsRows = definitionRows
  .filter(r => r['key term'] && r['definition'])
  .map(r => ({
    topic:            r['key term'],
    example_question: `Define '${r['key term']}'.`,
    model_answer:     r['definition'],
    notes:            '',
    difficulty:       'EASY',
    marks:            '2',
    unit:             r['unit'] || '',
    category:         'definition'
  }));

const pastPaperConcepts  = buildQuestionBankFromCSV(questionRows);
const definitionConcepts = buildQuestionBankFromCSV(defsAsRows);
const practice300Concepts = buildQuestionBankFromCSV(practice300Rows);

export const BUILT_IN_BANKS = [
  {
    id: 'builtin-igcse-paper1',
    name: '📚 IGCSE Business Paper 1 — 730 Past-Paper Questions',
    questionCount: pastPaperConcepts.length,
    concepts: pastPaperConcepts,
    builtIn: true,
    createdAt: null
  },
  {
    id: 'builtin-igcse-practice-300',
    name: '📝 IGCSE Business — 300 Practice 6-Mark Questions',
    questionCount: practice300Concepts.length,
    concepts: practice300Concepts,
    builtIn: true,
    createdAt: null
  },
  {
    id: 'builtin-igcse-definitions',
    name: '📖 IGCSE Business Vocabulary — 311 Key Terms',
    questionCount: definitionConcepts.length,
    concepts: definitionConcepts,
    builtIn: true,
    createdAt: null
  }
];

export const getBuiltInBank = (id) =>
  BUILT_IN_BANKS.find(b => b.id === id) || null;

export const isBuiltInId = (id) => id && id.startsWith('builtin-');
