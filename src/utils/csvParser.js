/**
 * CSV Parser & Template Generator
 * Replaces the PDF parser with a reliable CSV-based question bank input.
 */

export const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row.');
  }

  const headers = parseRow(lines[0]).map(h => normalizeHeader(h));

  // ── Auto-detect the definitions CSV format ──
  // Columns: `key term, definition, unit` (e.g. the 312 IGCSE vocab terms).
  // Transform each row into a standard definition concept on the fly so the
  // rest of the pipeline doesn't have to care which file it came from.
  const isDefinitionsCSV =
    headers.includes('key_term') && headers.includes('definition');

  if (isDefinitionsCSV) {
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
      if (values.every(v => !v.trim())) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (values[idx] || '').trim(); });
      if (!obj.key_term || !obj.definition) continue;
      rows.push({
        topic: obj.key_term,
        example_question: `Define '${obj.key_term}'.`,
        model_answer: obj.definition,
        notes: '',
        difficulty: 'EASY',
        marks: '2',
        category: 'definition',
        source: obj.unit ? `unit-${obj.unit}` : 'definitions'
      });
    }
    if (rows.length === 0) {
      throw new Error('No valid rows found in definitions CSV. Each row needs a key term and definition.');
    }
    return rows;
  }

  // ── Standard question-bank CSV ──
  const required = ['topic', 'model_answer'];
  for (const req of required) {
    if (!headers.includes(req)) {
      throw new Error(`Missing required column: "${req}". Expected columns: topic, model_answer, notes, example_question, difficulty, marks, category. (Definitions CSV format is also accepted: key_term, definition, unit.)`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.every(v => !v.trim())) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = (values[idx] || '').trim(); });
    if (!row.topic || !row.model_answer) continue;
    rows.push(row);
  }

  if (rows.length === 0) {
    throw new Error('No valid rows found. Make sure each row has at least a topic and model_answer.');
  }

  return rows;
};

const normalizeHeader = (h) => h.toLowerCase().trim().replace(/[\s-]+/g, '_');

const parseRow = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

export const generateCSVTemplate = () => {
  const headers = ['topic', 'example_question', 'model_answer', 'notes', 'difficulty'];

  const examples = [
    {
      topic: 'external recruitment methods',
      example_question: 'Explain two methods of external recruitment a business could use.',
      model_answer: 'External recruitment methods: 1) Newspaper/online advertising - reaches a wide audience but can be expensive. 2) Recruitment agencies - find specialist candidates but charge commission. 3) Job fairs - meet many applicants face-to-face. 4) Headhunting - directly target experienced people from competitors.',
      notes: 'Full marks: identify 2+ methods, explain how each works, and link to the business context (e.g. business size or skill needs).',
      difficulty: 'HARD'
    },
    {
      topic: 'internal recruitment methods',
      example_question: 'Identify two methods of internal recruitment.',
      model_answer: 'Internal methods include: promotion from within, internal job postings, employee referrals, transferring staff between departments.',
      notes: 'Should compare to external recruitment for full marks: faster, cheaper, motivates existing staff but limits new ideas.',
      difficulty: 'EASY'
    },
    {
      topic: 'leadership styles',
      example_question: 'Outline two leadership styles a manager could use.',
      model_answer: 'Autocratic - leader makes all decisions, fast but demotivating. Democratic - involves the team, slower but more engaging. Laissez-faire - hands off, works only with skilled/motivated teams.',
      notes: 'Must reference 2+ distinct styles. For full marks link to business context: type of work, employee skill level, urgency of decisions.',
      difficulty: 'MEDIUM'
    },
    {
      topic: 'methods of motivation',
      example_question: 'Explain two financial methods of motivation a business could use.',
      model_answer: 'Financial: bonuses, commission, profit sharing, fringe benefits. Non-financial: praise, promotion, job rotation, empowerment, team working. Each affects motivation differently per Maslow/Herzberg.',
      notes: 'For full marks link to type of business and type of worker (e.g. sales staff respond well to commission).',
      difficulty: 'HARD'
    },
    {
      topic: 'sources of finance',
      example_question: 'Identify two short term sources of finance.',
      model_answer: 'Short term: bank overdraft, trade credit, factoring. Long term: bank loan, share capital, retained profit, debentures.',
      notes: 'Must distinguish between short and long term. Full marks: link to purpose (e.g. cash flow vs capital investment).',
      difficulty: 'EASY'
    }
  ];

  const lines = [headers.join(',')];
  for (const ex of examples) {
    const row = headers.map(h => csvEscape(ex[h] || ''));
    lines.push(row.join(','));
  }
  return lines.join('\n');
};

const csvEscape = (val) => {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
};

export const downloadCSV = (filename, content) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
