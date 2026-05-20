import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, RefreshCw, Trophy } from 'lucide-react';
import { subscribeToLeaderboard } from '../firebase/firestore';
import LiveLeaderboard from '../components/Leaderboard/LiveLeaderboard';

export default function GameResults() {
  const { classCode, playerId } = useParams();
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const unsub = subscribeToLeaderboard(classCode, setLeaderboard);
    return () => unsub();
  }, [classCode]);

  const me = leaderboard.find(p => p.id === playerId);
  const myRank = leaderboard.findIndex(p => p.id === playerId) + 1;
  const accuracy = me && (me.correctAnswers + me.wrongAnswers) > 0
    ? Math.round((me.correctAnswers / (me.correctAnswers + me.wrongAnswers)) * 100)
    : 0;

  const achievements = [];
  if (me) {
    if (myRank === 1) achievements.push({ icon: '👑', name: 'Kingpin', desc: 'Finished 1st place' });
    if (myRank <= 3) achievements.push({ icon: '🥉', name: 'Podium', desc: 'Top 3 finish' });
    if (me.pointsStolen >= 200) achievements.push({ icon: '🦊', name: 'Master Thief', desc: '200+ points stolen' });
    if (me.correctAnswers >= 20) achievements.push({ icon: '🧠', name: 'Brain Box', desc: '20+ correct answers' });
    if (accuracy >= 80) achievements.push({ icon: '🎯', name: 'Sharpshooter', desc: '80%+ accuracy' });
    if (me.questionsCompleted >= 30) achievements.push({ icon: '💪', name: 'Marathon', desc: 'Completed 30+ questions' });
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Trophy className="w-20 h-20 mx-auto mb-2 text-heist-gold" />
          <h1 className="text-6xl font-heist text-heist-gold mb-2">HEIST COMPLETE</h1>
          <p className="text-xl text-gray-400">The vault is empty. The thieves count their loot.</p>
        </motion.div>

        {me && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="card-heist mb-6 text-center"
          >
            <div className="text-sm text-gray-400 uppercase mb-2">Your Performance</div>
            <div className="text-7xl font-heist text-heist-gold mb-2">{me.score}</div>
            <div className="text-xl mb-4">{me.name} • Rank #{myRank} of {leaderboard.length}</div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <Stat label="Correct" value={me.correctAnswers || 0} color="text-heist-neon" />
              <Stat label="Wrong" value={me.wrongAnswers || 0} color="text-heist-red" />
              <Stat label="Accuracy" value={`${accuracy}%`} color="text-heist-gold" />
              <Stat label="Stolen" value={me.pointsStolen || 0} color="text-purple-400" />
            </div>
          </motion.div>
        )}

        {/* Achievements */}
        {achievements.length > 0 && (
          <div className="card-heist mb-6">
            <h2 className="text-2xl text-heist-gold mb-4">🏅 Achievements Unlocked</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {achievements.map((a, i) => (
                <motion.div
                  key={a.name}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="bg-heist-gold/10 border border-heist-gold/30 rounded-lg p-3 text-center"
                >
                  <div className="text-3xl mb-1">{a.icon}</div>
                  <div className="font-bold text-heist-gold">{a.name}</div>
                  <div className="text-xs text-gray-400">{a.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Final Leaderboard */}
        <div className="card-heist mb-6">
          <h2 className="text-2xl text-heist-gold mb-4">🏆 Final Leaderboard</h2>
          <LiveLeaderboard players={leaderboard} currentPlayerId={playerId} showStats={true} />
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <button onClick={() => navigate('/')} className="btn-ghost flex items-center gap-2">
            <Home className="w-4 h-4" /> Home
          </button>
          <button onClick={() => window.location.reload()} className="btn-heist flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> View Live
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className={`text-3xl font-heist ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
    </div>
  );
}
