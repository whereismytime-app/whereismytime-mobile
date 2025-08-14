import {
  GoogleAuthProvider as _GoogleAuthProvider,
  FirebaseAuthTypes,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

// @ts-expect-error: https://rnfirebase.io/migrating-to-v22#enabling-deprecation-strict-modes
globalThis.RNFB_MODULAR_DEPRECATION_STRICT_MODE = false;

const GOOGLE_AUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

GoogleSignin.configure({
  scopes: GOOGLE_AUTH_SCOPES,
  webClientId: '771523609080-rduodmmac6t39q40uk84fsdvdv30ciav.apps.googleusercontent.com',
});

interface GoogleAuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  signIn: () => Promise<any>;
  signOut: () => Promise<void>;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

interface GoogleAuthProviderProps {
  children: ReactNode;
}

type User = FirebaseAuthTypes.User;

export function GoogleAuthProvider({ children }: GoogleAuthProviderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const handleAuthStateChanged = useCallback(
    (user: User | null) => {
      setUser(user);
      if (isLoading) setIsLoading(false);
    },
    [isLoading]
  );

  useEffect(() => {
    const subscriber = onAuthStateChanged(getAuth(), handleAuthStateChanged);
    return subscriber;
  }, [handleAuthStateChanged]);

  const signIn = useCallback(async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      let idToken = signInResult.data?.idToken;
      if (!idToken) {
        // @ts-expect-error back-compat
        idToken = signInResult.idToken;
      }
      if (!idToken) {
        throw new Error('No ID token found');
      }

      const googleCredential = _GoogleAuthProvider.credential(idToken);
      await signInWithCredential(getAuth(), googleCredential);
    } catch (error) {
      console.error('Sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.signOut();
      await getAuth().signOut();
    } catch (error) {
      console.error('Google SignOut Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const contextValue: GoogleAuthContextType = {
    user,
    isLoading,
    isLoggedIn: !!user,
    signIn,
    signOut,
  };

  return <GoogleAuthContext.Provider value={contextValue}>{children}</GoogleAuthContext.Provider>;
}

export function useGoogleAuth(): GoogleAuthContextType {
  const context = useContext(GoogleAuthContext);
  if (context === undefined) {
    throw new Error('useGoogleAuth must be used within a GoogleAuthProvider');
  }
  return context;
}
