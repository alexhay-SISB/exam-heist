/**
 * PDF → CSV extractor with column-aware text extraction.
 * Cambridge mark schemes: | Question label | Answer | Marks | Notes |
 */
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const COMMAND_WORDS = [
  'Define', 'Identify', 'State', 'List', 'Outline', 'Describe',
  'Explain', 'Analyse', 'Discuss', 'Justify', 'Evaluate', 'Recommend', 'Calculate', 'Suggest'
];

const ANSWER_LABEL_PATTERN = /\b(reason|method|way|advantage|disadvantage|hygiene\s*factor|example|benefit|drawback|step|stage|point|factor|explanation|argument|effect|impact|cause|feature|characteristic)\s*\d*\s*:/gi;

// Lines to discard entirely — checked per-line in itemsToText
const NOISE_LINE_PATTERNS = [
  /^©\s*(Cambridge|UCLES)/i,
  /^Page\s+\d+\s+of\s+\d+/i,
  /^Cambridge\s+IGCSE/i,                         // any line starting with "Cambridge IGCSE"
  /Cambridge\s+IGCSE\s*[–\-]\s*Mark\s+Scheme/i,  // anywhere in line
  /^(February|March|April|May|June|July|August|September|October|November|December)\s*\/?\s*\w*\s+\d{4}\s*$/i,
  /^PUBLISHED$/i,
  /^Question\s+Answer\s+Marks/i,
  /^\d{4}\s*\/\s*\d{1,2}\b/,                     // paper codes "0450/12" at start of line
  /^Mark\s*Scheme/i,
  /^Paper\s+\d+/i,
  /^0\d{3}\s*\/\s*\d/,                           // any Cambridge subject code
  /^October\/November|^February\/March|^May\/June/i,
  // NOTE: do NOT filter standalone numbers — they may be case study labels
  // ("2" on one line, "(a)" on the next) that we need to reconstruct.
];

const isNoiseLine = (line) => NOISE_LINE_PATTERNS.some(re => re.test(line.trim()));

const stripAnswerLabels = (text) =>
  text.replace(ANSWER_LABEL_PATTERN, ' ').replace(/\s+/g, ' ').trim();

// ─── Low-level PDF extraction ─────────────────────────────────────────────

const extractStructuredItems = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allItems = [];
  let maxPageWidth = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    maxPageWidth = Math.max(maxPageWidth, viewport.width);
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!item.str || item.str.trim().length === 0) continue;
      if (/^[\s\.\_\-]+$/.test(item.str)) continue;
      allItems.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        page: i,
        width: item.width || 0
      });
    }
  }

  return { items: allItems, pageWidth: maxPageWidth };
};

const itemsToText = (items, { xMin = -Infinity, xMax = Infinity } = {}) => {
  const byPage = new Map();
  for (const item of items) {
    if (item.x < xMin || item.x >= xMax) continue;
    if (!byPage.has(item.page)) byPage.set(item.page, new Map());
    const lineMap = byPage.get(item.page);
    const y = Math.round(item.y / 4) * 4;
    if (!lineMap.has(y)) lineMap.set(y, []);
    lineMap.get(y).push(item);
  }

  const pages = [];
  for (const [, lineMap] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const sortedLines = [...lineMap.entries()].sort((a, b) => b[0] - a[0]);
    const lines = sortedLines
      .map(([, lineItems]) => {
        lineItems.sort((a, b) => a.x - b.x);
        return lineItems.map(it => it.str).join(' ');
      })
      .map(stripAnswerLabels)
      .filter(line => line.length > 0 && !isNoiseLine(line));
    pages.push(lines.join('\n'));
  }
  return pages.join('\n');
};

const cleanText = (text) =>
  (text || '')
    .replace(/\.{2,}/g, ' ')
    .replace(/_{2,}/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const extractTextFromPDF = async (file) => {
  const { items } = await extractStructuredItems(file);
  return [itemsToText(items)];
};

// ─── Question paper parsing ───────────────────────────────────────────────

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

const assignDifficulty = (marks, commandWord) => {
  if (marks) {
    if (marks <= 2) return 'EASY';
    if (marks <= 4) return 'MEDIUM';
    if (marks <= 6) return 'HARD';
    return 'EXPERT';
  }
  const easy = ['Define', 'Identify', 'State', 'List'];
  const medium = ['Outline', 'Describe', 'Calculate', 'Suggest'];
  const hard = ['Explain', 'Analyse'];
  const expert = ['Justify', 'Discuss', 'Evaluate', 'Recommend'];
  if (easy.includes(commandWord)) return 'EASY';
  if (medium.includes(commandWord)) return 'MEDIUM';
  if (hard.includes(commandWord)) return 'HARD';
  if (expert.includes(commandWord)) return 'EXPERT';
  return 'MEDIUM';
};

const detectCommandWord = (text) => {
  for (const cmd of COMMAND_WORDS) {
    if (new RegExp(`\\b${cmd}\\b`, 'i').test(text)) return titleCase(cmd);
  }
  return 'Explain';
};

// Generic noun-head tokens that, on their own, make a useless topic.
// e.g. just "advantages" or "examples" — the actual subject lives further on.
const GENERIC_HEAD_RE = /^(advantages?|disadvantages?|examples?|reasons?|ways?|methods?|factors?|benefits?|drawbacks?|features?|aims?|objectives?|points?|kinds?|types?|uses?|stages?|steps?|effects?|impacts?|sources?|causes?)$/i;

const isGenericHead = (head) => {
  // Strip case-study entity names + "to (a/the) business/firm/company" + fluff modifiers
  const h = head
    .replace(/\b(TCH|DCN|TFN|Pamela)'?s?\b/gi, ' ')
    .replace(/\s+to\s+(a|an|the)?\s*(business|firm|company)?\s*$/i, ' ')
    .replace(/\b(possible|potential|important|key|main|major|significant|relevant)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (GENERIC_HEAD_RE.test(h)) return true;
  // "one advantage and one disadvantage" / "advantages and disadvantages"
  if (/^(one\s+)?advantages?\s+and\s+(one\s+)?disadvantages?$/i.test(h)) return true;
  // "hygiene factors" — generic enough that the SUBJECT (e.g. Herzberg's theory) is the real topic
  if (/^hygiene\s+factors?$/i.test(h)) return true;
  return false;
};

// Clean a candidate subject phrase: strip entity names, leading verb forms,
// trailing modal clauses, "a business" tail noise.
const cleanSubject = (s) => {
  let r = (s || '').trim();
  // Case-study entities anywhere in the string
  r = r.replace(/\b(TCH|DCN|TFN|Pamela)'?s?\b/gi, ' ');
  // Leading possessive subject: "its managers having X" → "having X"
  r = r.replace(/^\s*(its|his|her|their|our)\s+\w+(\s+\w+)?\s+/i, '');
  // Leading verb forms: "operating in a", "setting up a", "having a"…
  r = r.replace(
    /^\s*(operating|setting\s+up|maintaining|offering|having|using|providing|making|achieving|improving|introducing|managing|running|starting|holding|paying|increasing|reducing|implementing|adopting)\s+(in|as|of|for|on|up)?\s*(a|an|the)?\s*/i,
    ''
  );
  // Leading article
  r = r.replace(/^\s*(a|an|the)\s+/i, '');
  // Trailing modal clause: "X might have changed", "X could use", etc.
  r = r.replace(/\s+(that|which|could|would|should|might|may|will|can)\b.*$/i, '');
  // Trailing "with the other business/firm/company"
  r = r.replace(/\s+with\s+the\s+other\s+(business|firm|company)\b.*$/i, '');
  // Trailing "[for|to|in|on|at|with|of] (a|an|the) business/firm/company"
  r = r.replace(/\s+(for|to|in|on|at|with|of)?\s*(a|an|the)\s+(business|firm|company)\b.*$/i, '');
  // Trailing entity ref: "important to TFN"
  r = r.replace(/\s+(for|to|of|in|at|by)\s+(TCH|DCN|TFN|Pamela)'?s?\b.*$/i, '');
  // Strip stray entity-name leftovers at edges
  r = r.replace(/^\s*(TCH|DCN|TFN|Pamela)'?s?\s+/i, '');
  return r.replace(/\s+/g, ' ').replace(/[\.\?,;:]+$/, '').trim();
};

const extractTopic = (text, commandWord) => {
  if (!text) return '';
  // Strip ALL quote variants — straight + curly (U+2018-U+201F + ASCII)
  const clean = text.replace(/[‘’‚‛“”„‟'"`´]/g, '').trim();

  // PATTERN 1: "Define <X>" → take what follows
  const defineMatch = clean.match(/^\s*Define\s+(.+?)(?:[\.\?]|\[\d+\]|$)/i);
  if (defineMatch) {
    const t = defineMatch[1].replace(/[\.\?,]+$/, '').trim().toLowerCase();
    if (t.length >= 3 && t.length <= 60) return t;
  }

  // PATTERN 2: "Do you think <X> is/are/will/would/might/…"
  const dytMatch = clean.match(
    /^\s*Do\s+you\s+think\s+(.+?)\s+(is|are|will|would|might|can|could|should|has|have|may|provides?|offers?|helps?)\b/i
  );
  if (dytMatch) {
    const t = cleanSubject(dytMatch[1]).toLowerCase();
    if (t.length >= 3 && t.length <= 80) return t;
  }

  // Strip command word + leading count
  let body = clean
    .replace(new RegExp(`^\\s*${commandWord}\\s+`, 'i'), '')
    .replace(/^(one|two|three|four|five|six)\s+/i, '');

  body = body.split(/\[\d+\]|\.\s|\?\s|Justify your answer/i)[0]
    .trim()
    .replace(/[\.\?,]+$/, '');

  // PATTERN 3: "<head> [extra] (of|from|why|about) <subject>"
  // Non-greedy on head — matches at the FIRST connector.
  const conMatch = body.match(/^(.+?)\s+(of|from|why|about)\s+(.+)$/i);
  if (conMatch) {
    const head = conMatch[1].trim();
    const connector = conMatch[2].toLowerCase();
    const subject = cleanSubject(conMatch[3]);

    if (isGenericHead(head) && subject.length >= 3 && subject.length <= 80) {
      return subject.toLowerCase();
    }

    // Head carries meaning (e.g. "non-financial methods") — keep head + subject
    if (subject.length >= 3 && head.length + subject.length + connector.length + 2 <= 70) {
      return `${head} ${connector} ${subject}`.toLowerCase();
    }
    // Combined too long — return cleaned head alone
    if (head.length >= 3 && head.length <= 60) {
      return head.toLowerCase();
    }
  }

  // FALLBACK — no connector, clean body in place
  const cleaned = cleanSubject(body);
  if (cleaned.length >= 3 && cleaned.length <= 80) return cleaned.toLowerCase();
  return '';
};

// Aggressively normalise a topic for dedup — strips hyphens, spaces, all
// punctuation so "non-financial methods" and "non financial methods" collapse
// to the same key.
const normTopicForDedup = (t) =>
  (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);

// Cambridge IGCSE Business P1 always has exactly 4 case studies. Anything
// beyond that comes from extra papers in a combined mark scheme PDF.
const MAX_CASE_STUDIES = 4;

const extractQuestions = (text) => {
  if (!text || text.length < 20) return [];

  const results = [];
  const seen = new Set(); // dedup by normalized text

  const subqPattern = /\(([a-h])\)/g;
  const subqPositions = [];
  let sm;
  while ((sm = subqPattern.exec(text)) !== null) {
    subqPositions.push({ index: sm.index, letter: sm[1] });
  }

  if (subqPositions.length >= 2) {
    let caseStudyNumber = 1;
    let prevLetter = null;

    for (let i = 0; i < subqPositions.length; i++) {
      const letter = subqPositions[i].letter;
      if (letter === 'a' && prevLetter && prevLetter !== 'a') caseStudyNumber++;
      prevLetter = letter;

      // Hard cap — Cambridge P1 has only 4 case studies. Anything past that is
      // a duplicate from another paper embedded in the answers PDF.
      if (caseStudyNumber > MAX_CASE_STUDIES) break;

      const start = subqPositions[i].index;
      const end = i + 1 < subqPositions.length
        ? subqPositions[i + 1].index
        : Math.min(start + 800, text.length);

      let segment = text.slice(start, end);
      const marksMatch = segment.match(/\[(\d+)\]/);
      if (marksMatch) segment = segment.slice(0, marksMatch.index + marksMatch[0].length);

      let questionText = cleanText(segment).replace(/^\([a-h]\)\s*/, '');
      if (questionText.length < 10) continue;

      const marks = marksMatch ? parseInt(marksMatch[1]) : null;
      const commandWord = detectCommandWord(questionText);
      const topic = extractTopic(questionText, commandWord);
      const difficulty = assignDifficulty(marks, commandWord);

      // Dedup by (sub-letter, command word, normalised topic) — collapses
      // "non-financial methods" and "non financial methods" to the same key
      // even when one comes from exam paper and the other from mark scheme.
      const dedupKey = `${letter}:${commandWord.toLowerCase()}:${normTopicForDedup(topic)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      results.push({
        questionNumber: caseStudyNumber,
        subLetter: letter,
        label: `${caseStudyNumber}${letter}`,
        topic,
        exampleQuestion: questionText.replace(/\[\d+\]\s*$/, '').trim(),
        modelAnswer: '',
        notes: (marks && marks >= 4) ? 'Reference the business context for full marks.' : '',
        difficulty,
        marks,
        commandWord
      });
    }

    if (results.length >= 3) return results;
  }

  // Fallback: command-word anchoring
  const cmdRegex = new RegExp(`\\b(${COMMAND_WORDS.join('|')})\\b`, 'gi');
  const cmdMatches = [];
  let cm;
  while ((cm = cmdRegex.exec(text)) !== null) {
    cmdMatches.push({ index: cm.index, command: titleCase(cm[1]) });
  }

  let caseStudyNumber = 1;
  for (let i = 0; i < cmdMatches.length; i++) {
    const start = cmdMatches[i].index;
    const nextStart = i + 1 < cmdMatches.length ? cmdMatches[i + 1].index : text.length;
    const segment = text.slice(start, nextStart);
    const marksMatch = segment.match(/\[(\d+)\]/);
    const endOffset = marksMatch ? marksMatch.index + marksMatch[0].length : Math.min(400, segment.length);

    let questionText = cleanText(segment.slice(0, endOffset)).replace(/^\([a-h]\)\s*/, '');
    if (questionText.length < 12 || questionText.length > 400) continue;

    const marks = marksMatch ? parseInt(marksMatch[1]) : null;
    const commandWord = cmdMatches[i].command;
    const topic = extractTopic(questionText, commandWord);
    const difficulty = assignDifficulty(marks, commandWord);

    const dedupKey = `?:${commandWord.toLowerCase()}:${normTopicForDedup(topic)}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    results.push({
      questionNumber: caseStudyNumber,
      subLetter: '?',
      label: `${caseStudyNumber}?`,
      topic,
      exampleQuestion: questionText.replace(/\[\d+\]\s*$/, '').trim(),
      modelAnswer: '',
      notes: (marks && marks >= 4) ? 'Reference the business context for full marks.' : '',
      difficulty,
      marks,
      commandWord
    });
  }

  return results;
};

// ─── Answer body / notes cleaning ────────────────────────────────────────

const cleanAnswerBody = (text) => {
  return (text || '')
    // Strip Cambridge footer patterns that slip through noise filter
    .replace(/\d{4}\s*\/\s*\d{1,2}\s+Cambridge[^\n]*/gi, '')
    .replace(/Cambridge\s+IGCSE\s*[–\-]\s*Mark\s+Scheme[^\n]*/gi, '')
    .replace(/Question\s+Answer\s+Marks(?:\s+Notes)?/gi, '')
    .replace(/©\s*(Cambridge|UCLES)[^\n]*/gi, '')
    .replace(/Page\s+\d+\s+of\s+\d+/gi, '')
    .replace(/^0\d{3}\s*\/\s*\d[^\n]*/gm, '') // paper codes at line start
    // Annotation marks
    .replace(/\[k\]/gi, '').replace(/\[an\]/gi, '').replace(/\[app\]/gi, '')
    // Inline mark numbers that appear between question repeat and answer
    // e.g. "Define 'added value'. 2 The difference..." → "Define 'added value'. The difference..."
    .replace(/\.\s+\d{1,2}\s+(?=[A-Z])/g, '. ')
    // Partial definition guidance
    .replace(/Partial\s+definition\s+e\.?g\.?[^[.]*(?:\[\d\])?[^.]*\./gi, '')
    // Mark scheme guidance sentences
    .replace(/Award (?:up to )?\d+ marks? (?:for|per|to)[^.]+\./gi, '')
    .replace(/Award \d+ marks? for[^.]+\./gi, '')
    .replace(/Only award (?:the first|first|) [^.]+\./gi, '')
    .replace(/Do not award[^.]+\./gi, '')
    .replace(/For (?:two|three|four|one|\d+) marks?\s+need[s]?[^.]+\./gi, '')
    .replace(/Points might include:?\s*/gi, '')
    .replace(/Other appropriate (?:examples|responses)[^.]*\.?/gi, '')
    .replace(/Two from:?\s*/gi, '')
    .replace(/Note:?\s*/gi, '')
    .replace(/Notes:?\s*/gi, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .replace(/^[\s•·•\-,]+/, '')
    .trim()
    .slice(0, 1000);
};

const cleanNotesBody = (text) => {
  return (text || '')
    // Also strip footers from notes column
    .replace(/\d{4}\s*\/\s*\d{1,2}\s+Cambridge[^\n]*/gi, '')
    .replace(/Cambridge\s+IGCSE\s*[–\-]\s*Mark\s+Scheme[^\n]*/gi, '')
    .replace(/Question\s+Answer\s+Marks(?:\s+Notes)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
};

// ─── Mark scheme parsing (column-aware) ──────────────────────────────────

// Mark-scheme-only phrases. Never appear in exam paper text.
// "UCLES" is banned because it appears in © footers of both papers.
const MS_INDICATOR = /Mark\s+Scheme|MARK\s+SCHEME|Award\s+\d+\s+marks?\s+for|Award\s+up\s+to\s+\d+\s+marks?|Points?\s+might\s+include|Other\s+appropriate\s+(?:responses|examples)|Knowledge\s*\[k\]|\[an\]|\[app\]|\[eval\]/i;

// Classify each PAGE (not each file) as exam-paper or mark-scheme.
// Critical for combined PDFs that contain both, where file-level
// classification puts everything in one bucket and pollutes the parser.
const classifyPagesAsExamOrMS = (items) => {
  const itemsByPage = new Map();
  for (const it of items) {
    if (!itemsByPage.has(it.page)) itemsByPage.set(it.page, []);
    itemsByPage.get(it.page).push(it);
  }

  const msPages = new Set();
  for (const [page, pageItems] of itemsByPage) {
    const raw = pageItems.map(it => it.str).join(' ');
    if (MS_INDICATOR.test(raw)) msPages.add(page);
  }
  return msPages;
};

/**
 * Find label items structurally — items at the left edge of the page whose
 * text matches a label pattern. Far more robust than text regex because it
 * uses both content AND position, and handles all label styles uniformly:
 *   "1(a)"   - explicit single item
 *   "1 (a)"  - explicit with space
 *   "(a)"    - standalone (case study tracked via sibling label items)
 *   "1" + "(a)" - split across two items at same Y
 */
const findLabelItemsStructurally = (items, pageWidth) => {
  const labelColumnMax = pageWidth * 0.18;

  // Candidates: items at left edge whose text could be a label component
  const candidates = items.filter(it => {
    if (it.x > labelColumnMax) return false;
    const s = it.str.trim();
    return /^[1-9]\s*\(?[a-h]?\)?$/.test(s) || /^\([a-h]\)$/.test(s) || /^[1-9]$/.test(s);
  });

  // Sort by page asc, Y desc (top of page first)
  candidates.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });

  // Walk through and emit label entries, joining "N"+"(L)" pairs at similar Y
  const entries = [];
  let currentCS = 0;
  let prevLetter = null;

  for (let i = 0; i < candidates.length; i++) {
    const it = candidates[i];
    const s = it.str.trim();

    // Explicit "N(L)" in single item
    let m = s.match(/^([1-9])\s*\(([a-h])\)$/);
    if (m) {
      currentCS = parseInt(m[1]);
      prevLetter = m[2];
      entries.push({ page: it.page, y: it.y, label: `${currentCS}${m[2]}` });
      continue;
    }

    // Standalone "(L)" — check if a sibling "N" item is at similar Y on same page
    m = s.match(/^\(([a-h])\)$/);
    if (m) {
      const letter = m[1];
      // Look for "N" item at very similar Y (within 8 units) on same page
      const sibling = candidates.find(c =>
        c.page === it.page && Math.abs(c.y - it.y) < 8 && /^[1-9]$/.test(c.str.trim())
      );
      if (sibling) {
        currentCS = parseInt(sibling.str.trim());
      } else {
        // True standalone — case study tracked by 'a' transitions
        if (letter === 'a' && prevLetter && prevLetter !== 'a') currentCS++;
        if (currentCS === 0) currentCS = 1;
      }
      prevLetter = letter;
      entries.push({ page: it.page, y: it.y, label: `${currentCS}${letter}` });
      continue;
    }

    // Bare "N" — skip; we'll pick it up when its "(L)" sibling is processed
  }

  // Dedup (keep first occurrence of each label)
  const seen = new Set();
  return entries.filter(e => {
    if (seen.has(e.label)) return false;
    seen.add(e.label);
    return true;
  });
};

/**
 * Parse mark scheme answer blocks from structured items.
 * Uses X-column separation (label | answer | marks | notes).
 */
const parseMarkSchemeFromItems = (items, pageWidth) => {
  const notesThreshold = pageWidth * 0.62;

  const answerText = itemsToText(items, { xMax: notesThreshold });

  // Normalise: join "2\n(a)" → "2(a)" so the label regex works even when
  // the case study number and sub-letter land on different Y buckets.
  const normText = answerText.replace(/\b([1-9])\s*\n\s*\(([a-h])\)/g, '$1($2)');

  // Cambridge mark schemes mix two label styles:
  //   • Explicit:   "1(a)", "1(b)", "4(a)", "4(b)" (every sub-question has the case study #)
  //   • Cambridge:  "2 (a)" then plain "(b)", "(c)", "(d)", "(e)" (only the first has the #)
  //
  // To handle both, find ALL labels of either style, then walk through them
  // in document order and assign case-study numbers by context.
  const rawLabels = [];

  // Explicit "N(L)" or "NL)" anywhere in text. The opening paren is optional
  // because Cambridge mark schemes sometimes typeset the first sub-question
  // label as "3a)" (no opening paren) — the user spotted this exact case.
  const explicitRe = /(?<!\d)([1-9])\s*\(?([a-h])\)/g;
  let m;
  while ((m = explicitRe.exec(normText)) !== null) {
    rawLabels.push({ index: m.index, len: m[0].length, csNum: parseInt(m[1]), letter: m[2], explicit: true });
  }

  // Standalone "(L)" or "L)" at a line start. The opening paren is optional
  // because Cambridge mark schemes sometimes drop it on the first label of a
  // case study (e.g. "a)" for case 3's first sub-question — we confirmed
  // this with the diagnostic dump).
  const lines = normText.split('\n');
  let cursor = 0;
  for (const ln of lines) {
    const lm = ln.match(/^\s*(\(?)([a-h])\)/);
    if (lm) {
      // Where does the label start? At "(" if present, else at the letter.
      const openParen = lm[1];
      const labelOffset = openParen ? ln.indexOf('(') : ln.search(/[a-h]\)/);
      const idx = cursor + labelOffset;
      // Skip if already captured as part of an explicit label
      const inExplicit = rawLabels.some(l => l.explicit && idx >= l.index && idx < l.index + l.len);
      if (!inExplicit) {
        rawLabels.push({ index: idx, len: openParen ? 3 : 2, csNum: null, letter: lm[2], explicit: false });
      }
    }
    cursor += ln.length + 1;
  }

  // Sort by position and assign case-study numbers in document order
  rawLabels.sort((a, b) => a.index - b.index);
  const labelPositions = [];
  let currentCS = 0;
  let prevLetter = null;
  for (const l of rawLabels) {
    let csNum;
    if (l.explicit) {
      csNum = l.csNum;
      currentCS = csNum;
    } else {
      // Standalone (L). If we see 'a' and previous wasn't 'a', a new case study started.
      if (l.letter === 'a' && prevLetter && prevLetter !== 'a') currentCS++;
      if (currentCS === 0) currentCS = 1;
      csNum = currentCS;
    }
    prevLetter = l.letter;
    labelPositions.push({ index: l.index, len: l.len, label: `${csNum}${l.letter}` });
  }
  const seenLabels = new Set();
  const uniquePositions = labelPositions.filter(lp => {
    if (seenLabels.has(lp.label)) return false;
    seenLabels.add(lp.label);
    return true;
  });

  /* eslint-disable no-console */
  console.log('[ExamHeist parser] Labels found:', uniquePositions.map(p => p.label).join(', ') || '(none)');
  /* eslint-enable no-console */

  // Build answer blocks by slicing between label positions
  const blocks = {};
  for (let i = 0; i < uniquePositions.length; i++) {
    const start = uniquePositions[i].index + uniquePositions[i].len;
    const end = i + 1 < uniquePositions.length ? uniquePositions[i + 1].index : normText.length;
    const body = cleanAnswerBody(cleanText(normText.slice(start, end)));
    if (body.length > 5) {
      blocks[uniquePositions[i].label] = { answer: body, notes: '' };
    }
  }

  // ---- Notes: Y-position matching ----
  // Find the Y position of each label item so we can collect the right-column
  // notes that are vertically aligned with each question block.
  const labelYMap = {}; // label → { page, y }
  for (let i = 0; i < items.length; i++) {
    const explicitMatch = items[i].str.match(/^([1-9])\s*\(([a-h])\)\s*$/) ||
                          items[i].str.match(/^([1-9])\(([a-h])\)$/);
    if (explicitMatch) {
      const lbl = `${explicitMatch[1]}${explicitMatch[2]}`;
      if (!labelYMap[lbl]) labelYMap[lbl] = { page: items[i].page, y: items[i].y };
    }
  }

  const labelEntries = Object.entries(labelYMap).sort((a, b) => {
    if (a[1].page !== b[1].page) return a[1].page - b[1].page;
    return b[1].y - a[1].y;
  });

  for (let i = 0; i < labelEntries.length; i++) {
    const [lbl, { page: startPage, y: startY }] = labelEntries[i];
    const next = labelEntries[i + 1];
    const endPage = next ? next[1].page : Infinity;
    const endY = next ? next[1].y : -Infinity;

    const notesItems = items.filter(it => {
      if (it.x < notesThreshold) return false;
      if (it.page < startPage || it.page > endPage) return false;
      if (it.page === startPage && it.y > startY) return false;
      if (it.page === endPage && it.y <= endY) return false;
      return true;
    });

    const notesStr = cleanNotesBody(itemsToText(notesItems, { xMin: notesThreshold }));
    if (blocks[lbl] && notesStr.length > 5) {
      blocks[lbl].notes = notesStr;
    }
  }

  return blocks;
};

// ─── Main entry ───────────────────────────────────────────────────────────

const extractAllItems = async (files, pageOffsetBase = 0) => {
  const arr = Array.isArray(files) ? files : files ? [files] : [];
  let allItems = [];
  let maxPageWidth = 0;
  for (let f = 0; f < arr.length; f++) {
    const { items, pageWidth } = await extractStructuredItems(arr[f]);
    maxPageWidth = Math.max(maxPageWidth, pageWidth);
    const pageOffset = pageOffsetBase + f * 1000;
    for (const it of items) allItems.push({ ...it, page: it.page + pageOffset });
  }
  return { items: allItems, pageWidth: maxPageWidth };
};

/**
 * Parse PDFs into question rows.
 *
 * Accepts either:
 *  - Array of files / single file  → uses per-page classification to split
 *    exam pages from mark scheme pages
 *  - { exam, markScheme }          → explicit roles, skips classification
 *
 * Either `exam` or `markScheme` can be omitted in the object form.
 */
export const parsePdfToRows = async (input) => {
  let examItems = [];
  let markSchemeItems = [];
  let maxPageWidth = 0;

  // Detect explicit { exam, markScheme } shape
  const isExplicit = input && typeof input === 'object' && !Array.isArray(input) &&
                     !(input instanceof File) && !(input instanceof Blob) &&
                     ('exam' in input || 'markScheme' in input);

  if (isExplicit) {
    // Explicit roles — no classification needed
    const examResult = await extractAllItems(input.exam, 0);
    const msResult   = await extractAllItems(input.markScheme, 100000);
    examItems = examResult.items;
    markSchemeItems = msResult.items;
    maxPageWidth = Math.max(examResult.pageWidth, msResult.pageWidth);
  } else {
    // Single-file / array form — fall back to per-page classification
    const { items, pageWidth } = await extractAllItems(input, 0);
    maxPageWidth = pageWidth;
    const msPages = classifyPagesAsExamOrMS(items);
    examItems = items.filter(it => !msPages.has(it.page));
    markSchemeItems = items.filter(it => msPages.has(it.page));
  }

  if (examItems.length === 0 && markSchemeItems.length === 0) return [];

  // Extract questions from exam, answers from mark scheme.
  // Fall back gracefully if one side is empty.
  const questionSource = examItems.length > 0 ? examItems : markSchemeItems;
  const answerSource   = markSchemeItems.length > 0 ? markSchemeItems : examItems;

  const fullText = itemsToText(questionSource);
  const questions = extractQuestions(fullText);

  const blocks = parseMarkSchemeFromItems(answerSource, maxPageWidth || 600);

  for (const q of questions) {
    if (blocks[q.label]) {
      q.modelAnswer = blocks[q.label].answer;
      if (blocks[q.label].notes) q.notes = blocks[q.label].notes;
    }
  }

  return questions;
};

/**
 * Build CSV text from edited rows.
 */
export const rowsToCSV = (rows) => {
  const headers = ['question_number', 'topic', 'example_question', 'model_answer', 'notes', 'difficulty', 'marks'];
  const csvEscape = (v) => {
    const s = String(v || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push([
      csvEscape(row.label || ''),
      csvEscape(row.topic),
      csvEscape(row.exampleQuestion),
      csvEscape(row.modelAnswer),
      csvEscape(row.notes),
      csvEscape(row.difficulty || 'MEDIUM'),
      csvEscape(row.marks || '')
    ].join(','));
  }
  return lines.join('\n');
};
