import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Upload, FileText, Trash2, Users, RefreshCw, ArrowLeft, Trophy, Download } from 'lucide-react';
import { parseCSV, generateCSVTemplate, downloadCSV } from '../utils/csvParser';
import { buildQuestionBankFromCSV } from '../utils/questionGenerator';
import {
  saveQuestionBank,
  listQuestionBanks,
  deleteQuestionBank,
  createClass,
  resetSession,
  subscribeToLeaderboard
} from '../firebase/firestore';
import LiveLeaderboard from '../components/Leaderboard/LiveLeaderboard';

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [questionBanks, setQuestionBanks] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [selectedBank, setSelectedBank] = useState(null);
  const [classCode, setClassCode] = useState('');
  const [activeClass, setActiveClass] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    if (authenticated) loadBanks();
  }, [authenticated]);

  useEffect(() => {
    if (activeClass) {
      const unsub = subscribeToLeaderboard(activeClass, setLeaderboard);
      return () => unsub();
    }
  }, [activeClass]);

  const loadBanks = async () => {
    try {
      const banks = await listQuestionBanks();
      setQuestionBanks(banks);
    } catch (e) {
      console.error('Could not load banks:', e);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const expected = import.meta.env.VITE_TEACHER_PASSWORD || 'teacher123';
    if (password === expected) {
      setAuthenticated(true);
    } else {
      alert('Wrong password. Try again, thief!');
    }
  };

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(`📄 Reading ${file.name}...`);

    try {
      const text = await file.text();
      setUploadStatus('🔨 Parsing CSV...');
      const rows = parseCSV(text);

      setUploadStatus(`📚 Building question bank from ${rows.length} topics...`);
      const concepts = buildQuestionBankFromCSV(rows);

      if (concepts.length === 0) {
        throw new Error('No valid rows found in the CSV.');
      }

      const bankId = `bank_${Date.now()}`;
      const bankName = file.name.replace(/\.csv$/i, '');

      await saveQuestionBank(bankId, {
        name: bankName,
        questionCount: concepts.length,
        concepts
      });

      setUploadStatus(`✅ Created bank "${bankName}" with ${concepts.length} topics!`);
      await loadBanks();
      setTimeout(() => setUploadStatus(''), 4000);
    } catch (error) {
      console.error(error);
      setUploadStatus(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate();
    downloadCSV('exam-heist-template.csv', csv);
  };

  const handleStartClass = async () => {
    if (!selectedBank || !classCode) {
      alert('Select a question bank and enter a class code');
      return;
    }
    try {
      await createClass(classCode.toUpperCase(), selectedBank.id, 'Teacher');
      setActiveClass(classCode.toUpperCase());
    } catch (e) {
      alert('Failed to start class: ' + e.message);
    }
  };

  const handleResetClass = async () => {
    if (!activeClass) return;
    if (!confirm(`Reset all scores for class ${activeClass}?`)) return;
    try {
      await resetSession(activeClass);
      alert('Class reset!');
    } catch (e) {
      alert('Reset failed: ' + e.message);
    }
  };

  const handleDeleteBank = async (bankId) => {
    if (!confirm('Delete this question bank?')) return;
    await deleteQuestionBank(bankId);
    await loadBanks();
  };

  // ===== LOGIN SCREEN =====
  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="card-heist max-w-md w-full"
        >
          <button onClick={() => navigate('/')} className="text-heist-gold mb-4 flex items-center gap-2 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-4xl text-heist-gold mb-4">🔐 TEACHER VAULT</h2>
          <p className="text-gray-400 mb-6">Enter the secret code to access the dashboard.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="input-heist"
              autoFocus
            />
            <button type="submit" className="btn-heist w-full">UNLOCK VAULT</button>
          </form>
          <p className="text-xs text-gray-500 mt-4">
            Default password: <code className="text-heist-gold">teacher123</code> (change in .env)
          </p>
        </motion.div>
      </div>
    );
  }

  // ===== MAIN DASHBOARD =====
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button onClick={() => navigate('/')} className="text-heist-gold mb-2 flex items-center gap-2 hover:underline">
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
            <h1 className="text-5xl text-heist-gold">TEACHER VAULT</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* CSV UPLOAD */}
          <div className="card-heist">
            <h2 className="text-2xl text-heist-gold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6" /> Upload Topics CSV
            </h2>
            <p className="text-gray-400 mb-4 text-sm">
              Upload a CSV of topics with model answers and marking notes.
              The game generates varied questions (Define / Identify / Explain / Justify…) around each topic.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDownloadTemplate}
                className="btn-ghost flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download CSV Template
              </button>
              <label className="block">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <div className={`btn-heist text-center cursor-pointer ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                  {uploading ? 'Processing...' : 'Upload CSV File'}
                </div>
              </label>
            </div>
            {uploadStatus && (
              <div className="mt-4 p-3 bg-black/40 rounded text-sm">{uploadStatus}</div>
            )}
            <div className="mt-4 text-xs text-gray-500">
              Required columns: <code className="text-heist-gold">topic</code>, <code className="text-heist-gold">model_answer</code>.
              Optional: <code>example_question</code>, <code>notes</code>, <code>difficulty</code> (EASY/MEDIUM/HARD/EXPERT).
            </div>
          </div>

          {/* START CLASS */}
          <div className="card-heist">
            <h2 className="text-2xl text-heist-gold mb-4 flex items-center gap-2">
              <Users className="w-6 h-6" /> Start a Class
            </h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Class code (e.g. 9A-BIZ)"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                className="input-heist"
                maxLength={20}
              />
              <div className="text-xs text-gray-400">
                Selected bank: {selectedBank ? selectedBank.name : '(none — pick below)'}
              </div>
              <button onClick={handleStartClass} className="btn-heist w-full">
                START / RESUME CLASS
              </button>
              {activeClass && (
                <div className="text-center text-heist-neon">
                  ✅ Class active: <strong>{activeClass}</strong>
                  <br />
                  <span className="text-sm text-gray-400">Students join at /join with this code</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* QUESTION BANKS */}
        <div className="card-heist mb-6">
          <h2 className="text-2xl text-heist-gold mb-4 flex items-center gap-2">
            <FileText className="w-6 h-6" /> Question Banks ({questionBanks.length})
          </h2>
          {questionBanks.length === 0 ? (
            <p className="text-gray-500 italic">No banks yet. Upload a PDF above to create one.</p>
          ) : (
            <div className="space-y-2">
              {questionBanks.map(bank => (
                <div
                  key={bank.id}
                  className={`p-3 rounded-lg border-2 transition-all flex justify-between items-center ${
                    selectedBank?.id === bank.id
                      ? 'border-heist-gold bg-heist-gold/10'
                      : 'border-gray-700 hover:border-heist-gold/50'
                  }`}
                >
                  <div className="cursor-pointer flex-1" onClick={() => setSelectedBank(bank)}>
                    <div className="font-bold">{bank.name}</div>
                    <div className="text-xs text-gray-400">
                      {bank.questionCount} concepts • Created {bank.createdAt?.toDate?.()?.toLocaleDateString() || 'recently'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="text-heist-red hover:bg-heist-red/10 p-2 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LIVE LEADERBOARD */}
        {activeClass && (
          <div className="card-heist">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl text-heist-gold flex items-center gap-2">
                <Trophy className="w-6 h-6" /> Live Leaderboard - {activeClass}
              </h2>
              <button onClick={handleResetClass} className="btn-ghost text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Reset Scores
              </button>
            </div>
            <LiveLeaderboard players={leaderboard} showStats={true} />
          </div>
        )}
      </div>
    </div>
  );
}
