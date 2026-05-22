import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, Medal, Award } from 'lucide-react';

export default function LiveLeaderboard({ players = [], currentPlayerId = null, showStats = false }) {
  if (!players || players.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-30" />
        <p>No players yet. Waiting for thieves to join...</p>
      </div>
    );
  }

  const getRankIcon = (rank) => {
    if (rank === 0) return <Crown className="w-6 h-6 text-violet-300 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]" />;
    if (rank === 1) return <Medal className="w-6 h-6 text-indigo-300" />;
    if (rank === 2) return <Award className="w-6 h-6 text-fuchsia-300" />;
    return <span className="text-slate-500 font-semibold w-6 text-center">{rank + 1}</span>;
  };

  const getRankColor = (rank, isCurrent) => {
    if (isCurrent) return 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_18px_rgba(34,211,238,0.35)]';
    if (rank === 0) return 'border-violet-400/50 bg-violet-500/10';
    if (rank === 1) return 'border-indigo-400/40 bg-indigo-500/[0.06]';
    if (rank === 2) return 'border-fuchsia-400/40 bg-fuchsia-500/[0.06]';
    return 'border-slate-700/60 bg-slate-900/30';
  };

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {players.map((player, idx) => {
          const isCurrent = player.id === currentPlayerId;
          return (
            <motion.div
              key={player.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className={`p-3 rounded-lg border-2 flex items-center gap-3 transition-all ${getRankColor(idx, isCurrent)}`}
            >
              <div className="w-8 flex justify-center">{getRankIcon(idx)}</div>
              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  {player.name}
                  {isCurrent && <span className="text-xs bg-heist-neon text-black px-2 rounded">YOU</span>}
                </div>
                {showStats && (
                  <div className="text-xs text-gray-400 flex gap-3">
                    <span>✓ {player.correctAnswers || 0}</span>
                    <span>✗ {player.wrongAnswers || 0}</span>
                    <span>💰 stolen: {player.pointsStolen || 0}</span>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-heist text-heist-gold">{player.score || 0}</div>
                <div className="text-xs text-gray-500">pts</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
