import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, KeyRound, User } from 'lucide-react';
import { getClass, joinSession } from '../firebase/firestore';

export default function StudentLobby() {
  const navigate = useNavigate();
  const [classCode, setClassCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!classCode || !playerName) {
      setError('Both fields required, thief.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const code = classCode.toUpperCase().trim();
      const classData = await getClass(code);

      if (!classData) {
        setError('No heist found with that code. Check with your teacher.');
        setLoading(false);
        return;
      }

      const playerId = await joinSession(code, playerName.trim());
      navigate(`/play/${code}/${playerId}`);
    } catch (err) {
      console.error(err);
      setError('Failed to join: ' + err.message);
      setLoading(false);
    }
  };

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

        <h2 className="text-4xl text-heist-gold mb-2">JOIN THE HEIST</h2>
        <p className="text-gray-400 mb-6">Enter your code and pick a thief name.</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Class Code
            </label>
            <input
              type="text"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              placeholder="e.g. 9A-BIZ"
              className="input-heist uppercase"
              maxLength={20}
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-1 flex items-center gap-2">
              <User className="w-4 h-4" /> Your Thief Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. ShadowFox"
              className="input-heist"
              maxLength={20}
            />
          </div>

          {error && (
            <div className="p-3 bg-heist-red/20 border border-heist-red rounded text-heist-red text-sm">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-heist w-full">
            {loading ? 'JOINING...' : 'ENTER VAULT'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
