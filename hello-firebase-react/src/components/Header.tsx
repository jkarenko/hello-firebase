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
    <header className={`app-header ${variant === 'landing' ? 'bg-transparent absolute top-0 left-0 right-0' : ''}`}>
      <div className="header-content">
        <div 
          className={`header-title cursor-pointer ${variant === 'landing' ? 'text-white' : ''}`}
          onClick={() => navigate('/')}
        >
          Echoherence
        </div>
        {auth && provider && (
          <AuthComponent 
            user={user}
            auth={auth}
            provider={provider}
          />
        )}
      </div>
    </header>
  );
};

export default Header; 
