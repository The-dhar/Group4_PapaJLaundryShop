import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../../config/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WINDOW_HEIGHT = Dimensions.get("window").height;
/** Persisted owner choice for which branch VAT form applies to; empty = no branch selected. */
const VAT_OWNER_BRANCH_STORAGE_KEY = "profile_vat_owner_branch_id";
const PASSWORD_MODAL_MAX_HEIGHT = Math.min(Math.round(WINDOW_HEIGHT * 0.88), 520);

type UserProfile = {
  name: string;
  email: string;
  role?: string;
  clerk_username?: string | null;
  branch_id?: number | null;
};

type BranchRow = {
  id: number;
  name: string;
  vat_enabled?: boolean | number | null;
  vat_rate?: number | string | null;
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
  const { token, user: authUser } = useAuth();

  const [vatBranches, setVatBranches] = useState<BranchRow[]>([]);
  const [vatLoading, setVatLoading] = useState(false);
  const [vatSaving, setVatSaving] = useState(false);
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRateStr, setVatRateStr] = useState("12");
  const [vatSelectedBranchId, setVatSelectedBranchId] = useState<number | null>(null);
  const [vatBranchModalVisible, setVatBranchModalVisible] = useState(false);
  /** Owner: read-only overview of VAT status for every branch */
  const [vatOverviewModalVisible, setVatOverviewModalVisible] = useState(false);

  const loadProfile = useCallback(async () => {
    setProfileError(null);
    setIsLoadingProfile(true);
    try {
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
      const bidRaw = u.branch_id;
      const branchId =
        bidRaw !== null && bidRaw !== undefined && bidRaw !== ""
          ? Number(bidRaw)
          : null;

      setProfile({
        name: typeof u.name === "string" ? u.name : "",
        email: typeof u.email === "string" ? u.email : "",
        role: typeof u.role === "string" ? u.role : undefined,
        clerk_username:
          u.clerk_username === null || typeof u.clerk_username === "string"
            ? (u.clerk_username as string | null)
            : undefined,
        branch_id: branchId !== null && Number.isFinite(branchId) ? branchId : null,
      });
    } catch (e) {
      console.log(e);
      setProfile(null);
      setProfileError("Something went wrong. Check your connection.");
    } finally {
      setIsLoadingProfile(false);
    }
  }, [token]);

  const parseBranchVat = useCallback((br: BranchRow) => {
    const ve = br.vat_enabled !== false && br.vat_enabled !== 0;
    const vr = br.vat_rate != null && br.vat_rate !== "" ? Number(br.vat_rate) : 12;
    return {
      vatEnabled: ve,
      vatRate: Number.isFinite(vr) ? vr : 12,
    };
  }, []);

  const applyBranchRowToVatForm = useCallback(
    (br: BranchRow) => {
      const { vatEnabled: ve, vatRate: vr } = parseBranchVat(br);
      setVatEnabled(ve);
      setVatRateStr(String(vr));
    },
    [parseBranchVat]
  );

  const loadVatSettings = useCallback(async () => {
    if (!token) return;
    setVatLoading(true);
    try {
      const res = await fetch(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setVatBranches([]);
        return;
      }
      const rows: BranchRow[] = data.map((b: Record<string, unknown>) => ({
        id: Number(b.id),
        name: String(b.name ?? ""),
        vat_enabled: b.vat_enabled as boolean | number | null | undefined,
        vat_rate: b.vat_rate as number | string | null | undefined,
      }));
      setVatBranches(rows);

      const role = String(authUser?.role ?? "").toLowerCase();
      let targetId: number | null = null;

      if (role === "owner") {
        let persisted: number | null = null;
        try {
          const raw = await AsyncStorage.getItem(VAT_OWNER_BRANCH_STORAGE_KEY);
          if (raw != null && raw !== "") {
            const n = Number(raw);
            if (Number.isFinite(n) && rows.some((r) => r.id === n)) persisted = n;
          }
        } catch {
          /* ignore */
        }
        const nextId = persisted;
        setVatSelectedBranchId(nextId);
        targetId = nextId;
      } else if (role === "clerk" || role === "staff") {
        const bid = Number(authUser?.branch_id);
        targetId = Number.isFinite(bid) && bid > 0 ? bid : rows[0]?.id ?? null;
      }

      const br = targetId != null ? rows.find((r) => r.id === targetId) : null;
      if (br) {
        applyBranchRowToVatForm(br);
      } else if (role === "owner") {
        setVatEnabled(true);
        setVatRateStr("12");
      }
    } catch (e) {
      console.log(e);
    } finally {
      setVatLoading(false);
    }
  }, [token, authUser, applyBranchRowToVatForm]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadVatSettings();
    }, [loadProfile, loadVatSettings])
  );

  const roleLower = String(profile?.role ?? authUser?.role ?? "").toLowerCase();
  const canEditVat = roleLower === "owner" || roleLower === "clerk";

  const effectiveVatBranchId = (): number | null => {
    if (roleLower === "owner") return vatSelectedBranchId;
    const bid = Number(authUser?.branch_id ?? profile?.branch_id);
    return Number.isFinite(bid) && bid > 0 ? bid : null;
  };

  const handleSaveVat = async () => {
    const bid = effectiveVatBranchId();
    if (!bid || !token) {
      Alert.alert("Error", "No branch selected for VAT settings.");
      return;
    }
    const rateNum = parseFloat(String(vatRateStr).replace(",", "."));
    if (vatEnabled) {
      if (!Number.isFinite(rateNum) || rateNum < 0 || rateNum > 100) {
        Alert.alert("Invalid VAT rate", "Enter a percentage between 0 and 100.");
        return;
      }
    }
    setVatSaving(true);
    try {
      const res = await fetch(`${API_URL}/branches/${bid}/vat-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          vat_enabled: vatEnabled,
          vat_rate: Number.isFinite(rateNum) ? rateNum : 12,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        Alert.alert("Could not save", formatApiErrorMessage(payload));
        return;
      }
      await loadVatSettings();
      Alert.alert("Saved", "VAT settings were updated for this branch.");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong. Try again.");
    } finally {
      setVatSaving(false);
    }
  };

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

              {/* VAT — branch settings from API */}
              <View style={[styles.profileCard, styles.sectionCardFollow]}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>VAT (sales tax)</Text>
                </View>
                <Text style={styles.vatHint}>
                  Applies to new sales for this branch. Same settings sync to the web POS after you save.
                </Text>
                {roleLower === "owner" && !vatLoading && vatBranches.length > 0 ? (
                  <TouchableOpacity
                    style={styles.vatViewListBtn}
                    onPress={() => setVatOverviewModalVisible(true)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="View VAT status for all branches"
                  >
                    <Text style={styles.vatViewListBtnText}>View list</Text>
                  </TouchableOpacity>
                ) : null}
                {vatLoading ? (
                  <View style={styles.vatLoadingRow}>
                    <ActivityIndicator size="small" color="#3b82f6" />
                    <Text style={styles.loadingText}>Loading branch settings…</Text>
                  </View>
                ) : (
                  <>
                    {roleLower === "owner" && vatBranches.length > 0 ? (
                      <TouchableOpacity
                        style={styles.vatBranchPick}
                        onPress={() => setVatBranchModalVisible(true)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.label}>Branch</Text>
                        <View style={styles.vatBranchPickInner}>
                          <Text style={styles.vatBranchPickText} numberOfLines={1}>
                            {vatSelectedBranchId == null
                              ? "No branch selected"
                              : vatBranches.find((b) => b.id === vatSelectedBranchId)?.name ?? "—"}
                          </Text>
                          <Text style={styles.vatBranchChevron}>▼</Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}

                    <View style={styles.vatRow}>
                      <Text style={styles.label}>Apply VAT on new sales</Text>
                      <Switch
                        value={vatEnabled}
                        onValueChange={setVatEnabled}
                        disabled={!canEditVat}
                        trackColor={{ false: "#cbd5e1", true: "#86efac" }}
                        thumbColor={vatEnabled ? "#22c55e" : "#f4f4f5"}
                      />
                    </View>

                    {vatEnabled ? (
                      <View style={[styles.inputGroup, styles.inputGroupLast]}>
                        <Text style={styles.label}>VAT rate (%)</Text>
                        <TextInput
                          style={styles.vatRateInput}
                          value={vatRateStr}
                          onChangeText={setVatRateStr}
                          keyboardType="decimal-pad"
                          editable={canEditVat}
                          placeholder="12"
                          placeholderTextColor="#94a3b8"
                        />
                      </View>
                    ) : null}

                    {!canEditVat ? (
                      <Text style={styles.vatStaffNote}>
                        Only the shop owner or a branch clerk can change VAT. Ask them to update Profile → VAT.
                      </Text>
                    ) : null}

                    {canEditVat ? (
                      <TouchableOpacity
                        style={[styles.vatSaveBtn, vatSaving && styles.buttonDisabled]}
                        onPress={handleSaveVat}
                        disabled={vatSaving}
                        activeOpacity={0.88}
                      >
                        <Text style={styles.vatSaveBtnText}>
                          {vatSaving ? "Saving…" : "Save VAT settings"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
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

      {/* Owner: pick which branch VAT applies to */}
      <Modal
        visible={vatBranchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVatBranchModalVisible(false)}
      >
        <View style={styles.vatBranchModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVatBranchModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close branch picker"
          />
          <View style={styles.vatBranchModalCard} pointerEvents="box-none">
            <Text style={styles.vatBranchModalTitle}>Select branch</Text>
            <ScrollView style={styles.vatBranchModalScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[
                  styles.vatBranchRow,
                  vatSelectedBranchId === null && styles.vatBranchRowSelected,
                ]}
                onPress={async () => {
                  setVatSelectedBranchId(null);
                  setVatEnabled(true);
                  setVatRateStr("12");
                  try {
                    await AsyncStorage.removeItem(VAT_OWNER_BRANCH_STORAGE_KEY);
                  } catch {
                    /* ignore */
                  }
                  setVatBranchModalVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.vatBranchRowText,
                    vatSelectedBranchId === null && styles.vatBranchRowTextSelected,
                  ]}
                >
                  No branch selected
                </Text>
              </TouchableOpacity>
              {vatBranches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.vatBranchRow,
                    vatSelectedBranchId === b.id && styles.vatBranchRowSelected,
                  ]}
                  onPress={async () => {
                    setVatSelectedBranchId(b.id);
                    applyBranchRowToVatForm(b);
                    try {
                      await AsyncStorage.setItem(VAT_OWNER_BRANCH_STORAGE_KEY, String(b.id));
                    } catch {
                      /* ignore */
                    }
                    setVatBranchModalVisible(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.vatBranchRowText,
                      vatSelectedBranchId === b.id && styles.vatBranchRowTextSelected,
                    ]}
                  >
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Owner: all branches VAT on/off overview */}
      <Modal
        visible={vatOverviewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVatOverviewModalVisible(false)}
      >
        <View style={styles.vatBranchModalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVatOverviewModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close VAT overview"
          />
          <View style={styles.vatOverviewModalCard} pointerEvents="box-none">
            <Text style={styles.vatBranchModalTitle}>VAT by branch</Text>
            <Text style={styles.vatOverviewSubtitle}>
              Shows whether VAT applies to new sales at each location (saved settings).
            </Text>
            <ScrollView
              style={styles.vatOverviewScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {[...vatBranches]
                .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), undefined, { sensitivity: "base" }))
                .map((b) => {
                  const { vatEnabled, vatRate } = parseBranchVat(b);
                  return (
                    <View key={b.id} style={styles.vatOverviewRow}>
                      <View style={styles.vatOverviewRowMain}>
                        <Text style={styles.vatOverviewBranchName} numberOfLines={2}>
                          {b.name?.trim() || `Branch ${b.id}`}
                        </Text>
                        <Text style={styles.vatOverviewMeta}>
                          {vatEnabled
                            ? `Rate ${vatRate}% on new sales`
                            : "VAT not applied on new sales"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.vatOverviewBadge,
                          vatEnabled ? styles.vatOverviewBadgeOn : styles.vatOverviewBadgeOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.vatOverviewBadgeText,
                            vatEnabled ? styles.vatOverviewBadgeTextOn : styles.vatOverviewBadgeTextOff,
                          ]}
                        >
                          {vatEnabled ? "VAT on" : "VAT off"}
                        </Text>
                      </View>
                    </View>
                  );
                })}
            </ScrollView>
            <TouchableOpacity
              style={styles.vatOverviewCloseBtn}
              onPress={() => setVatOverviewModalVisible(false)}
              activeOpacity={0.88}
            >
              <Text style={styles.vatOverviewCloseBtnText}>Close</Text>
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
  vatHint: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 19,
    marginBottom: 12,
    fontWeight: "500",
  },
  vatViewListBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  vatViewListBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1d4ed8",
    letterSpacing: 0.2,
  },
  vatLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  vatBranchPick: {
    marginBottom: 18,
  },
  vatBranchPickInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    marginTop: 8,
  },
  vatBranchPickText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  vatBranchChevron: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 8,
  },
  vatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  vatRateInput: {
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#1e293b",
    fontWeight: "600",
  },
  vatStaffNote: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 19,
  },
  vatSaveBtn: {
    marginTop: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  vatSaveBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  vatBranchModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  vatBranchModalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  vatBranchModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1e293b",
    marginBottom: 12,
  },
  vatBranchModalScroll: {
    maxHeight: 320,
  },
  vatBranchRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: "#f8fafc",
  },
  vatBranchRowSelected: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
  },
  vatBranchRowText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  vatBranchRowTextSelected: {
    color: "#1d4ed8",
  },
  vatOverviewModalCard: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "88%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 12,
  },
  vatOverviewSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
  vatOverviewScroll: {
    maxHeight: 360,
    marginBottom: 12,
  },
  vatOverviewRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  vatOverviewRowMain: {
    flex: 1,
    minWidth: 0,
  },
  vatOverviewBranchName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  vatOverviewMeta: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  vatOverviewBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    flexShrink: 0,
  },
  vatOverviewBadgeOn: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
  },
  vatOverviewBadgeOff: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  vatOverviewBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  vatOverviewBadgeTextOn: {
    color: "#166534",
  },
  vatOverviewBadgeTextOff: {
    color: "#475569",
  },
  vatOverviewCloseBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  vatOverviewCloseBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
});
