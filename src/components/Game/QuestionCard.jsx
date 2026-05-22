import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Coins, Target, TimerReset } from 'lucide-react';

const DIFFICULTY_CONFIG = {
  EASY:   { color: 'text-cyan-300',    border: 'border-cyan-400/50',    bg: 'bg-cyan-500/10'    },
  MEDIUM: { color: 'text-violet-300',  border: 'border-violet-400/50',  bg: 'bg-violet-500/10'  },
  HARD:   { color: 'text-fuchsia-300', border: 'border-fuchsia-400/50', bg: 'bg-fuchsia-500/10' },
  EXPERT: { color: 'text-rose-300',    border: 'border-rose-400/50',    bg: 'bg-rose-500/10'    }
};

const GAME_POINTS = { EASY: 40, MEDIUM: 60, HARD: 100, EXPERT: 160 };

const SECONDS_PER_MARK = 90;
const EXTRA_TIME_SECONDS = 90;
// If a question is missing marks (shouldn't happen), fall back per difficulty.
const FALLBACK_MARKS = { EASY: 2, MEDIUM: 4, HARD: 6, EXPERT: 8 };

export default function QuestionCard({ question, questionNumber, totalQuestions, onSubmit, opponents = [] }) {
  const config = DIFFICULTY_CONFIG[question.difficulty];

  const marks = question.marks && question.marks > 0
    ? question.marks
    : (FALLBACK_MARKS[question.difficulty] || 4);
  const baseTime = marks * SECONDS_PER_MARK;

  const [answer, setAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(baseTime);
  const [submitted, setSubmitted] = useState(false);
  const [extraTimeUses, setExtraTimeUses] = useState(0);

  // Reset when question changes
  useEffect(() => {
    setAnswer('');
    setTimeLeft(baseTime);
    setSubmitted(false);
    setExtraTimeUses(0);
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
    // Pass back the answer + how many extra-time presses they used so
    // GamePlay can dock points (1 mark of the question's value per press).
    onSubmit({ answer, extraTimeUses });
  };

  const handleExtraTime = () => {
    if (submitted) return;
    setTimeLeft(t => t + EXTRA_TIME_SECONDS);
    setExtraTimeUses(n => n + 1);
  };

  const topOpponentScore = opponents.length > 0
    ? Math.max(...opponents.map(o => o.score || 0))
    : 0;

  const pointsPerMark = Math.round(GAME_POINTS[question.difficulty] / marks);
  const penaltySoFar = extraTimeUses * pointsPerMark;
  const projectedMax = Math.max(0, GAME_POINTS[question.difficulty] - penaltySoFar);

  const lowTime = timeLeft < 15;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.3 }}
      className={`card-heist border ${config.border}`}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 text-sm font-mono">Q {questionNumber}/{totalQuestions}</span>
          <span className={`badge ${config.bg} ${config.color} border ${config.border}`}>
            {question.difficulty}
          </span>
          <span className="badge badge-violet">{question.commandWord}</span>
          <span className="badge">[{marks} {marks === 1 ? 'mark' : 'marks'}]</span>
        </div>
        <div className={`flex items-center gap-2 font-mono text-xl ${lowTime ? 'text-rose-400 animate-pulse' : 'text-slate-100'}`}>
          <Clock className="w-5 h-5" />
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
      </div>

      {/* Business Context */}
      {question.businessContext && question.requiresContext !== false && (
        <div className="mb-4 p-4 rounded-xl bg-slate-950/40 border border-violet-400/20">
          <div className="text-xs uppercase tracking-wider text-violet-300 mb-1">Business Context</div>
          <p className="text-slate-300 text-sm leading-relaxed">{question.businessContext}</p>
        </div>
      )}

      {/* Question Text */}
      <div className="mb-5">
        <h3 className={`text-xl mb-2 font-heist ${config.color}`}>
          {question.commandWord.toUpperCase()}
        </h3>
        <p className="text-lg text-white leading-relaxed">{question.questionText}</p>
      </div>

      {/* Reward Info */}
      <div className="flex flex-wrap gap-2 mb-4 text-sm">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-400/30">
          <Coins className="w-4 h-4 text-violet-300" />
          <span className="text-violet-200">
            {extraTimeUses > 0 ? (
              <>
                <span className="line-through text-slate-500 mr-1">+{GAME_POINTS[question.difficulty]}</span>
                +{projectedMax} pts max
              </>
            ) : (
              <>+{GAME_POINTS[question.difficulty]} points</>
            )}
          </span>
        </div>
        {topOpponentScore > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-400/30">
            <Target className="w-4 h-4 text-rose-300" />
            <span className="text-rose-200">Steal target: up to {Math.floor(topOpponentScore * 0.25)} pts</span>
          </div>
        )}
        {extraTimeUses > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/30">
            <TimerReset className="w-4 h-4 text-amber-300" />
            <span className="text-amber-200">
              −{extraTimeUses} {extraTimeUses === 1 ? 'mark' : 'marks'} ({penaltySoFar} pts) from Extra Time
            </span>
          </div>
        )}
      </div>

      {/* Answer Input */}
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={submitted}
        placeholder={getPlaceholder(question.commandWord)}
        className="input-heist h-32 resize-none font-sans"
      />

      {/* Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 mt-4">
        <button
          onClick={handleSubmit}
          disabled={submitted || !answer.trim()}
          className={`btn-heist ${(submitted || !answer.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {submitted ? 'SUBMITTED' : 'Submit answer'}
        </button>
        <button
          onClick={handleExtraTime}
          disabled={submitted}
          title={`Adds ${EXTRA_TIME_SECONDS}s but costs 1 mark (~${pointsPerMark} pts).`}
          className={`btn-ghost ${submitted ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <TimerReset className="w-4 h-4 mr-2" />
          + {EXTRA_TIME_SECONDS}s
          <span className="ml-2 text-xs opacity-70">(−1 mark)</span>
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        Tip: pressing Extra Time gives you {EXTRA_TIME_SECONDS} more seconds, but each press deducts 1 mark from this question's value. You can press it as many times as you like.
      </div>
    </motion.div>
  );
}

const getPlaceholder = (cmd) => {
  switch (cmd) {
    case 'Define':   return 'Write a precise definition — or illustrate the concept with an example (e.g. with numbers)...';
    case 'Identify': return 'List your answers — separate each with a "." "/" or a new line.';
    case 'State':    return 'List your answers — separate each with a "." "/" or a new line.';
    case 'Outline':  return 'Give reasons AND reference the business. Separate each item with "." "/" or a new line.';
    case 'Explain':  return 'Give methods AND develop each one with cause-and-effect. Separate items with "." "/" or a new line.';
    case 'Justify':  return 'Take a position, compare alternatives, and justify WHY...';
    default:         return 'Write your answer here...';
  }
};
