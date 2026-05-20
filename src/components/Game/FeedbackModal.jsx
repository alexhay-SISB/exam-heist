import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, BookOpen, Lightbulb } from 'lucide-react';

export default function FeedbackModal({ result, question, onContinue }) {
  if (!result) return null;

  const isCorrect = result.correct;

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
          transition={{ type: 'spring', damping: 20 }}
          className={`card-heist max-w-2xl w-full max-h-[90vh] overflow-y-auto border-2 ${
            isCorrect ? 'border-heist-neon shadow-[0_0_30px_rgba(57,255,20,0.3)]' : 'border-heist-red shadow-[0_0_30px_rgba(220,20,60,0.3)]'
          }`}
        >
          <div className={`text-center mb-6 ${isCorrect ? 'text-heist-neon' : 'text-heist-red'}`}>
            {isCorrect ? (
              <>
                <CheckCircle className="w-20 h-20 mx-auto mb-2" />
                <h2 className="text-4xl">CORRECT!</h2>
                <p className="text-2xl mt-2">+{result.pointsAwarded} POINTS</p>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 mx-auto mb-2" />
                <h2 className="text-4xl">NOT QUITE</h2>
                <p className="text-lg mt-2 text-gray-400">No points this round</p>
              </>
            )}
          </div>

          {/* Feedback */}
          <div className="bg-black/40 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2 text-heist-gold">
              <Lightbulb className="w-5 h-5" />
              <span className="uppercase text-sm tracking-wider">Feedback</span>
            </div>
            <p className="text-white">{result.feedback}</p>
          </div>

          {/* Keywords hit */}
          {result.keywordsHit && result.keywordsHit.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">✅ You included:</div>
              <div className="flex flex-wrap gap-2">
                {result.keywordsHit.slice(0, 5).map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-heist-neon/20 text-heist-neon rounded text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Keywords missed */}
          {result.keywordsMissed && result.keywordsMissed.length > 0 && (
            <div className="mb-4">
              <div className="text-sm text-gray-400 mb-2">💡 You could have included:</div>
              <div className="flex flex-wrap gap-2">
                {result.keywordsMissed.slice(0, 5).map((kw, i) => (
                  <span key={i} className="px-2 py-1 bg-heist-gold/20 text-heist-gold rounded text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Suggested answer */}
          {result.suggestedAnswer && (
            <div className="bg-heist-gold/10 border border-heist-gold/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2 text-heist-gold">
                <BookOpen className="w-5 h-5" />
                <span className="uppercase text-sm tracking-wider">Example Answer</span>
              </div>
              <p className="text-gray-200 text-sm italic">{result.suggestedAnswer}</p>
            </div>
          )}

          <button onClick={onContinue} className="btn-heist w-full">
            {isCorrect ? 'CHOOSE TARGET TO ROB →' : 'NEXT QUESTION →'}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
