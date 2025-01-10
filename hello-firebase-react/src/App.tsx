import { useState, useEffect } from 'react';
import { getAuth, GoogleAuthProvider, User, Auth as FirebaseAuth, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import AuthComponent from './components/Auth';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import JoinProject from './components/JoinProject';
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
  const [user, setUser] = useState<User | null>(null);
  const [auth, setAuth] = useState<FirebaseAuth | null>(null);
  const [provider, setProvider] = useState<GoogleAuthProvider | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    
    setAuth(auth);
    setProvider(provider);

    getRedirectResult(auth).then((result) => {
      if (result) {
        console.log('Redirect result:', {
          userId: result.user.uid,
          email: result.user.email,
          providerId: result.providerId,
          timestamp: new Date().toISOString()
        });
      }
    }).catch((error) => {
      console.error('Redirect error:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      console.log('Auth state changed:', {
        userId: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous,
        providerId: user?.providerId,
        timestamp: new Date().toISOString()
      });
      
      setUser(user);
      setIsAuthChecked(true);
      
      // Only redirect to home if not on join route and not authenticated
      if (!user && !location.pathname.startsWith('/join/')) {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate, location.pathname]);

  if (!auth || !provider || !isAuthChecked) {
    return <div>Loading...</div>;
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div 
            className="header-title cursor-pointer" 
            onClick={() => navigate('/')}
          >
            Echoherence
          </div>
          <AuthComponent 
            user={user}
            auth={auth}
            provider={provider}
          />
        </div>
      </header>

      <main className="main-content">
        <Routes>
          {/* Protected routes */}
          {user ? (
            <>
              <Route path="/" element={<ProjectList />} />
              <Route path="/project/:projectId" element={<ProjectView />} />
            </>
          ) : (
            <Route path="/" element={<Navigate to="/login" />} />
          )}
          
          {/* Public routes */}
          <Route path="/join/:token" element={<JoinProject />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
