import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { useStore } from '../store';

export default function LoginScreen() {
  const login = useStore((state) => state.login);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'Please enter both identifier and password');
      return;
    }

    setLoading(true);
    try {
      // Basic check if it's phone or email
      const isPhone = /^\d+$/.test(identifier);
      
      if (isPhone && identifier.length !== 10) {
        Alert.alert('Error', 'Phone number must be exactly 10 digits');
        setLoading(false);
        return;
      }
      
      if (isPhone && !/^\d{6}$/.test(password)) {
        Alert.alert('Error', 'Security OTP must be exactly 6 digits');
        setLoading(false);
        return;
      }

      await login(identifier, password, isPhone);
    } catch (err) {
      Alert.alert('Login Failed', 'Invalid credentials or server error.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topDecor} />

      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Image source={require('../../assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <Text style={styles.title}>Restauraq POS</Text>
        <Text style={styles.subtitle}>Sign in to manage your tables</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email or phone number</Text>
        <TextInput
          style={[styles.input, focusedField === 'identifier' && styles.inputFocused]}
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Enter email or phone"
          placeholderTextColor="#b9a98a"
          autoCapitalize="none"
          keyboardType="email-address"
          onFocus={() => setFocusedField('identifier')}
          onBlur={() => setFocusedField(null)}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[styles.input, focusedField === 'password' && styles.inputFocused]}
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="#b9a98a"
          secureTextEntry
          onFocus={() => setFocusedField('password')}
          onBlur={() => setFocusedField(null)}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.footerText}>It's Ice Cream Time</Text>
    </View>
  );
}

const COLORS = {
  bg: '#fff8e6',
  primary: '#e00000',
  primaryDark: '#b30000',
  accent: '#ffd400',
  accentDark: '#e0ac00',
  ink: '#2a0a00',
  inkSoft: '#8a6a4a',
  border: '#ffe9b0',
  card: '#ffffff',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.bg,
  },
  topDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: {
    width: 96,
    height: 96,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    fontWeight: '600',
  },
  form: {
    backgroundColor: COLORS.card,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.inkSoft,
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 15,
    color: COLORS.ink,
    backgroundColor: COLORS.bg,
  },
  inputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  button: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    fontStyle: 'italic',
  },
});