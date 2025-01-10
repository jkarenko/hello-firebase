import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirebaseFunctions, getAuth } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Card, Button, Spinner } from '@nextui-org/react';
import { onAuthStateChanged } from 'firebase/auth';

const JoinProject = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!token) {
        setError('Invalid invite link');
        setIsLoading(false);
        return;
      }

      if (user) {
        try {
          const functions = getFirebaseFunctions();
          const useInviteLink = httpsCallable(functions, 'useInviteLink');
          const result = await useInviteLink({ token });
          const { projectId } = result.data as { success: boolean; projectId: string };
          
          // Redirect to the project
          navigate(`/project/${projectId}`);
        } catch (err) {
          console.error('Error joining project:', err);
          setError(err instanceof Error ? err.message : 'Failed to join project');
          setIsLoading(false);
        }
      } else {
        setNeedsAuth(true);
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [token, navigate]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h1 className="text-xl font-semibold mb-4">Unable to Join Project</h1>
          <p className="text-danger mb-6">{error}</p>
          <Button
            color="primary"
            onPress={() => navigate('/')}
          >
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <h1 className="text-xl font-semibold mb-4">Sign in to Join Project</h1>
          <p className="text-default-600 mb-6">
            You need to sign in or create an account to join this project.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              color="primary"
              onPress={() => navigate('/login', { state: { returnUrl: `/join/${token}` } })}
            >
              Sign In
            </Button>
            <Button
              variant="bordered"
              onPress={() => navigate('/signup', { state: { returnUrl: `/join/${token}` } })}
            >
              Create Account
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

export default JoinProject; 
