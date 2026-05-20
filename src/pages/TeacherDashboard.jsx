import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Trash2, Users, RefreshCw, ArrowLeft, Trophy, Eye } from 'lucide-react';
import { extractTextFromPDF, parseExamPaper, parseAnswerKey } from '../utils/pdfParser';
import { buildQuestionBank } from '../utils/questionGenerator';
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

  const handlePDFUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadStatus('🔍 Extracting text from PDF(s)...');

    try {
      // Allow uploading question paper + answer paper as two files
      let examPages = [];
      let answerPages = [];

      for (const file of files) {
        setUploadStatus(`📄 Reading ${file.name}...`);
        const pages = await extractTextFromPDF(file);
        const fullText = pages.join(' ');

        // Detect if this is mark scheme/answer or question paper
        if (/mark scheme|published|answer/i.test(fullText.slice(0, 1000))) {
          answerPages = answerPages.length > 0 ? [...answerPages, ...pages] : pages;
        } else {
          examPages = examPages.length > 0 ? [...examPages, ...pages] : pages;
        }

        // If single file contains both
        if (files.length === 1) {
          const splitIdx = pages.findIndex(p => /mark scheme|published/i.test(p));
          if (splitIdx > 0) {
            examPages = pages.slice(0, splitIdx);
            answerPages = pages.slice(splitIdx);
          } else {
            examPages = pages;
          }
        }
      }

      setUploadStatus('🧠 Identifying questions and concepts...');
      const parsedExam = parseExamPaper(examPages);

      setUploadStatus('📝 Parsing answer key...');
      const parsedAnswers = answerPages.length > 0 ? parseAnswerKey(answerPages) : {};

      setUploadStatus('🔨 Building question bank...');
      const questionBank = buildQuestionBank(parsedExam, parsedAnswers);

      if (questionBank.length === 0) {
        throw new Error('No questions detected. Please check the PDF format.');
      }

      const bankId = `bank_${Date.now()}`;
      const bankName = files[0].name.replace('.pdf', '');

      await saveQuestionBank(bankId, {
        name: bankName,
        questionCount: questionBank.length,
        concepts: questionBank,
        rawExam: parsedExam.map(cs => ({
          caseStudyNumber: cs.caseStudyNumber,
          businessContext: cs.businessContext,
          questionCount: cs.questions.length
        }))
      });

      setUploadStatus(`✅ Created bank "${bankName}" with ${questionBank.length} concepts!`);
      await loadBanks();
      setTimeout(() => setUploadStatus(''), 3000);
    } catch (error) {
      console.error(error);
      setUploadStatus(`❌ Error: ${error.message}`);
    } finally {
      setUploading(false);
    }
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
          {/* PDF UPLOAD */}
          <div className="card-heist">
            <h2 className="text-2xl text-heist-gold mb-4 flex items-center gap-2">
              <Upload className="w-6 h-6" /> Upload Exam PDF(s)
            </h2>
            <p className="text-gray-400 mb-4 text-sm">
              Upload exam paper + answer key (separate or combined). System auto-detects which is which.
            </p>
            <label className="block">
              <input
                type="file"
                accept=".pdf"
                multiple
                onChange={handlePDFUpload}
                disabled={uploading}
                className="hidden"
              />
              <div className={`btn-heist text-center cursor-pointer ${uploading ? 'opacity-50 cursor-wait' : ''}`}>
                {uploading ? 'Processing...' : 'Choose PDF File(s)'}
              </div>
            </label>
            {uploadStatus && (
              <div className="mt-4 p-3 bg-black/40 rounded text-sm">{uploadStatus}</div>
            )}
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
