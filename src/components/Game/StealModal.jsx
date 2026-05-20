import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, AlertTriangle } from 'lucide-react';
import { calculateStealAmount } from '../../utils/questionGenerator';

export default function StealModal({ opponents, questionDifficulty, onSteal, onSkip }) {
  const eligibleTargets = opponents.filter(o => (o.score || 0) > 10);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.8, y: 50 }}
          animate={{ scale: 1, y: 0 }}
          className="card-heist max-w-xl w-full border-2 border-heist-red shadow-[0_0_30px_rgba(220,20,60,0.3)]"
        >
          <div className="text-center mb-6">
            <Target className="w-16 h-16 mx-auto mb-2 text-heist-red animate-pulse" />
            <h2 className="text-4xl text-heist-red">CHOOSE YOUR TARGET</h2>
            <p className="text-gray-400 mt-2">Rob a rival of their hard-earned points</p>
          </div>

          {eligibleTargets.length === 0 ? (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 mx-auto mb-2 text-heist-gold" />
              <p className="text-gray-400">No targets have enough points to steal from yet.</p>
              <p className="text-sm text-gray-500 mt-1">Keep playing — opportunities will appear!</p>
            </div>
          ) : (
            <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
              {eligibleTargets.map((opp) => {
                const stealAmount = calculateStealAmount(opp.score, questionDifficulty);
                return (
                  <motion.button
                    key={opp.id}
                    whileHover={{ scale: 1.02, x: 5 }}
                    onClick={() => onSteal(opp.id, stealAmount)}
                    className="w-full p-4 bg-black/40 border-2 border-heist-red/30 rounded-lg hover:border-heist-red transition-all flex justify-between items-center group"
                  >
                    <div className="text-left">
                      <div className="font-bold text-lg">{opp.name}</div>
                      <div className="text-sm text-gray-400">Has {opp.score || 0} pts</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-heist text-heist-red group-hover:scale-110 transition-transform">
                        +{stealAmount}
                      </div>
                      <div className="text-xs text-gray-500">ROB</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="bg-heist-gold/10 border border-heist-gold/30 rounded p-3 mb-4 text-sm text-heist-gold">
            ⚠ Warning: Targets will see who robbed them. Choose wisely.
          </div>

          <button onClick={onSkip} className="btn-ghost w-full flex items-center justify-center gap-2">
            <X className="w-4 h-4" /> SKIP STEALING (PLAY IT SAFE)
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
