import { router } from "expo-router";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

type BubbleProps = {
  size: number;
  top: number;
  left: number;
  opacity: number;
  delay: number;
};

function Bubble({ size, top, left, opacity, delay }: BubbleProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue, delay]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top,
          left,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.bubbleHighlight,
          {
            width: size * 0.35,
            height: size * 0.15,
            top: size * 0.1,
            left: size * 0.2,
            borderRadius: size * 0.1,
          },
        ]}
      />
      <View
        style={[
          styles.bubbleReflection,
          {
            width: size * 0.8,
            height: size * 0.8,
            borderRadius: size * 0.4,
            bottom: -size * 0.05,
            right: -size * 0.05,
          },
        ]}
      />
    </Animated.View>
  );
}

export default function LaundryWelcomeScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace("/(openingApps)/login");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const backLayer = useMemo(
    () => [
      { size: 30, top: height * 0.05, left: width * 0.1, opacity: 0.3, delay: 0 },
      { size: 45, top: height * 0.15, left: width * 0.6, opacity: 0.3, delay: 700 },
      { size: 25, top: height * 0.3, left: width * 0.8, opacity: 0.3, delay: 1200 },
      { size: 35, top: height * 0.4, left: width * 0.2, opacity: 0.3, delay: 500 },
      { size: 50, top: height * 0.6, left: width * 0.9, opacity: 0.2, delay: 1800 },
      { size: 40, top: height * 0.75, left: width * 0.1, opacity: 0.3, delay: 300 },
      { size: 60, top: height * 0.85, left: width * 0.7, opacity: 0.2, delay: 900 },
    ],
    []
  );

  const middleLayer = useMemo(
    () => [
      { size: 70, top: height * 0.1, left: width * 0.2, opacity: 0.5, delay: 200 },
      { size: 85, top: height * 0.25, left: width * 0.8, opacity: 0.4, delay: 1000 },
      { size: 65, top: height * 0.45, left: width * 0.1, opacity: 0.5, delay: 400 },
      { size: 90, top: height * 0.65, left: width * 0.8, opacity: 0.4, delay: 1400 },
      { size: 75, top: height * 0.8, left: width * 0.3, opacity: 0.5, delay: 600 },
    ],
    []
  );

  const frontLayer = useMemo(
    () => [
      { size: 110, top: height * 0.15, left: width * -0.1, opacity: 0.6, delay: 800 },
      { size: 130, top: height * 0.5, left: width * 0.75, opacity: 0.5, delay: 2000 },
      { size: 100, top: height * 0.7, left: width * -0.05, opacity: 0.6, delay: 1100 },
      { size: 140, top: height * 0.35, left: width * 0.4, opacity: 0.4, delay: 100 },
    ],
    []
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {backLayer.map((b, idx) => (
          <Bubble key={`back-${idx}`} {...b} />
        ))}
        {middleLayer.map((b, idx) => (
          <Bubble key={`mid-${idx}`} {...b} />
        ))}
        {frontLayer.map((b, idx) => (
          <Bubble key={`front-${idx}`} {...b} />
        ))}

        <View style={styles.logoContainer}>
          <View style={styles.imageWrapper}>
            <Image
              source={require("../../assets/images/papaj logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandName}>Papa J</Text>
          <Text style={styles.brandSubtitle}>Laundry Shop</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#E6F0FA",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.9)",
    borderBottomColor: "rgba(255, 255, 255, 0.2)",
    borderRightColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#3498DB",
    shadowOffset: { width: -5, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    overflow: "hidden",
  },
  bubbleHighlight: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    transform: [{ rotate: "-45deg" }],
  },
  bubbleReflection: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(135, 206, 235, 0.6)",
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  logoContainer: {
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  imageWrapper: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#005AAA",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10,
    marginBottom: 20,
    borderWidth: 4,
    borderColor: "#E6F0FA",
  },
  logoImage: {
    width: 160,
    height: 160,
  },
  brandName: {
    fontSize: 42,
    fontWeight: "900",
    color: "#005AAA",
    letterSpacing: 1,
    textShadowColor: "rgba(0, 90, 170, 0.1)",
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  brandSubtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#3498DB",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginTop: 5,
  },
});



