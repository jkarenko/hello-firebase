import { useState, useEffect } from 'react';
import { Card, CardBody } from "@nextui-org/react";
import { getAuth, GoogleAuthProvider, User, Auth as FirebaseAuth, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import AuthComponent from './components/Auth';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
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
  const navigate = useNavigate();

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
      if (!user) {
        navigate('/');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (!auth || !provider) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <Card className="my-4">
        <CardBody>
          <div className="auth-section">
            <AuthComponent 
              user={user}
              auth={auth}
              provider={provider}
            />
          </div>
        </CardBody>
      </Card>

      {user && (
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/project/:projectId" element={<ProjectView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
};

export default App;
