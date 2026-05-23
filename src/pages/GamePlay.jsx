import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Volume2, VolumeX, Home, Flag } from 'lucide-react';
import {
  getClass,
  getQuestionBank,
  updatePlayerScore,
  stealPoints,
  subscribeToLeaderboard,
  subscribeToEvents
} from '../firebase/firestore';
import { generateCampaign, scoreAnswer } from '../utils/questionGenerator';
import { useSound } from '../hooks/useSound';
import QuestionCard from '../components/Game/QuestionCard';
import FeedbackModal from '../components/Game/FeedbackModal';
import StealModal from '../components/Game/StealModal';
import EventTicker from '../components/Game/EventTicker';
import LiveLeaderboard from '../components/Leaderboard/LiveLeaderboard';

export default function GamePlay() {
  const { classCode, playerId } = useParams();
  const navigate = useNavigate();
  const sound = useSound();

  const [campaign, setCampaign] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [showSteal, setShowSteal] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [events, setEvents] = useState([]);
  const [musicOn, setMusicOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [gameComplete, setGameComplete] = useState(false);
  const startedAt = useRef(Date.now());

  // Load class and generate campaign
  useEffect(() => {
    const init = async () => {
      try {
        const classData = await getClass(classCode);
        if (!classData) {
          alert('Class not found. Returning to home.');
          navigate('/');
          return;
        }

        const bank = await getQuestionBank(classData.questionBankId);
        if (!bank || !bank.concepts || bank.concepts.length === 0) {
          alert('No questions found for this class. Ask your teacher.');
          navigate('/');
          return;
        }

        const generated = generateCampaign(bank.concepts, {
          unitFilter: classData.unitFilter || []
        });
        if (generated.length === 0) {
          alert(
            classData.unitFilter?.length
              ? `No questions found for the selected units in this bank. Ask your teacher to either pick different units or use a bank that covers them.`
              : 'No questions available. Ask your teacher.'
          );
          navigate('/');
          return;
        }
        setCampaign(generated);
        setLoading(false);
        sound.playBackground();
      } catch (e) {
        console.error(e);
        alert('Failed to load game: ' + e.message);
        navigate('/');
      }
    };
    init();
    return () => sound.stopBackground();
  }, [classCode]);

  // Live leaderboard
  useEffect(() => {
    const unsub = subscribeToLeaderboard(classCode, setLeaderboard);
    const unsubE = subscribeToEvents(classCode, setEvents);
    return () => { unsub(); unsubE(); };
  }, [classCode]);

  // Toggle music
  useEffect(() => {
    if (musicOn) sound.unmute(); else sound.mute();
  }, [musicOn]);

  const currentQuestion = campaign[currentQuestionIdx];
  const opponents = leaderboard.filter(p => p.id !== playerId);
  const me = leaderboard.find(p => p.id === playerId);

  const handleSubmitAnswer = async (submission) => {
    // QuestionCard now passes { answer, extraTimeUses } so we can dock points
    // for each Extra Time press (1 mark of the question's value per press).
    const { answer, extraTimeUses = 0 } = (typeof submission === 'string')
      ? { answer: submission, extraTimeUses: 0 }
      : submission;

    const result = scoreAnswer(answer, currentQuestion);

    // Mark penalty: each press = -1 mark of this question's value, where
    // 1 mark ≈ GAME_POINTS[difficulty] / question.marks.
    const GAME_POINTS = { EASY: 40, MEDIUM: 60, HARD: 100, EXPERT: 160 };
    const totalMarks = currentQuestion.marks && currentQuestion.marks > 0 ? currentQuestion.marks : 4;
    const maxPoints = GAME_POINTS[currentQuestion.difficulty] || 60;
    const pointsPerMark = Math.round(maxPoints / totalMarks);
    const penalty = extraTimeUses * pointsPerMark;
    const finalPoints = Math.max(0, result.pointsAwarded - penalty);

    const adjusted = {
      ...result,
      pointsAwarded: finalPoints,
      extraTimeUses,
      extraTimePenalty: penalty
    };

    if (adjusted.correct) sound.playCorrect();
    else                  sound.playWrong();

    await updatePlayerScore(classCode, playerId, adjusted.pointsAwarded, {
      correct: adjusted.correct,
      wrong: !adjusted.correct,
      questionsCompleted: 1
    });

    setFeedback({ ...adjusted, question: currentQuestion });
  };

  const handleFeedbackContinue = () => {
    const wasCorrect = feedback?.correct;
    setFeedback(null);

    if (wasCorrect && opponents.some(o => (o.score || 0) > 10)) {
      setShowSteal(true);
    } else {
      advanceQuestion();
    }
  };

  const handleSteal = async (victimId, amount) => {
    sound.playSteal();
    await stealPoints(classCode, playerId, victimId, amount);
    setShowSteal(false);
    advanceQuestion();
  };

  const handleSkipSteal = () => {
    setShowSteal(false);
    advanceQuestion();
  };

  const advanceQuestion = () => {
    if (currentQuestionIdx + 1 >= campaign.length) {
      setGameComplete(true);
      sound.playVictory();
      setTimeout(() => navigate(`/results/${classCode}/${playerId}`), 2000);
    } else {
      setCurrentQuestionIdx(i => i + 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="text-6xl"
        >
          🔓
        </motion.div>
        <p className="ml-4 text-heist-gold">Cracking the vault...</p>
      </div>
    );
  }

  if (gameComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="text-9xl mb-4">🏆</div>
          <h2 className="text-6xl text-heist-gold mb-2">HEIST COMPLETE!</h2>
          <p className="text-xl text-gray-400">Loading your final score...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={() => { if(confirm('Leave heist?')) navigate('/'); }} className="text-gray-400 hover:text-white">
            <Home className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-heist text-heist-gold">EXAM HEIST</h1>
          <span className="text-sm text-gray-400 hidden md:inline">{classCode}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMusicOn(m => !m)}
            className="p-2 rounded border border-heist-gold/30 hover:border-heist-gold"
            title={musicOn ? 'Mute' : 'Unmute'}
          >
            {musicOn ? <Volume2 className="w-5 h-5 text-heist-gold" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <div className="bg-heist-gold/10 px-4 py-2 rounded border border-heist-gold/30">
            <span className="text-xs text-gray-400">Your Score</span>
            <div className="text-2xl font-heist text-heist-gold">{me?.score || 0}</div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Question */}
        <div className="lg:col-span-2 space-y-4">
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionIdx + 1}
              totalQuestions={campaign.length}
              onSubmit={handleSubmitAnswer}
              opponents={opponents}
            />
          )}

          {/* Event ticker */}
          <EventTicker events={events} players={leaderboard} />
        </div>

        {/* Right: Leaderboard */}
        <div className="space-y-4">
          <div className="card-heist">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl text-heist-gold">🏆 Leaderboard</h3>
              <span className="text-xs text-gray-500">{leaderboard.length} thieves</span>
            </div>
            <LiveLeaderboard players={leaderboard} currentPlayerId={playerId} />
          </div>

          {/* Progress */}
          <div className="card-heist">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Heist Progress</span>
              <span className="text-heist-gold">{currentQuestionIdx + 1} / {campaign.length}</span>
            </div>
            <div className="h-2 bg-black/60 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-heist-gold to-heist-red"
                initial={{ width: 0 }}
                animate={{ width: `${((currentQuestionIdx + 1) / campaign.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {feedback && (
        <FeedbackModal
          result={feedback}
          question={feedback.question}
          onContinue={handleFeedbackContinue}
        />
      )}
      {showSteal && currentQuestion && (
        <StealModal
          opponents={opponents}
          questionDifficulty={currentQuestion.difficulty}
          onSteal={handleSteal}
          onSkip={handleSkipSteal}
        />
      )}
    </div>
  );
}
