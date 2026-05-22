import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Upload, Download, Plus, Trash2, FileText, X, FileCheck,
  Database, Search, History, Eraser, FileUp
} from 'lucide-react';
import { parsePdfToRows, rowsToCSV } from '../utils/pdfToCsv';

const STORAGE_KEY = 'examheist:converter:bank:v1';

const blankRow = () => ({
  label: '',
  topic: '',
  exampleQuestion: '',
  modelAnswer: '',
  notes: '',
  difficulty: 'MEDIUM',
  marks: '',
  source: ''
});

// Build a stable dedup key from topic + example question (case/space tolerant)
const rowKey = (r) =>
  `${(r.topic || '').toLowerCase().trim()}::${(r.exampleQuestion || '').toLowerCase().trim().replace(/\s+/g, ' ')}`;

// Derive a short source ID from a PDF filename
const deriveSource = (file) => {
  if (!file?.name) return 'manual';
  return file.name
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
};

// Minimal CSV parser for the Import-CSV button. Handles quoted fields.
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitRow = (line) => {
    const out = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) { out.push(cur); cur = ''; }
      else cur += c;
    }
    out.push(cur);
    return out;
  };
  const headers = splitRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitRow(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (vals[idx] || '').trim(); });
    rows.push({
      label: obj.question_number || obj.label || '',
      topic: obj.topic || '',
      exampleQuestion: obj.example_question || obj.exampleQuestion || '',
      modelAnswer: obj.model_answer || obj.modelAnswer || '',
      notes: obj.notes || '',
      difficulty: (obj.difficulty || 'MEDIUM').toUpperCase(),
      marks: obj.marks || '',
      source: obj.source || 'imported-csv'
    });
  }
  return rows.filter(r => r.topic || r.exampleQuestion || r.modelAnswer);
};

export default function PdfConverter() {
  const navigate = useNavigate();

  // ── Bank state (persisted) ──────────────────────────────────────────
  const [rows, setRows] = useState([]);
  const [sessions, setSessions] = useState([]); // recent parse log

  // ── Transient UI state ──────────────────────────────────────────────
  const [parsing, setParsing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [examFile, setExamFile] = useState(null);
  const [markSchemeFile, setMarkSchemeFile] = useState(null);
  const [search, setSearch] = useState('');
  const [showSessions, setShowSessions] = useState(false);

  // ── Load persisted bank on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.rows)) setRows(data.rows);
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
      }
    } catch (e) {
      console.warn('Could not load bank from localStorage:', e);
    }
  }, []);

  // ── Persist on change ───────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ rows, sessions }));
    } catch (e) {
      console.warn('Could not save bank to localStorage:', e);
    }
  }, [rows, sessions]);

  // ── File pickers ────────────────────────────────────────────────────
  const handleSelectExam        = (e) => { const f = e.target.files[0]; if (f) setExamFile(f); e.target.value = ''; };
  const handleSelectMarkScheme  = (e) => { const f = e.target.files[0]; if (f) setMarkSchemeFile(f); e.target.value = ''; };
  const clearExam               = () => setExamFile(null);
  const clearMarkScheme         = () => setMarkSchemeFile(null);

  // ── Parse & APPEND to bank ──────────────────────────────────────────
  const handleParse = async () => {
    if (!examFile && !markSchemeFile) {
      setError('Pick at least one PDF first — exam paper, mark scheme, or both.');
      return;
    }
    setParsing(true);
    setError('');
    const parts = [];
    if (examFile) parts.push('exam paper');
    if (markSchemeFile) parts.push('mark scheme');
    setStatus(`Reading ${parts.join(' + ')}…`);

    try {
      const extracted = await parsePdfToRows({
        exam: examFile,
        markScheme: markSchemeFile
      });

      const sourceId = deriveSource(examFile || markSchemeFile);
      const tagged = extracted.map(r => ({ ...r, source: r.source || sourceId }));

      // Dedup against existing bank
      const existingKeys = new Set(rows.map(rowKey));
      const fresh = [];
      let skipped = 0;
      for (const r of tagged) {
        const k = rowKey(r);
        if (existingKeys.has(k)) { skipped++; continue; }
        existingKeys.add(k);
        fresh.push(r);
      }

      if (fresh.length === 0 && extracted.length === 0) {
        setError('No questions detected. The PDF may be scanned (needs OCR) or use a non-standard format.');
      } else {
        const newRows = [...rows, ...fresh];
        setRows(newRows);

        // Log this session
        const session = {
          id: `${sourceId}-${Date.now()}`,
          source: sourceId,
          exam: examFile?.name || null,
          markScheme: markSchemeFile?.name || null,
          added: fresh.length,
          skipped,
          addedAt: Date.now()
        };
        setSessions([session, ...sessions].slice(0, 20));

        const withAnswers = fresh.filter(r => r.modelAnswer && r.modelAnswer.length > 5).length;
        setStatus(
          `Added ${fresh.length} new question${fresh.length === 1 ? '' : 's'} ` +
          `(${withAnswers} with model answers)` +
          (skipped > 0 ? ` • skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : '') +
          `. Bank now has ${newRows.length} total. Pick the next paper to keep adding.`
        );

        // Auto-clear file slots so the user can immediately add the next pair
        setExamFile(null);
        setMarkSchemeFile(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to parse PDF: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  // ── Row editing ─────────────────────────────────────────────────────
  const updateRow = (idx, field, value) =>
    setRows(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  const addRow    = () => setRows([...rows, blankRow()]);
  const deleteRow = (idx) => setRows(rows.filter((_, i) => i !== idx));

  // ── Bank-level actions ──────────────────────────────────────────────
  const handleDownload = () => {
    const cleanRows = rows.filter(r => r.topic?.trim() || r.exampleQuestion?.trim());
    if (cleanRows.length === 0) {
      alert('No rows to export yet. Parse a PDF first.');
      return;
    }
    const csv = rowsToCSV(cleanRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-heist-bank-${cleanRows.length}q-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = parseCSV(ev.target.result);
        const existingKeys = new Set(rows.map(rowKey));
        const fresh = imported.filter(r => {
          const k = rowKey(r);
          if (existingKeys.has(k)) return false;
          existingKeys.add(k);
          return true;
        });
        const skipped = imported.length - fresh.length;
        setRows([...rows, ...fresh]);
        setSessions([{
          id: `import-${Date.now()}`,
          source: `csv:${f.name}`,
          exam: f.name,
          markScheme: null,
          added: fresh.length,
          skipped,
          addedAt: Date.now()
        }, ...sessions].slice(0, 20));
        setStatus(`Imported ${fresh.length} rows from CSV (skipped ${skipped} duplicates).`);
        setError('');
      } catch (err) {
        setError('CSV import failed: ' + err.message);
      }
    };
    reader.readAsText(f);
  };

  const handleClearBank = () => {
    if (!rows.length) return;
    if (!confirm(`Clear the entire bank? This will permanently remove all ${rows.length} questions from this browser. This cannot be undone.`)) return;
    setRows([]);
    setSessions([]);
    setStatus('Bank cleared.');
    setError('');
  };

  const handleRemoveSource = (source) => {
    const count = rows.filter(r => r.source === source).length;
    if (!confirm(`Remove all ${count} rows from source "${source}"?`)) return;
    setRows(rows.filter(r => r.source !== source));
    setStatus(`Removed ${count} rows from "${source}".`);
  };

  const startBlank = () => addRow();

  // ── Derived stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byDifficulty = { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 };
    const bySource = new Map();
    let withAnswers = 0;
    for (const r of rows) {
      if (byDifficulty[r.difficulty] !== undefined) byDifficulty[r.difficulty]++;
      const src = r.source || 'unknown';
      bySource.set(src, (bySource.get(src) || 0) + 1);
      if (r.modelAnswer && r.modelAnswer.length > 5) withAnswers++;
    }
    return {
      total: rows.length,
      byDifficulty,
      bySource: [...bySource.entries()].sort((a, b) => b[1] - a[1]),
      withAnswers
    };
  }, [rows]);

  // ── Filtered view ───────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.topic || '').toLowerCase().includes(q) ||
      (r.exampleQuestion || '').toLowerCase().includes(q) ||
      (r.modelAnswer || '').toLowerCase().includes(q) ||
      (r.source || '').toLowerCase().includes(q) ||
      (r.label || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <button onClick={() => navigate('/')} className="text-violet-300 mb-4 flex items-center gap-2 hover:underline">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-4xl md:text-5xl font-heist text-gradient mb-2 flex items-center gap-3">
            <Database className="w-10 h-10 text-violet-300" />
            Question Bank Builder
          </h1>
          <p className="text-slate-400">
            Upload paper after paper — every parse <strong>adds</strong> to your bank.
            The bank is saved automatically in your browser so you can come back later.
            When you're done, download one big CSV.
          </p>
        </motion.div>

        {/* Bank stats banner */}
        <div className="card-heist mb-6">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-400">Bank size</div>
                <div className="text-3xl font-heist text-gradient">{stats.total}</div>
                <div className="text-xs text-slate-500">{stats.withAnswers} with model answers</div>
              </div>
              <div className="h-12 w-px bg-white/10 hidden md:block" />
              <div className="flex gap-2 flex-wrap">
                <span className="badge badge-cyan">EASY · {stats.byDifficulty.EASY}</span>
                <span className="badge badge-violet">MEDIUM · {stats.byDifficulty.MEDIUM}</span>
                <span className="badge badge-fuchsia">HARD · {stats.byDifficulty.HARD}</span>
                <span className="badge badge-rose">EXPERT · {stats.byDifficulty.EXPERT}</span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <label className="btn-ghost text-sm cursor-pointer">
                <FileUp className="w-4 h-4 mr-2" />
                Import CSV
                <input type="file" accept=".csv" onChange={handleImportCsv} className="hidden" />
              </label>
              <button onClick={handleDownload} disabled={!stats.total} className={`btn-heist text-sm ${!stats.total ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Download className="w-4 h-4 mr-2" />
                Download bank CSV
              </button>
              <button onClick={handleClearBank} disabled={!stats.total} className={`btn-ghost text-sm ${!stats.total ? 'opacity-50 cursor-not-allowed' : ''}`} title="Wipe the bank">
                <Eraser className="w-4 h-4 mr-2" />
                Clear
              </button>
            </div>
          </div>

          {/* Sources breakdown */}
          {stats.bySource.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowSessions(!showSessions)}
                className="text-xs text-violet-300 hover:text-violet-200 flex items-center gap-1"
              >
                <History className="w-3.5 h-3.5" />
                {showSessions ? 'Hide' : 'Show'} sources ({stats.bySource.length})
              </button>
              {showSessions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stats.bySource.map(([src, count]) => (
                    <div key={src} className="badge group flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-300">{src}</span>
                      <span className="text-violet-300">· {count}</span>
                      <button
                        onClick={() => handleRemoveSource(src)}
                        className="text-rose-300 hover:text-rose-200 opacity-60 group-hover:opacity-100 transition-opacity"
                        title={`Remove all rows from ${src}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload — two slots, parse appends to bank */}
        <div className="card-heist mb-6">
          <h2 className="text-xl font-heist text-violet-200 mb-4">Add a paper to the bank</h2>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <FileSlot
              label="Exam paper (questions)"
              file={examFile}
              onPick={handleSelectExam}
              onClear={clearExam}
              parsing={parsing}
            />
            <FileSlot
              label="Mark scheme (answers)"
              file={markSchemeFile}
              onPick={handleSelectMarkScheme}
              onClear={clearMarkScheme}
              parsing={parsing}
            />
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              onClick={handleParse}
              disabled={parsing || (!examFile && !markSchemeFile)}
              className={`btn-heist flex-1 ${parsing || (!examFile && !markSchemeFile) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <FileText className="w-5 h-5 mr-2" />
              {parsing ? 'Parsing…' : `Parse & add to bank${stats.total ? ` (currently ${stats.total})` : ''}`}
            </button>
            <button onClick={startBlank} disabled={parsing} className="btn-ghost">
              <Plus className="w-4 h-4 mr-2" /> Add blank row
            </button>
          </div>

          {status && !error && (
            <div className="mt-4 p-3 rounded-lg bg-violet-500/10 border border-violet-400/30 text-violet-100 text-sm">
              {status}
            </div>
          )}
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm">
              {error}
            </div>
          )}
          <div className="mt-3 text-xs text-slate-500">
            <strong>Workflow:</strong> upload exam + mark scheme → click parse → file slots reset → upload the next pair → repeat.
            Duplicates (same topic + question) are skipped automatically. Your bank is saved in this browser.
          </div>
        </div>

        {/* Recent sessions log */}
        {sessions.length > 0 && (
          <div className="card-heist mb-6">
            <h3 className="text-sm font-semibold text-violet-200 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" /> Recent additions
            </h3>
            <div className="space-y-1 text-xs font-mono text-slate-400 max-h-40 overflow-y-auto">
              {sessions.map(s => (
                <div key={s.id} className="flex justify-between items-center gap-2 py-1 border-b border-white/5 last:border-b-0">
                  <span className="truncate">
                    <span className="text-violet-300">{s.source}</span>
                    {' · '}
                    <span className="text-slate-300">+{s.added}</span>
                    {s.skipped > 0 && <span className="text-amber-300"> (skipped {s.skipped})</span>}
                  </span>
                  <span className="text-slate-500 flex-shrink-0">{new Date(s.addedAt).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Editable Table */}
        {rows.length > 0 && (
          <div className="card-heist mb-6">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
              <h2 className="text-xl font-heist text-violet-200">
                Review & Edit
                <span className="ml-2 text-sm text-slate-400 font-sans">
                  ({filteredRows.length}{search ? ` of ${rows.length}` : ''})
                </span>
              </h2>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search topic / question / source…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input-heist pl-9 py-2 text-sm w-64"
                  />
                </div>
                <button onClick={addRow} className="btn-ghost text-sm">
                  <Plus className="w-4 h-4 mr-2" /> Row
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-violet-200 border-b border-white/10 text-left">
                    <th className="p-2 font-semibold w-16">Q#</th>
                    <th className="p-2 font-semibold w-28">Source</th>
                    <th className="p-2 font-semibold w-40">Topic *</th>
                    <th className="p-2 font-semibold w-64">Example Question</th>
                    <th className="p-2 font-semibold w-64">Model Answer *</th>
                    <th className="p-2 font-semibold w-48">Notes</th>
                    <th className="p-2 font-semibold w-24">Difficulty</th>
                    <th className="p-2 font-semibold w-16" title="Drives timer: marks × 90s">Marks</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    // Use original index for updateRow/deleteRow stability under filter
                    const i = rows.indexOf(row);
                    return (
                      <tr key={`${row.source || 'x'}-${row.label || ''}-${i}`} className="border-b border-white/5 align-top">
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.label || ''}
                            onChange={(e) => updateRow(i, 'label', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-violet-300 text-sm font-mono border border-slate-700 focus:border-violet-400 focus:outline-none text-center"
                            placeholder="1a"
                          />
                        </td>
                        <td className="p-1">
                          <input
                            type="text"
                            value={row.source || ''}
                            onChange={(e) => updateRow(i, 'source', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-slate-300 text-xs font-mono border border-slate-700 focus:border-violet-400 focus:outline-none"
                            placeholder="paper-id"
                            title="Which PDF this row came from"
                          />
                        </td>
                        <td className="p-1">
                          <textarea
                            value={row.topic}
                            onChange={(e) => updateRow(i, 'topic', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-white text-sm border border-slate-700 focus:border-violet-400 focus:outline-none"
                            rows={3}
                            placeholder="e.g. delegation"
                          />
                        </td>
                        <td className="p-1">
                          <textarea
                            value={row.exampleQuestion}
                            onChange={(e) => updateRow(i, 'exampleQuestion', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-white text-sm border border-slate-700 focus:border-violet-400 focus:outline-none"
                            rows={3}
                            placeholder="An example exam question"
                          />
                        </td>
                        <td className="p-1">
                          <textarea
                            value={row.modelAnswer}
                            onChange={(e) => updateRow(i, 'modelAnswer', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-white text-sm border border-slate-700 focus:border-violet-400 focus:outline-none"
                            rows={4}
                            placeholder="Model answer with key terms…"
                          />
                        </td>
                        <td className="p-1">
                          <textarea
                            value={row.notes}
                            onChange={(e) => updateRow(i, 'notes', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-white text-sm border border-slate-700 focus:border-violet-400 focus:outline-none"
                            rows={3}
                            placeholder="For full marks…"
                          />
                        </td>
                        <td className="p-1">
                          <select
                            value={row.difficulty}
                            onChange={(e) => updateRow(i, 'difficulty', e.target.value)}
                            className="w-full bg-slate-950/40 rounded-lg p-2 text-white text-sm border border-slate-700 focus:border-violet-400 focus:outline-none"
                          >
                            <option>EASY</option>
                            <option>MEDIUM</option>
                            <option>HARD</option>
                            <option>EXPERT</option>
                          </select>
                        </td>
                        <td className="p-1">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={row.marks || ''}
                            onChange={(e) => updateRow(i, 'marks', e.target.value)}
                            className="w-full p-2 bg-slate-950/40 rounded-lg text-white text-sm font-mono border border-slate-700 focus:border-violet-400 focus:outline-none text-center"
                            placeholder="—"
                            title="Drives timer: marks × 90s"
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            onClick={() => deleteRow(i)}
                            className="text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg"
                            title="Delete row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              * Topic and Model Answer are required. Rows missing both are skipped on export.
              {' '}Your bank is saved automatically — close the tab and come back any time.
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="card-heist">
          <h3 className="text-xl font-heist text-violet-200 mb-3">Building a bank from many papers</h3>
          <ol className="text-slate-300 space-y-2 list-decimal list-inside text-sm">
            <li>Upload your first exam + mark scheme pair and click <strong>Parse &amp; add to bank</strong>.</li>
            <li>File slots clear automatically. Pick the next pair and parse again — new questions append.</li>
            <li>Duplicates (same topic + question text) are skipped, so it's safe to re-parse a paper.</li>
            <li>Use the search box to find rows; edit topics, fill in missing model answers, set marks.</li>
            <li>Each row remembers which PDF it came from in the <strong>Source</strong> column — you can bulk-remove all rows from a bad source via the chip in the stats panel.</li>
            <li>Need to keep working tomorrow? Just close the tab — the bank is stored in this browser.</li>
            <li>Want to resume on another machine? Use <strong>Download bank CSV</strong>, then <strong>Import CSV</strong> on the other machine.</li>
            <li>When you're done, click <strong>Download bank CSV</strong> and upload it to <strong>Teacher Vault → Upload CSV</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── Reusable file-slot component ──────────────────────────────────────
function FileSlot({ label, file, onPick, onClear, parsing }) {
  return (
    <div>
      <div className="text-sm text-slate-300 mb-2 font-semibold">{label}</div>
      {file ? (
        <div className="flex items-center justify-between p-3 bg-violet-500/10 border border-violet-400/40 rounded-xl">
          <div className="flex items-center gap-2 text-violet-200 min-w-0">
            <FileCheck className="w-5 h-5 flex-shrink-0" />
            <span className="truncate text-sm">{file.name}</span>
          </div>
          <button
            onClick={onClear}
            disabled={parsing}
            className="text-rose-300 hover:bg-rose-500/10 p-1 rounded flex-shrink-0 ml-2"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="block">
          <input
            type="file"
            accept=".pdf"
            onChange={onPick}
            disabled={parsing}
            className="hidden"
          />
          <div className={`btn-ghost w-full text-center cursor-pointer ${parsing ? 'opacity-50 cursor-wait' : ''}`}>
            <Upload className="w-4 h-4 mr-2" /> Select PDF
          </div>
        </label>
      )}
    </div>
  );
}
