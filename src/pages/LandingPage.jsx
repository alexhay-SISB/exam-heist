import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users, Lock } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <h1 className="text-7xl md:text-9xl font-heist text-gradient mb-4 tracking-tight drop-shadow-[0_0_24px_rgba(167,139,250,0.45)]">
          EXAM HEIST
        </h1>
        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto">
          The high-stakes revision game where knowledge is currency and rivals are targets.
        </p>
        <div className="mt-6 inline-block px-4 py-2 bg-heist-red/20 border border-heist-red rounded text-heist-red text-sm uppercase tracking-wider">
          ⚠ Top secret: For IGCSE thieves only
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
        className="grid md:grid-cols-2 gap-6 max-w-4xl w-full"
      >
        <motion.div
          whileHover={{ scale: 1.03 }}
          className="card-heist cursor-pointer group"
          onClick={() => navigate('/join')}
        >
          <Users className="w-16 h-16 text-heist-gold mb-4 group-hover:animate-pulse" />
          <h2 className="text-3xl text-heist-gold mb-2">JOIN A HEIST</h2>
          <p className="text-gray-400 mb-4">Enter your class code and become a master thief of knowledge.</p>
          <button className="btn-heist w-full">START PLAYING</button>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.03 }}
          className="card-heist cursor-pointer group"
          onClick={() => navigate('/teacher')}
        >
          <GraduationCap className="w-16 h-16 text-heist-gold mb-4 group-hover:animate-pulse" />
          <h2 className="text-3xl text-heist-gold mb-2">TEACHER VAULT</h2>
          <p className="text-gray-400 mb-4">Upload exams, set up classes, view live leaderboard.</p>
          <button className="btn-ghost w-full flex items-center justify-center gap-2">
            <Lock className="w-4 h-4" /> SECURE ACCESS
          </button>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-12 text-center text-gray-500 text-sm"
      >
        <p>🎯 Steal points • 💰 Climb the leaderboard • 📚 Learn from your mistakes</p>
      </motion.div>
    </div>
  );
}
