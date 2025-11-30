import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = () => {
    console.log('Login attempted with:', { email, password });

    router.replace('/(tabs)/dashboard'); // Navigate to main app screen
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
    <Text style={styles.brandName}>PAPA J's</Text>
    <Text style={styles.brandSubtitle}>Laundry Shop</Text>
  </View>
</View>

        {/* Welcome Text */}
        <Text style={styles.welcomeText}>Welcome Back</Text>
        <Text style={styles.welcomeSubtext}>to Papa J's</Text>

        {/* Email Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Email....."
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password...."
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

          {/* Login Button */}
          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>Log In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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

  logoInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4169E1',
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
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  logoCircle: {
  width: 80,
  height: 80,
  borderRadius: 40,
  overflow: 'hidden', // important so the image stays circular
  justifyContent: 'center',
  alignItems: 'center',
},

logoImage: {
  width: '100%',
  height: '100%',
  resizeMode: 'cover',
},
});