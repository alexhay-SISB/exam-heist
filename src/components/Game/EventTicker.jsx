import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

export default function EventTicker({ events = [], players = [] }) {
  const getPlayerName = (id) => {
    const p = players.find(pl => pl.id === id);
    return p ? p.name : 'Unknown';
  };

  if (events.length === 0) return null;

  return (
    <div className="card-heist max-h-48 overflow-hidden">
      <div className="flex items-center gap-2 mb-2 text-heist-gold uppercase text-sm">
        <Zap className="w-4 h-4 animate-pulse" />
        Live Activity
      </div>
      <AnimatePresence>
        <div className="space-y-1">
          {events.slice(0, 5).map(event => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="text-sm text-gray-300 flex items-center gap-2"
            >
              {event.type === 'steal' && (
                <>
                  <span className="text-heist-red">💰</span>
                  <span>
                    <strong className="text-heist-red">{getPlayerName(event.robberId)}</strong>
                    {' '}robbed{' '}
                    <strong>{getPlayerName(event.victimId)}</strong>
                    {' '}of {event.amount} pts!
                  </span>
                </>
              )}
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}
