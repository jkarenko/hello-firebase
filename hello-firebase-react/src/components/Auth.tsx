import type { Auth } from 'firebase/auth';
import { User, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
import { Avatar, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Badge } from "@nextui-org/react";
import { useEffect, useState, memo, useCallback } from 'react';
import PendingInvites from './PendingInvites';
import { eventEmitter, PROJECTS_UPDATED } from '../utils/events';
import { InboxIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { handleFirstTimeUser } from '../utils/user';
import { useTheme } from 'next-themes';

interface AuthProps {
  user: User | null;
  auth: Auth;
  provider: GoogleAuthProvider;
}

const Auth = memo(({ user, auth, provider }: AuthProps) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isInboxOpen, setIsInboxOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  // Memoize callbacks to prevent unnecessary re-renders
  const refreshProjects = useCallback(() => {
    eventEmitter.emit(PROJECTS_UPDATED);
  }, []);

  const handleLogin = useCallback(async (checkDomain = true) => {
    try {
      if (checkDomain && window.location.hostname.includes('.web.app')) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set('triggerAuth', 'true');
        const newUrl = window.location.href.replace('.web.app', '.firebaseapp.com');
        window.location.href = newUrl + (newUrl.includes('?') ? '&' : '?') + urlParams.toString();
        return;
      }
      
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
      alert('Error signing in. Please try again.');
    }
  }, [auth, provider]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error signing out. Please try again.');
    }
  }, [auth]);

  // Check for redirect auth parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('triggerAuth') === 'true' && !user) {
      urlParams.delete('triggerAuth');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);
      handleLogin(false);
    }
  }, [user, handleLogin]);

  // Handle first-time sign-in
  useEffect(() => {
    if (user) {
      handleFirstTimeUser(user).catch(console.error);
    }
  }, [user?.uid]); // Only run when user ID changes

  return (
    <div className="flex items-center gap-4">
      {!user ? (
        <button 
          onClick={() => handleLogin(true)} 
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground cursor-pointer transition-colors hover:bg-primary-600"
        >
          Sign in with Google
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="cursor-pointer transition-opacity hover:opacity-80">
                <Badge
                  color="danger"
                  content={pendingCount}
                  placement="top-right"
                  shape="circle"
                  showOutline
                  size="sm"
                  variant="solid"
                  isInvisible={pendingCount === 0}
                >
                  <Avatar 
                    src={user.photoURL || undefined}
                    name={user.displayName || user.email || ''} 
                    showFallback
                    size="sm"
                    isBordered
                  />
                </Badge>
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem 
                key="email" 
                className="h-14 gap-2"
                textValue={user.email || ''}
              >
                <p className="font-semibold">Signed in as</p>
                <p className="font-semibold text-foreground-50">{user.email}</p>
              </DropdownItem>
              <DropdownItem 
                key="inbox" 
                startContent={<InboxIcon className="w-4 h-4" />}
                textValue="Inbox"
                description={pendingCount > 0 ? `${pendingCount} pending invites` : "No pending invites"}
                onPress={() => setIsInboxOpen(true)}
              >
                Inbox
              </DropdownItem>
              <DropdownItem
                key="theme"
                startContent={theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
                onPress={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
              </DropdownItem>
              <DropdownItem key="logout" className="text-danger" color="danger" onPress={handleLogout}>
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>

          <PendingInvites 
            onInviteAccepted={refreshProjects} 
            setPendingCount={setPendingCount}
            isOpen={isInboxOpen}
            onOpenChange={setIsInboxOpen}
          />
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo to prevent unnecessary re-renders
  return (
    prevProps.user?.uid === nextProps.user?.uid &&
    prevProps.auth === nextProps.auth &&
    prevProps.provider === nextProps.provider
  );
});

export default Auth; 
