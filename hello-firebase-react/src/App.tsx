import { useState, useEffect } from 'react';
import { Card, CardBody } from "@nextui-org/react";
// import { initializeFirebase } from './firebase';
import { getAuth, GoogleAuthProvider, User, Auth as FirebaseAuth, onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import AuthComponent from './components/Auth';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import './App.css';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [auth, setAuth] = useState<FirebaseAuth | null>(null);
  const [provider, setProvider] = useState<GoogleAuthProvider | null>(null);

  useEffect(() => {
    // initializeFirebase();
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    
    setAuth(auth);
    setProvider(provider);

    // Handle redirect result
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
        setSelectedProject(null);
      }
    });

    return () => unsubscribe();
  }, []);

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

      {user && !selectedProject ? (
        <ProjectList
          onProjectSelect={setSelectedProject}
        />
      ) : user && selectedProject ? (
        <AudioPlayer
          projectId={selectedProject}
          onBack={() => setSelectedProject(null)}
        />
      ) : null}
    </div>
  );
};

export default App;
