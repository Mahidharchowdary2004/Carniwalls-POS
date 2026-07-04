import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { useStore } from '../store';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  
  const user = useStore((state) => state.user);
  const checkAuth = useStore((state) => state.checkAuth);

  useEffect(() => {
    async function init() {
      const hasToken = await checkAuth();
      if (!hasToken) {
        // We handle redirection in the effect that watches user/segments
      }
      setIsReady(true);
    }
    init();
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Redirect to the login page.
      router.replace('/login');
    } else if (user) {
      if (user.role === 'admin' && segments[0] !== 'admin') {
        router.replace('/admin' as any);
      } else if (user.role !== 'admin' && inAuthGroup) {
        router.replace('/');
      }
    }
  }, [user, segments, isReady]);

  if (!isReady) return null; // Or a splash screen

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f3f4f6' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}
