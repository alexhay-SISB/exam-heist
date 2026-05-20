import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Coins, Target } from 'lucide-react';

const DIFFICULTY_CONFIG = {
  EASY: { color: 'text-green-400', border: 'border-green-400', bg: 'bg-green-400/10', time: 45 },
  MEDIUM: { color: 'text-blue-400', border: 'border-blue-400', bg: 'bg-blue-400/10', time: 60 },
  HARD: { color: 'text-orange-400', border: 'border-orange-400', bg: 'bg-orange-400/10', time: 90 },
  EXPERT: { color: 'text-heist-red', border: 'border-heist-red', bg: 'bg-heist-red/10', time: 120 }
};

const GAME_POINTS = { EASY: 40, MEDIUM: 60, HARD: 100, EXPERT: 160 };

export default function QuestionCard({ question, questionNumber, totalQuestions, onSubmit, opponents = [] }) {
  const config = DIFFICULTY_CONFIG[question.difficulty];
  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(config.time);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setAnswer('');
    setTimeLeft(config.time);
    setSubmitted(false);
  }, [question.id]);

  useEffect(() => {
    if (submitted || timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, submitted]);

  useEffect(() => {
    if (timeLeft === 0 && !submitted) handleSubmit();
  }, [timeLeft]);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit(answer);
  };

  const isMultipleChoice = question.commandWord === 'Identify' && question.marks <= 2;

  const topOpponentScore = opponents.length > 0
    ? Math.max(...opponents.map(o => o.score || 0))
    : 0;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`card-heist border-2 ${config.border}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-gray-400 text-sm">
            Q {questionNumber}/{totalQuestions}
          </span>
          <span className={`px-3 py-1 rounded text-sm font-bold ${config.bg} ${config.color}`}>
            {question.difficulty}
          </span>
          <span className="px-3 py-1 rounded text-sm bg-heist-gold/20 text-heist-gold">
            {question.commandWord}
          </span>
          <span className="text-sm text-gray-400">[{question.marks} marks]</span>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xl ${timeLeft < 10 ? 'text-heist-red animate-pulse' : 'text-white'}`}>
          <Clock className="w-5 h-5" />
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Business Context (for context-dependent questions) */}
      {question.businessContext && question.requiresContext !== false && (
        <div className="mb-4 p-4 bg-black/40 rounded-lg border-l-4 border-heist-gold">
          <div className="text-xs text-heist-gold uppercase mb-1">Business Context</div>
          <p className="text-gray-300 text-sm leading-relaxed">{question.businessContext}</p>
        </div>
      )}

      {/* Question Text */}
      <div className="mb-6">
        <h3 className={`text-2xl mb-2 ${config.color}`}>
          {question.commandWord.toUpperCase()}
        </h3>
        <p className="text-lg text-white leading-relaxed">{question.questionText}</p>
      </div>

      {/* Reward Info */}
      <div className="flex flex-wrap gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-heist-gold/10 rounded border border-heist-gold/30">
          <Coins className="w-4 h-4 text-heist-gold" />
          <span className="text-heist-gold">+{GAME_POINTS[question.difficulty]} points</span>
        </div>
        {topOpponentScore > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-heist-red/10 rounded border border-heist-red/30">
            <Target className="w-4 h-4 text-heist-red" />
            <span className="text-heist-red">Steal target: up to {Math.floor(topOpponentScore * 0.25)} pts</span>
          </div>
        )}
      </div>

      {/* Answer Input */}
      {isMultipleChoice ? (
        <MultipleChoiceInput question={question} onAnswer={setAnswer} answer={answer} disabled={submitted} />
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          placeholder={getPlaceholder(question.commandWord)}
          className="input-heist h-32 resize-none"
        />
      )}

      <button
        onClick={handleSubmit}
        disabled={submitted || !answer.trim()}
        className="btn-heist w-full mt-4"
      >
        {submitted ? 'SUBMITTED!' : 'SUBMIT ANSWER 🔓'}
      </button>
    </motion.div>
  );
}

function MultipleChoiceInput({ question, onAnswer, answer, disabled }) {
  const options = question.acceptableAnswers && question.acceptableAnswers.length >= 2
    ? question.acceptableAnswers.slice(0, 4)
    : ['Option A', 'Option B', 'Option C', 'Option D'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => onAnswer(opt)}
          disabled={disabled}
          className={`p-3 rounded-lg border-2 text-left transition-all ${
            answer === opt
              ? 'border-heist-gold bg-heist-gold/20'
              : 'border-gray-700 hover:border-heist-gold/50'
          }`}
        >
          {String.fromCharCode(65 + i)}) {opt.slice(0, 80)}
        </button>
      ))}
    </div>
  );
}

const getPlaceholder = (cmd) => {
  switch (cmd) {
    case 'Define': return 'Write a precise definition...';
    case 'Identify': return 'List your answer(s) clearly...';
    case 'Outline': return 'Give reasons AND reference the business...';
    case 'Explain': return 'Give methods AND develop each one with cause-and-effect...';
    case 'Justify': return 'Take a position, compare alternatives, and justify WHY...';
    default: return 'Write your answer here...';
  }
};
