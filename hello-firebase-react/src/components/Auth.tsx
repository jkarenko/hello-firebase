import type { Auth } from 'firebase/auth';
import { User, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';

interface AuthProps {
  user: User | null;
  auth: Auth;
  provider: GoogleAuthProvider;
}

const Auth = ({ user, auth, provider }: AuthProps) => {
  console.log('Auth component render:', { user });

  const handleLogin = async () => {
    try {
      console.log('Starting sign in with redirect');
      console.log('Current auth instance:', auth);
      console.log('Current provider:', provider);
      
      // Configure provider
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      await signInWithRedirect(auth, provider);
      console.log('Redirect initiated');
    } catch (error) {
      console.error('Login error:', error);
      alert('Error signing in. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Starting sign out');
      await signOut(auth);
      console.log('Sign out complete');
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error signing out. Please try again.');
    }
  };

  return (
    <div className="auth-section">
      {!user ? (
        <button onClick={handleLogin} className="auth-button">
          Sign in with Google
        </button>
      ) : (
        <>
          <button onClick={handleLogout} className="auth-button" id="logoutBtn">
            Sign out
          </button>
          <span className="user-email">{user.email}</span>
        </>
      )}
    </div>
  );
};

export default Auth; 
