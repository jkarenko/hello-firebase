import {User} from "firebase/auth";
import {doc, getDoc, setDoc, getFirestore} from "firebase/firestore";
import {useEffect, useState} from "react";
import {getFirebaseFunctions} from "../firebase";
import {httpsCallable} from "firebase/functions";
import {eventEmitter, PROJECTS_UPDATED} from "./events";
import {toast} from "sonner";

export interface UserSettings {
  uid: string;
  welcomed: boolean;
  preferences?: {
    theme?: "light" | "dark";
    notifications?: boolean;
  };
  // Add more settings as needed
}

const DEFAULT_SETTINGS: Omit<UserSettings, "uid"> = {
  welcomed: false,
  preferences: {
    theme: "light",
    notifications: true,
  },
};

export async function initializeUserSettings(user: User): Promise<UserSettings> {
  const db = getFirestore();
  const userDoc = doc(db, "users", user.uid);
  const userSettings: UserSettings = {
    uid: user.uid,
    ...DEFAULT_SETTINGS,
  };

  await setDoc(userDoc, userSettings);
  return userSettings;
}

export async function getUserSettings(uid: string): Promise<UserSettings | null> {
  const db = getFirestore();
  const userDoc = doc(db, "users", uid);
  const docSnap = await getDoc(userDoc);

  if (docSnap.exists()) {
    return docSnap.data() as UserSettings;
  }
  return null;
}

export async function updateUserSettings(uid: string, settings: Partial<Omit<UserSettings, "uid">>): Promise<void> {
  const db = getFirestore();
  const userDoc = doc(db, "users", uid);
  await setDoc(userDoc, settings, {merge: true});
}

export async function handleFirstTimeUser(user: User): Promise<void> {
  try {
    // Get or create user settings
    let settings = await getUserSettings(user.uid);
    if (!settings) {
      settings = await initializeUserSettings(user);
    }

    // If user hasn't been welcomed yet
    if (!settings.welcomed) {
      const functions = getFirebaseFunctions();

      // Process any pending invitations
      const processInvitations = httpsCallable(functions, "processUserInvitations");
      await processInvitations();

      // Add to welcome project
      const addToWelcomeProject = httpsCallable(functions, "addUserToWelcomeProject");
      await addToWelcomeProject();

      // Update welcomed status
      await updateUserSettings(user.uid, {welcomed: true});

      // Show welcome message
      toast.success("Welcome to Echoherence!", {
        description: "We've added a sample project to help you get started.",
        duration: 5000,
      });

      // Refresh projects list
      eventEmitter.emit(PROJECTS_UPDATED);
    }
  } catch (error) {
    console.error("Error handling first-time user:", error);
  }
}

// React hook for accessing user settings
export function useUserSettings(user: User | null) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        setLoading(true);
        let userSettings = await getUserSettings(user.uid);

        if (!isMounted) {
          return;
        }

        if (!userSettings) {
          userSettings = await initializeUserSettings(user);
        }

        if (!isMounted) {
          return;
        }

        setSettings(userSettings);
        setError(null);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof Error ? err : new Error("Failed to load user settings"));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]); // Only depend on user.uid instead of the entire user object

  return {settings, loading, error};
}
