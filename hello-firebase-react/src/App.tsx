import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import ProjectList from './components/ProjectList';
import AudioPlayer from './components/AudioPlayer';
import { initializeFirebase } from './firebase';
import './App.css';

function App() {
  const [user, setUser] = useState<any>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('App mounted, initializing Firebase...');
    
    // Initialize Firebase
    const firebase = initializeFirebase();
    const auth = firebase.auth();

    // Check current auth state
    const currentUser = auth.currentUser;
    console.log('Current auth state:', { 
      currentUser: currentUser?.email,
      timestamp: new Date().toISOString()
    });

    // Handle redirect result
    auth.getRedirectResult()
      .then((result: any) => {
        console.log('Redirect result:', {
          user: result?.user?.email,
          timestamp: new Date().toISOString()
        });
        if (result.user) {
          console.log('Setting user from redirect:', result.user.email);
          setUser(result.user);
        }
      })
      .catch((error: any) => {
        console.error('Redirect sign-in error:', {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString()
        });
        if (error.code !== 'auth/credential-already-in-use') {
          alert('Error signing in. Please try again.');
        }
      });

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      console.log('Auth state changed:', {
        user: user?.email,
        timestamp: new Date().toISOString()
      });
      setUser(user);
      if (!user) {
        setShowPlayer(false);
        setSelectedProjectId(null);
      }
    });

    setIsInitialized(true);

    return () => {
      console.log('App unmounting, cleaning up...');
      unsubscribe();
    };
  }, []);

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowPlayer(true);
  };

  const handleBackToProjects = () => {
    setShowPlayer(false);
    setSelectedProjectId(null);
  };

  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container">
      <Auth 
        user={user} 
        auth={window.firebase.auth()} 
        provider={new window.firebase.auth.GoogleAuthProvider()} 
      />
      
      {user && !showPlayer && (
        <ProjectList onProjectSelect={handleProjectSelect} />
      )}
      
      {user && showPlayer && selectedProjectId && (
        <AudioPlayer 
          projectId={selectedProjectId}
          onBack={handleBackToProjects}
        />
      )}
    </div>
  );
}

export default App;
