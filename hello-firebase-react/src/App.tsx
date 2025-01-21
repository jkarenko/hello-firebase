import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import JoinProject from './components/JoinProject';
import LandingPage from './components/LandingPage';
import Header from './components/Header';
import { useAuth } from './hooks/useAuth';

interface ProjectViewProps {
  setStickyPlayer: (player: React.ReactNode | null) => void;
}

const ProjectView = ({ setStickyPlayer }: ProjectViewProps) => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  
  if (!projectId) {
    return <Navigate to="/" />;
  }

  return (
    <AudioPlayer
      projectId={projectId}
      onBack={() => navigate('/')}
      setStickyPlayer={setStickyPlayer}
    />
  );
};

const App = () => {
  const { user, auth, provider, isAuthChecked, handleLogin } = useAuth();
  const [stickyPlayer, setStickyPlayer] = useState<React.ReactNode | null>(null);

  if (!isAuthChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-foreground relative">
      <div className="absolute inset-0 bg-hero-waves opacity-100 dark:opacity-100 z-0 dark:invert" style={{ top: '-73px' }}></div>
      <div className="relative z-10 flex flex-col flex-1">
        <Header 
          user={user}
          auth={auth}
          provider={provider}
          variant={user ? 'app' : 'landing'}
          stickyPlayer={stickyPlayer}
        />

        {user ? (
          <main className="flex-1 max-w-[1200px] mx-auto w-full px-4 pt-16 pb-8">
            <Routes>
              <Route path="/" element={<ProjectList />} />
              <Route path="/project/:projectId" element={
                <ProjectView setStickyPlayer={setStickyPlayer} />
              } />
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
    </div>
  );
};

export default App;
