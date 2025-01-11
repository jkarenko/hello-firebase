import {useState, useEffect} from "react";
import {
  getAuth,
  GoogleAuthProvider,
  User,
  Auth,
  onAuthStateChanged,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import {useNavigate, useLocation} from "react-router-dom";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [provider, setProvider] = useState<GoogleAuthProvider | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();

    setAuth(auth);
    setProvider(provider);

    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Redirect result:", {
            userId: result.user.uid,
            email: result.user.email,
            providerId: result.providerId,
            timestamp: new Date().toISOString(),
          });
        }
      })
      .catch((error) => {
        console.error("Redirect error:", error);
      });

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      console.log("Auth state changed:", {
        userId: user?.uid,
        email: user?.email,
        isAnonymous: user?.isAnonymous,
        providerId: user?.providerId,
        timestamp: new Date().toISOString(),
      });

      setUser(user);
      setIsAuthChecked(true);

      // Only redirect to home if not on join route and not authenticated
      if (!user && !location.pathname.startsWith("/join/")) {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [navigate, location.pathname]);

  const handleLogin = async () => {
    if (auth && provider) {
      try {
        // Check if we're on .web.app domain and redirect if needed
        if (window.location.hostname.includes(".web.app")) {
          const urlParams = new URLSearchParams(window.location.search);
          urlParams.set("triggerAuth", "true");
          const newUrl = window.location.href.replace(".web.app", ".firebaseapp.com");
          window.location.href = newUrl + (newUrl.includes("?") ? "&" : "?") + urlParams.toString();
          return;
        }

        // Configure provider
        provider.addScope("email");
        provider.addScope("profile");
        provider.setCustomParameters({
          prompt: "select_account",
          login_hint: "",
          auth_type: "reauthenticate",
        });

        // Initiate the redirect
        await signInWithRedirect(auth, provider);
      } catch (error) {
        console.error("Login error:", error);
        alert("Error signing in. Please try again.");
      }
    }
  };

  return {
    user,
    auth,
    provider,
    isAuthChecked,
    handleLogin,
  };
};
