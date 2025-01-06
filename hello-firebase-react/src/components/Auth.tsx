import type { Auth } from 'firebase/auth';
import { User, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "@nextui-org/react";
import { useEffect } from 'react';

interface AuthProps {
  user: User | null;
  auth: Auth;
  provider: GoogleAuthProvider;
}

const Auth = ({ user, auth, provider }: AuthProps) => {
  console.log('Auth component render:', { user });

  useEffect(() => {
    // Check if we were redirected and should auto-login
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('triggerAuth') === 'true' && !user) {
      // Remove the parameter to prevent loops
      urlParams.delete('triggerAuth');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
      // Trigger login
      handleLogin(false);
    }
  }, []);

  const handleLogin = async (checkDomain = true) => {
    try {
      console.log('Starting sign in with redirect');
      
      // Check if we're on .web.app domain and redirect to .firebaseapp.com if needed
      if (checkDomain && window.location.hostname.includes('.web.app')) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('triggerAuth', 'true');
        const newUrl = window.location.href.replace('.web.app', '.firebaseapp.com');
        console.log('Redirecting to firebaseapp.com domain for auth');
        window.location.href = newUrl + (newUrl.includes('?') ? '&' : '?') + urlParams.toString();
        return;
      }
      
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
    <div className="auth-section flex justify-end items-center">
      {!user ? (
        <button onClick={() => handleLogin(true)} className="auth-button">
          Sign in with Google
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm text-default-600">{user.email}</span>
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Avatar 
                name={user.email || ''} 
                showFallback
                size="md"
                className="cursor-pointer"
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem key="logout" className="text-danger" color="danger" onClick={handleLogout}>
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      )}
    </div>
  );
};

export default Auth; 
