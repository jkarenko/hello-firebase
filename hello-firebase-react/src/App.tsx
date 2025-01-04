import { useState, useEffect } from 'react';
import { Card, CardBody } from "@nextui-org/react";
import { initializeFirebase } from './firebase';
import * as firebaseAuth from 'firebase/auth';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import './App.css';

const App = () => {
  const [user, setUser] = useState<firebaseAuth.User | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [auth, setAuth] = useState<firebaseAuth.Auth | null>(null);
  const [provider, setProvider] = useState<firebaseAuth.GoogleAuthProvider | null>(null);

  useEffect(() => {
    const firebase = initializeFirebase();
    const auth = firebase.auth();
    const provider = new firebase.auth.GoogleAuthProvider();
    
    setAuth(auth);
    setProvider(provider);

    const unsubscribe = auth.onAuthStateChanged((user: firebaseAuth.User | null) => {
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
            <Auth 
              user={user}
              auth={auth}
              provider={provider}
            />
          </div>
        </CardBody>
      </Card>

      {user && !selectedProject ? (
        <ProjectList onProjectSelect={setSelectedProject} />
      ) : user && selectedProject ? (
        <div className="player-section">
          <AudioPlayer 
            projectId={selectedProject} 
            onBack={() => setSelectedProject(null)} 
          />
        </div>
      ) : null}
    </div>
  );
};

export default App;
