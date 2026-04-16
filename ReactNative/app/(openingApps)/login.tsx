import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_URL } from "../../config/api";

/** Shop owner only on mobile; clerks/staff use the web app. */
const MOBILE_ALLOWED_ROLES = ['owner'];
const { width } = Dimensions.get("window");

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [restrictedModalVisible, setRestrictedModalVisible] = useState(false);
  const router = useRouter();
  const { setSession } = useAuth();

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    try {

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const u = data.user as Record<string, unknown> | undefined;
        const role = String(u?.role ?? '').toLowerCase();

        if (!MOBILE_ALLOWED_ROLES.includes(role)) {
          setRestrictedModalVisible(true);
          return;
        }

        setSession(
          data.token,
          u && typeof u === 'object' ? u : {}
        );

        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', data.message);
      }

    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Cannot connect to server');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          <View style={styles.headerContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/images/papaj logo.png')}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.brandName}>PAPA J&apos;s</Text>
            <Text style={styles.brandSubtitle}>Laundry Shop</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.welcomeSubtext}>Please sign in to continue</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="name@example.com"
                  placeholderTextColor="#A0ABC0"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoggingIn}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="#A0ABC0"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoggingIn}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoggingIn && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoggingIn}
              activeOpacity={0.85}
            >
              {isLoggingIn ? (
                <View style={styles.loginButtonInner}>
                  <ActivityIndicator color="#fff" size="small" style={styles.loginSpinner} />
                  <Text style={styles.loginButtonText}>Logging in...</Text>
                </View>
              ) : (
                <Text style={styles.loginButtonText}>Log In</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>

      </KeyboardAvoidingView>

      <Modal
        visible={restrictedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRestrictedModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mobile app</Text>
            <Text style={styles.modalBody}>
              Only the shop owner can sign in here. Clerk and staff accounts should use the web application.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setRestrictedModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E6F0FA',
  },

  container: {
    flex: 1,
    backgroundColor: '#E6F0FA',
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },

  headerContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },

  logoWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#005AAA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 15,
    borderWidth: 4,
    borderColor: '#E6F0FA',
    overflow: 'hidden',
  },

  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  brandName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#005AAA',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 90, 170, 0.15)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },

  brandSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3498DB',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 4,
  },

  card: {
    width: Math.min(width * 0.9, 460),
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 20,
  },

  welcomeText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A365D',
    marginBottom: 5,
  },

  welcomeSubtext: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 30,
    fontWeight: '500',
  },

  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },

  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4A5568',
    marginBottom: 8,
    marginLeft: 4,
  },

  inputWrapper: {
    backgroundColor: '#F7FAFC',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  input: {
    width: '100%',
    height: 55,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#2D3748',
    fontWeight: '500',
  },

  loginButton: {
    width: '100%',
    height: 60,
    backgroundColor: '#005AAA',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#005AAA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 10,
  },

  loginButtonDisabled: {
    opacity: 0.85,
  },

  loginButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  loginSpinner: {
    marginRight: 10,
  },

  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },

  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },

  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A365D',
    marginBottom: 12,
  },

  modalBody: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 20,
  },

  modalButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#005AAA',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
  },

  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});