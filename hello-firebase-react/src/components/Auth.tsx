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
      
      // Configure provider with specific settings
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({
        prompt: 'select_account',
        login_hint: '',  // Clear any previous login hint
        auth_type: 'reauthenticate'  // Force re-authentication
      });
      
      // Initiate the redirect
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
      // Force reload after logout to clear any cached state
      window.location.reload();
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
