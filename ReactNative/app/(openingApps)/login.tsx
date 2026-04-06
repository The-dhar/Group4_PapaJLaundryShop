import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { API_URL } from "../../config/api";

/** Shop owner only on mobile; clerks/staff use the web app. */
const MOBILE_ALLOWED_ROLES = ['owner'];

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
        >

          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Image
                source={require('../../assets/images/papaj logo.png')}
                style={styles.logoImage}
              />
            </View>

            <View style={styles.logoTextContainer}>
              <Text style={styles.brandName}>PAPA J&apos;s</Text>
              <Text style={styles.brandSubtitle}>Laundry Shop</Text>
            </View>
          </View>

          {/* Welcome */}
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.welcomeSubtext}>to Papa J&apos;s</Text>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email..."
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoggingIn}
            />
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password..."
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoggingIn}
            />
          </View>

          {/* Button */}
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
    backgroundColor: '#f5f5f5',
  },

  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 50,
  },

  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  logoTextContainer: {
    justifyContent: 'center',
  },

  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },

  brandSubtitle: {
    fontSize: 14,
    color: '#4169E1',
    marginTop: -2,
  },

  welcomeText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },

  welcomeSubtext: {
    fontSize: 32,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 40,
  },

  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },

  input: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#2c3e50',
  },

  loginButton: {
    width: '100%',
    height: 50,
    backgroundColor: '#4169E1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
    fontWeight: '600',
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
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: 12,
  },

  modalBody: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    marginBottom: 20,
  },

  modalButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#4169E1',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },

  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});