import {useState, useEffect, useMemo} from "react";
import {
  getAuth,
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import {useNavigate, useLocation} from "react-router-dom";

// Configure provider once outside the component
const configureProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  provider.setCustomParameters({
    prompt: "select_account",
    login_hint: "",
    auth_type: "reauthenticate",
  });
  return provider;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Memoize auth and provider
  const auth = useMemo(() => getAuth(), []);
  const provider = useMemo(() => configureProvider(), []);

  useEffect(() => {
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          console.log("Auth: Successful sign-in redirect");
        }
      })
      .catch((error) => {
        console.error("Auth: Redirect error", error);
      });

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      // Only log significant state changes
      if ((!user && isAuthChecked) || (user && !isAuthChecked)) {
        console.log("Auth: State changed", user ? "signed in" : "signed out");
      }

      setUser(user);
      setIsAuthChecked(true);

      // Only redirect to home if not on join route and not authenticated
      if (!user && !location.pathname.startsWith("/join/")) {
        navigate("/");
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, location.pathname, isAuthChecked]);

  const handleLogin = async () => {
    try {
      // Check if we're on .web.app domain and redirect if needed
      if (window.location.hostname.includes(".web.app")) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set("triggerAuth", "true");
        const newUrl = window.location.href.replace(".web.app", ".firebaseapp.com");
        window.location.href = newUrl + (newUrl.includes("?") ? "&" : "?") + urlParams.toString();
        return;
      }

      // Initiate the redirect
      await signInWithRedirect(auth, provider);
    } catch (error) {
      console.error("Login error:", error);
      alert("Error signing in. Please try again.");
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
