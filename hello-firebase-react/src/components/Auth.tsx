interface AuthProps {
  user: firebase.User | null;
  auth: firebase.auth.Auth;
  provider: firebase.auth.GoogleAuthProvider;
}

const Auth = ({ user, auth, provider }: AuthProps) => {
  console.log('Auth component render:', { user });

  const handleLogin = async () => {
    try {
      console.log('Starting sign in with redirect');
      console.log('Current auth instance:', auth);
      console.log('Current provider:', provider);
      
      // Check if we're connected to emulator
      const authSettings = auth.settings || {};
      console.log('Auth settings:', authSettings);

      // Configure provider
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      await auth.signInWithRedirect(provider);
      console.log('Redirect initiated');
    } catch (error) {
      console.error('Login error:', error);
      alert('Error signing in. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Starting sign out');
      await auth.signOut();
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
