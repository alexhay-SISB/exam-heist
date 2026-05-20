import { Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentLobby from './pages/StudentLobby';
import GamePlay from './pages/GamePlay';
import GameResults from './pages/GameResults';

function App() {
  return (
    <div className="heist-bg min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/join" element={<StudentLobby />} />
        <Route path="/play/:classCode/:playerId" element={<GamePlay />} />
        <Route path="/results/:classCode/:playerId" element={<GameResults />} />
      </Routes>
    </div>
  );
}

export default App;
