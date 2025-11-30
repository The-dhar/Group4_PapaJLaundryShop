import { router } from 'expo-router';
import React from 'react';
import { Dimensions, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function LaundryWelcomeScreen() {
const handleGetStarted = () => {
  router.push('/(openingApps)/login');
};

  return (
    <SafeAreaView style={styles.safeArea}>
    <View style={styles.container}>
      {/* Decorative circles */}
      <View style={styles.circleTopLeft} />
      <View style={styles.circleTopRight} />
      <View style={styles.circleMidLeft} />
      <View style={styles.sunBottomLeft} />
      <View style={styles.clockBottomRight} />

      {/* Character Illustration Placeholder */}
      <View style={styles.characterContainer}>
        <Image
          source={require("../../assets/images/papaj.png")} // FIXED PATH
          style={styles.characterImage}
          resizeMode="contain"
        />
      </View>

      {/* Main Content */}
      <View style={styles.contentContainer}>
        <Text style={styles.heading}>
          Fresh, clean, and perfectly folded that's how we do laundry.
        </Text>
        
        <Text style={styles.subheading}>
          Welcome to Papa J's where clean clothes meet convenience.
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity 
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8F4F8',
  },
  container: {
    flex: 1,
    backgroundColor: '#E8F4F8',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  circleTopLeft: {
    position: 'absolute',
    top: 80,
    left: 30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#A8D5E2',
    opacity: 0.6,
  },
  circleTopRight: {
    position: 'absolute',
    top: 100,
    right: 40,
    width: 100,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#87CEEB',
    opacity: 0.7,
  },
  circleMidLeft: {
    position: 'absolute',
    top: 180,
    right: 60,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFB347',
    opacity: 0.6,
  },
  sunBottomLeft: {
    position: 'absolute',
    bottom: 180,
    left: 20,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFA500',
    opacity: 0.7,
  },
  clockBottomRight: {
    position: 'absolute',
    bottom: 200,
    right: 30,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF6B6B',
    opacity: 0.6,
  },
  characterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  characterPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#FFF',
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  placeholderText: {
    fontSize: 80,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
  },
  contentContainer: {
    width: '100%',
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 30,
  },
  subheading: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#5B9FD7',
    paddingVertical: 16,
    paddingHorizontal: 80,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
    characterImage: {
    width: 500,
    height: 500,
  },
});



