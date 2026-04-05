import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "../../config/api";

const WINDOW_HEIGHT = Dimensions.get("window").height;
const PASSWORD_MODAL_MAX_HEIGHT = Math.min(Math.round(WINDOW_HEIGHT * 0.88), 520);

type UserProfile = {
  name: string;
  email: string;
  role?: string;
  clerk_username?: string | null;
};

function formatApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Request failed.";
  const e = payload as Record<string, unknown>;
  if (e.errors && typeof e.errors === "object") {
    const msgs: string[] = [];
    for (const v of Object.values(e.errors as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === "string") msgs.push(item);
        }
      } else if (typeof v === "string") {
        msgs.push(v);
      }
    }
    if (msgs.length) return msgs.join(" ");
  }
  if (typeof e.message === "string") return e.message;
  return "Request failed.";
}

export default function ProfileScreen() {
  const [personalModalVisible, setPersonalModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const router = useRouter();

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    setIsLoadingProfile(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setProfile(null);
        setProfileError("You are not signed in.");
        return;
      }

      const response = await fetch(`${API_URL}/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setProfile(null);
        setProfileError(`Could not load profile (error ${response.status}).`);
        return;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setProfile(null);
        setProfileError("Invalid response from server.");
        return;
      }

      if (!data || typeof data !== "object") {
        setProfile(null);
        setProfileError("Invalid profile data.");
        return;
      }

      const u = data as Record<string, unknown>;
      setProfile({
        name: typeof u.name === "string" ? u.name : "",
        email: typeof u.email === "string" ? u.email : "",
        role: typeof u.role === "string" ? u.role : undefined,
        clerk_username:
          u.clerk_username === null || typeof u.clerk_username === "string"
            ? (u.clerk_username as string | null)
            : undefined,
      });
    } catch (e) {
      console.log(e);
      setProfile(null);
      setProfileError("Something went wrong. Check your connection.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const openPersonalModal = () => {
    if (!profile) return;
    setEditName(profile.name);
    setEditEmail(profile.email);
    setPersonalModalVisible(true);
  };

  const closePersonalModal = () => {
    setPersonalModalVisible(false);
    setEditName("");
    setEditEmail("");
  };

  const openPasswordModal = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordModalVisible(true);
  };

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleSaveProfile = async () => {
    const name = editName.trim();
    const email = editEmail.trim();
    if (!name) {
      Alert.alert("Error", "Name is required.");
      return;
    }
    if (!email) {
      Alert.alert("Error", "Email is required.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "You are not signed in.");
        return;
      }

      setIsSavingProfile(true);
      const response = await fetch(`${API_URL}/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) {
        let message = `Could not save (${response.status}).`;
        try {
          const err = await response.json();
          message = formatApiErrorMessage(err);
        } catch {
          /* ignore */
        }
        Alert.alert("Could not update profile", message);
        return;
      }

      const data = await response.json();
      if (data && typeof data === "object") {
        const u = data as Record<string, unknown>;
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                name: typeof u.name === "string" ? u.name : prev.name,
                email: typeof u.email === "string" ? u.email : prev.email,
              }
            : prev
        );
      }
      closePersonalModal();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePassword = async () => {
    if (!oldPassword) {
      Alert.alert("Error", "Enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "You are not signed in.");
        return;
      }

      setIsSavingPassword(true);
      const response = await fetch(`${API_URL}/user/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          current_password: oldPassword,
          password: newPassword,
          password_confirmation: confirmPassword,
        }),
      });

      if (!response.ok) {
        let message = `Could not update password (${response.status}).`;
        try {
          const err = await response.json();
          message = formatApiErrorMessage(err);
        } catch {
          /* ignore */
        }
        Alert.alert("Could not change password", message);
        return;
      }

      closePasswordModal();
      Alert.alert("Success", "Your password was updated.");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Profile</Text>
            <View style={styles.headerAccent} />
          </View>
        </View>

        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          bounces
          nestedScrollEnabled
          scrollEventThrottle={16}
        >
          {profileError ? (
            <View style={[styles.profileCard, styles.firstCard]}>
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>{profileError}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={loadProfile} activeOpacity={0.85}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {isLoadingProfile && !profileError ? (
            <View style={[styles.profileCard, styles.firstCard]}>
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.loadingText}>Loading profile…</Text>
              </View>
            </View>
          ) : null}

          {!isLoadingProfile && !profileError && profile ? (
            <>
              {/* Personal Info */}
              <View style={[styles.profileCard, styles.firstCard]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Personal Info</Text>
                  <TouchableOpacity onPress={openPersonalModal} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.sectionEditText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Image
                      source={require("../../assets/images/papaj logo.png")}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name</Text>
                  <View style={styles.inputReadonly}>
                    <Text style={styles.inputReadonlyText}>{profile.name || "—"}</Text>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputReadonly}>
                    <Text style={styles.inputReadonlyText}>{profile.email || "—"}</Text>
                  </View>
                </View>

                {profile.role ? (
                  <View
                    style={[
                      styles.inputGroup,
                      !profile.clerk_username && styles.inputGroupLast,
                    ]}
                  >
                    <Text style={styles.label}>Role</Text>
                    <View style={styles.inputReadonly}>
                      <Text style={styles.inputReadonlyText}>{profile.role}</Text>
                    </View>
                  </View>
                ) : null}

                {profile.clerk_username ? (
                  <View style={[styles.inputGroup, styles.inputGroupLast]}>
                    <Text style={styles.label}>Clerk username</Text>
                    <View style={styles.inputReadonly}>
                      <Text style={styles.inputReadonlyText}>{profile.clerk_username}</Text>
                    </View>
                  </View>
                ) : null}
              </View>

              {/* Security */}
              <View style={[styles.profileCard, styles.sectionCardFollow]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Security</Text>
                  <TouchableOpacity onPress={openPasswordModal} activeOpacity={0.85} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.sectionEditText}>Edit password</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.inputGroup, styles.inputGroupLast]}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputReadonly}>
                    <Text style={styles.inputReadonlyText}>••••••••••••</Text>
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>

      {/* Personal info modal */}
      <Modal
        animationType="fade"
        transparent
        visible={personalModalVisible}
        onRequestClose={closePersonalModal}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={styles.modalContent} pointerEvents="auto">
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalBackButton}
                onPress={closePersonalModal}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalBackButtonText}>←</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Edit personal info</Text>
            </View>

            <View style={styles.modalFormBody}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Name</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Your name"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Email</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editEmail}
                  onChangeText={setEditEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <Text style={styles.modalHint}>Role cannot be changed here.</Text>
            </View>

            <View style={styles.modalButtonBar}>
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.modalSecondaryBtn, isSavingProfile && styles.buttonDisabled]}
                  onPress={closePersonalModal}
                  disabled={isSavingProfile}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmButton, isSavingProfile && styles.buttonDisabled]}
                  onPress={handleSaveProfile}
                  disabled={isSavingProfile}
                  accessibilityRole="button"
                >
                  {isSavingProfile ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password modal */}
      <Modal
        animationType="fade"
        transparent
        visible={passwordModalVisible}
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={[styles.modalContent, { maxHeight: PASSWORD_MODAL_MAX_HEIGHT }]} pointerEvents="auto">
            <View style={styles.modalHeader}>
              <Pressable
                style={styles.modalBackButton}
                onPress={closePasswordModal}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.modalBackButtonText}>←</Text>
              </Pressable>
              <Text style={styles.modalTitle}>Change password</Text>
            </View>

            <View style={styles.modalFormBody}>
              <View style={styles.modalLogoRow}>
                <View style={styles.modalLogoCircle}>
                  <Image
                    source={require("../../assets/images/papaj logo.png")}
                    style={styles.modalLogoImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Current password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry
                  placeholder=""
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>New password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="At least 6 characters"
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Confirm new password</Text>
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder=""
                />
              </View>
            </View>

            <View style={styles.modalButtonBar}>
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.modalSecondaryBtn, isSavingPassword && styles.buttonDisabled]}
                  onPress={closePasswordModal}
                  disabled={isSavingPassword}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmButton, isSavingPassword && styles.buttonDisabled]}
                  onPress={handleSavePassword}
                  disabled={isSavingPassword}
                  accessibilityRole="button"
                >
                  {isSavingPassword ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.confirmButtonText}>Update password</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flex: 1,
    position: 'relative',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  headerAccent: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backIcon: {
    fontSize: 24,
    color: '#1e293b',
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  firstCard: {
    marginTop: 20,
  },
  sectionCardFollow: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.3,
  },
  sectionEditText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3b82f6",
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputGroupLast: {
    marginBottom: 0,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputReadonly: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    justifyContent: 'center',
    minHeight: 50,
  },
  inputReadonlyText: {
    fontSize: 16,
    color: '#1e293b',
  },
  errorBanner: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorBannerText: {
    color: "#991b1b",
    fontWeight: "600",
    marginBottom: 10,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "#64748b",
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 380,
    overflow: "hidden",
    flexDirection: "column",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 20,
  },
  modalFormBody: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  modalHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "500",
  },
  modalLogoRow: {
    alignItems: "center",
    marginBottom: 10,
  },
  modalLogoCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  modalLogoImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  modalButtonBar: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalBackButton: {
    width: 36,
    height: 36,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 3,
  },
  modalBackButtonText: {
    fontSize: 20,
    color: "#1e293b",
    fontWeight: "600",
  },
  modalTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    marginRight: 36,
    letterSpacing: -0.3,
  },
  modalInputGroup: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: "#f8fafc",
    color: "#1e293b",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalSecondaryBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  modalSecondaryBtnText: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: "center",
    shadowColor: "#22c55e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
    minHeight: 46,
    justifyContent: "center",
  },
  confirmButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
});
