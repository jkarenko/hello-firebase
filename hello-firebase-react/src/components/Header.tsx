import { User, Auth, GoogleAuthProvider } from 'firebase/auth';
import AuthComponent from './Auth';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  user: User | null;
  auth: Auth | null;
  provider: GoogleAuthProvider | null;
  variant?: 'landing' | 'app';
}

const Header = ({ user, auth, provider, variant = 'app' }: HeaderProps) => {
  const navigate = useNavigate();
  
  return (
    <>
      <header 
        className={`
          fixed top-0 left-0 right-0 z-50 py-3
          ${variant === 'landing' 
            ? 'bg-transparent absolute' 
            : 'bg-background border-b border-divider shadow-sm'
          }
        `}
      >
        <div className="max-w-[1200px] mx-auto px-4 flex justify-between items-center">
          <div 
            className={`
              text-xl font-semibold cursor-pointer transition-opacity duration-200 hover:opacity-80
              ${variant === 'landing' ? 'text-primary-50' : 'text-primary'}
            `}
            onClick={() => navigate('/')}
          >
            Echoherence
          </div>
          {variant !== 'landing' && auth && provider && (
            <AuthComponent 
              user={user}
              auth={auth}
              provider={provider}
            />
          )}
        </div>
      </header>
      {variant !== 'landing' && <div className="h-10" />}
    </>
  );
};

export default Header; 
