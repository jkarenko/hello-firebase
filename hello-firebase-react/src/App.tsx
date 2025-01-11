import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import JoinProject from './components/JoinProject';
import LandingPage from './components/LandingPage';
import Header from './components/Header';
import { useAuth } from './hooks/useAuth';
import './App.css';

const ProjectView = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  if (!projectId) {
    return <Navigate to="/" />;
  }

  return (
    <AudioPlayer
      projectId={projectId}
      onBack={() => navigate('/')}
    />
  );
};

const App = () => {
  const { user, auth, provider, isAuthChecked, handleLogin } = useAuth();

  if (!isAuthChecked) {
    return <div>Loading...</div>;
  }

  return (
    <div className="app-container">
      <Header 
        user={user}
        auth={auth}
        provider={provider}
        variant={user ? 'app' : 'landing'}
      />

      {user ? (
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ProjectList />} />
            <Route path="/project/:projectId" element={<ProjectView />} />
            <Route path="/app" element={<ProjectList />} />
            <Route path="/join/:token" element={<JoinProject />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      ) : (
        <Routes>
          <Route path="/" element={
            <LandingPage handleLogin={handleLogin} />
          } />
          <Route path="/join/:token" element={<JoinProject />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
};

export default App;
