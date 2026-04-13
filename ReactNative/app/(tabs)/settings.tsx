import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from '@expo/vector-icons/Ionicons';
import { API_URL } from "../../config/api";

type Branch = {
  id: number;
  name: string;
};

type StaffUser = {
  id: number;
  name: string;
  first_name?: string | null;
  middle_initial?: string | null;
  last_name?: string | null;
  email: string;
  role: string;
  branch_id?: number | null;
  is_active?: boolean;
  is_online?: boolean;
  branch?: { id: number; name: string; clerk_username?: string | null; is_active?: boolean } | null;
  total_revenue_php?: number | string | null;
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

const EmployeeSettingsScreen = () => {
  const SETTINGS_POLL_MS = 30_000;
  const router = useRouter();
  const { token, logout } = useAuth();

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentUser, setCurrentUser] = useState<{ role?: string } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editFirst, setEditFirst] = useState("");
  const [editMiddle, setEditMiddle] = useState("");
  const [editLast, setEditLast] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"clerk" | "staff">("clerk");
  const [editBranchId, setEditBranchId] = useState<number | null>(null);

  const [open, setOpen] = useState(false);
  const isSelectedDeactivated = selectedStaff?.is_active === false;
  const isSelectedActive = !!selectedStaff && selectedStaff.is_active !== false;
  const [pendingStatusToggle, setPendingStatusToggle] = useState<{
    nextIsActive: boolean;
  } | null>(null);

  const loadStaff = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/staff-accounts`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      setStaffList(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log(e);
    }
  };

  const loadBranches = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/branches`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log(e);
    }
  };

  const loadCurrentUser = async () => {
    try {
      if (!token) return;
      const res = await fetch(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      setCurrentUser({ role: data?.role });
    } catch (e) {
      console.log(e);
    }
  };

  const loadSettingsData = useCallback(async () => {
    await Promise.all([loadStaff(), loadBranches(), loadCurrentUser()]);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadSettingsData();

      const intervalId = setInterval(() => {
        loadSettingsData();
      }, SETTINGS_POLL_MS);

      const onAppState = (next: AppStateStatus) => {
        if (next === "active") {
          loadSettingsData();
        }
      };

      const appSub = AppState.addEventListener("change", onAppState);

      return () => {
        clearInterval(intervalId);
        appSub.remove();
      };
    }, [loadSettingsData])
  );

  const isOwner = currentUser?.role === "owner";
  const isLoadingAccess = currentUser === null;

  const openEdit = (staff: StaffUser) => {
    setSelectedStaff(staff);
    setEditFirst(staff.first_name || staff.name?.split(/\s+/)[0] || "");
    setEditMiddle(staff.middle_initial || "");
    const parts = (staff.name || "").trim().split(/\s+/);
    setEditLast(staff.last_name || (parts.length > 1 ? parts[parts.length - 1] : ""));
    setEditEmail(staff.email);
    setEditPassword("");
    setEditRole(staff.role === "staff" ? "staff" : "clerk");
    setEditBranchId(staff.branch_id ?? null);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedStaff(null);
    setEditPassword("");
    setPendingStatusToggle(null);
  };

  const handleSave = async () => {
    if (!selectedStaff || !token) return;
    const first = editFirst.trim();
    const last = editLast.trim();
    const email = editEmail.trim();
    if (!first || !last || !email) {
      Alert.alert("Error", "First name, last name, and email are required.");
      return;
    }

    try {
      setIsSubmitting(true);
      const body: Record<string, unknown> = {
        first_name: first,
        middle_initial: editMiddle.trim() || null,
        last_name: last,
        email,
        role: editRole,
        branch_id: editBranchId,
      };
      if (editPassword.trim().length > 0) {
        body.password = editPassword.trim();
        body.password_confirmation = editPassword.trim();
      }

      const res = await fetch(`${API_URL}/staff-accounts/${selectedStaff.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = formatApiErrorMessage(await res.json().catch(() => ({})));
        Alert.alert("Could not update", msg);
        return;
      }

      await loadStaff();
      closeModal();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openStatusConfirm = (nextIsActive: boolean) => {
    setPendingStatusToggle({ nextIsActive });
  };

  const handleToggleActive = async (nextIsActive: boolean) => {
    if (!selectedStaff || !token) return;

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_URL}/staff-accounts/${selectedStaff.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ is_active: nextIsActive }),
      });

      if (!res.ok) {
        Alert.alert("Error", formatApiErrorMessage(await res.json().catch(() => ({}))));
        return;
      }

      // Optimistic local update so modal/list reflects status immediately.
      setSelectedStaff((prev) => (prev ? { ...prev, is_active: nextIsActive } : prev));
      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === selectedStaff.id ? { ...staff, is_active: nextIsActive } : staff
        )
      );
      await loadStaff();
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setIsSubmitting(false);
      setPendingStatusToggle(null);
    }
  };

  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Employee Settings</Text>
          <View style={styles.headerAccent} />
        </View>

        <View style={styles.profileContainer}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => setOpen(!open)}>
            <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
          </TouchableOpacity>

          {open && (
            <View style={styles.dropdown}>
              <TouchableOpacity style={styles.dropdownItem} onPress={handleProfile}>
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dropdownItem, styles.dropdownItemLast]} onPress={handleLogout}>
                <Text style={styles.dropdownText}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {isLoadingAccess ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : isOwner ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTitle}>Staff logins</Text>
            </View>

            <View style={styles.listContainer}>
              {staffList.map((staff, index) => (
                <View
                  key={staff.id}
                  style={[styles.branchItem, index < staffList.length - 1 && styles.branchItemBorder]}
                >
                  <View style={styles.branchLeft}>
                    <View style={styles.branchIconContainer}>
                      <Ionicons name="person" size={20} color="#3b82f6" />
                    </View>
                    <View style={styles.branchTextBlock}>
                      <Text style={styles.branchName}>
                        {staff.name}
                        {staff.is_active === false ? (
                          <Text style={styles.inactiveLabel}> (Inactive)</Text>
                        ) : (
                          <Text
                            style={
                              staff.is_online ? styles.staffOnlineLabel : styles.staffOfflineLabel
                            }
                          >
                            {staff.is_online ? " · Active" : " · Inactive"}
                          </Text>
                        )}
                      </Text>
                      <Text style={styles.roleBadge}>
                        {(staff.role || "").toUpperCase()} · {staff.email}
                      </Text>
                      <Text style={styles.branchSubtext} numberOfLines={1}>
                        Branch: {staff.branch?.name || "Unassigned"}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.editButton} onPress={() => openEdit(staff)}>
                    <Ionicons name="create-outline" size={22} color="#3b82f6" />
                  </TouchableOpacity>
                </View>
              ))}

              {staffList.length === 0 && (
                <Text style={styles.empty}>No staff accounts yet. Create them from the Employees tab.</Text>
              )}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay} pointerEvents="box-none">
          <View style={styles.modalBox} pointerEvents="auto">
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit employee</Text>
              <Pressable style={styles.modalCloseBtn} onPress={closeModal} accessibilityRole="button">
                <Text style={styles.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
              <View style={styles.modalContent}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>First name</Text>
                  <TextInput style={styles.input} value={editFirst} onChangeText={setEditFirst} />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Middle initial (optional)</Text>
                  <TextInput style={styles.input} value={editMiddle} onChangeText={setEditMiddle} maxLength={8} />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Last name</Text>
                  <TextInput style={styles.input} value={editLast} onChangeText={setEditLast} />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>New password (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={editPassword}
                    onChangeText={setEditPassword}
                    secureTextEntry
                    placeholder="Leave blank to keep current"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <Text style={styles.inputLabel}>Role</Text>
                <View style={styles.roleRow}>
                  {(["clerk", "staff"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, editRole === r && styles.roleChipActive]}
                      onPress={() => setEditRole(r)}
                    >
                      <Text style={[styles.roleChipText, editRole === r && styles.roleChipTextActive]}>
                        {r}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Branch</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchChips}>
                  <TouchableOpacity
                    style={[styles.chip, editBranchId === null && styles.chipActive]}
                    onPress={() => setEditBranchId(null)}
                  >
                    <Text style={[styles.chipText, editBranchId === null && styles.chipTextActive]}>Unassigned</Text>
                  </TouchableOpacity>
                  {branches.map((b) => (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.chip, editBranchId === b.id && styles.chipActive]}
                      onPress={() => setEditBranchId(b.id)}
                    >
                      <Text style={[styles.chipText, editBranchId === b.id && styles.chipTextActive]}>{b.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.modalButtons}>
                  <Pressable
                    style={[styles.cancelButton, isSubmitting && styles.buttonDisabled]}
                    onPress={closeModal}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.confirmButton, isSubmitting && styles.buttonDisabled]}
                    onPress={handleSave}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Save</Text>}
                  </Pressable>
                </View>

                {isSelectedActive ? (
                  <Pressable
                    style={[styles.deactivateAccountBtn, isSubmitting && styles.buttonDisabled]}
                    onPress={() => openStatusConfirm(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.deactivateAccountText}>Deactivate account</Text>
                  </Pressable>
                ) : null}
                {isSelectedDeactivated ? (
                  <Pressable
                    style={[styles.reactivateAccountBtn, isSubmitting && styles.buttonDisabled]}
                    onPress={() => openStatusConfirm(true)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.reactivateAccountText}>Reactivate account</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pendingStatusToggle !== null} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {pendingStatusToggle?.nextIsActive ? "Reactivate account" : "Deactivate account"}
            </Text>
            <Text style={styles.confirmMessage}>
              {pendingStatusToggle?.nextIsActive
                ? "This employee will be able to sign in again."
                : "This employee will no longer be able to sign in."}
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                style={[styles.confirmCancelBtn, isSubmitting && styles.buttonDisabled]}
                onPress={() => setPendingStatusToggle(null)}
                disabled={isSubmitting}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  pendingStatusToggle?.nextIsActive ? styles.confirmReactivateBtn : styles.confirmDeactivateBtn,
                  isSubmitting && styles.buttonDisabled,
                ]}
                onPress={() => {
                  if (pendingStatusToggle) {
                    void handleToggleActive(pendingStatusToggle.nextIsActive);
                  }
                }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmActionText}>
                    {pendingStatusToggle?.nextIsActive ? "Reactivate" : "Deactivate"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default EmployeeSettingsScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  headerLeft: { position: "relative" },
  headerText: { fontSize: 24, fontWeight: "800", color: "#1e293b", letterSpacing: -0.5 },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  profileContainer: { position: "relative", zIndex: 2000 },
  profileBtn: { padding: 6 },
  dropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 999,
    minWidth: 120,
    zIndex: 9999,
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownText: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  loadingState: {
    flex: 1,
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  cardHeaderTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b" },
  headerEdit: { fontSize: 14, fontWeight: "700", color: "#94a3b8" },
  listContainer: { paddingBottom: 8 },
  branchItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  branchItemBorder: { borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  branchLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  branchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  branchTextBlock: { flex: 1, minWidth: 0 },
  branchName: { fontSize: 16, fontWeight: "700", color: "#1e293b" },
  inactiveLabel: { fontSize: 14, fontWeight: "600", color: "#94a3b8" },
  staffOnlineLabel: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  staffOfflineLabel: { fontSize: 14, fontWeight: "700", color: "#dc2626" },
  roleBadge: { fontSize: 12, color: "#64748b", marginTop: 2, fontWeight: "600" },
  branchSubtext: { fontSize: 13, color: "#64748b", marginTop: 2 },
  editButton: { padding: 8 },
  empty: { textAlign: "center", color: "#64748b", paddingVertical: 24, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalScroll: { maxHeight: 480 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", flex: 1 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: { fontSize: 18, color: "#64748b", fontWeight: "600" },
  modalContent: { padding: 20, paddingBottom: 28 },
  inputContainer: { marginBottom: 14 },
  inputLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginBottom: 6 },
  input: {
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    color: "#1e293b",
  },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  roleChipActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  roleChipText: { fontWeight: "700", color: "#64748b", textTransform: "capitalize" },
  roleChipTextActive: { color: "#1d4ed8" },
  branchChips: { flexDirection: "row", marginBottom: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTextActive: { color: "#fff" },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  cancelButtonText: { color: "#475569", fontWeight: "700" },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  confirmButtonText: { color: "#ffffff", fontWeight: "700" },
  buttonDisabled: { opacity: 0.6 },
  deactivateAccountBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#ef4444",
    alignItems: "center",
  },
  deactivateAccountText: { color: "#ef4444", fontWeight: "700" },
  reactivateAccountBtn: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#22c55e",
    alignItems: "center",
  },
  reactivateAccountText: { color: "#22c55e", fontWeight: "700" },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
  },
  confirmTitle: { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 8 },
  confirmMessage: { fontSize: 14, color: "#475569", marginBottom: 16, lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 10 },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  confirmCancelText: { color: "#475569", fontWeight: "700" },
  confirmDeactivateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#ef4444",
    minHeight: 44,
    justifyContent: "center",
  },
  confirmReactivateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#22c55e",
    minHeight: 44,
    justifyContent: "center",
  },
  confirmActionText: { color: "#fff", fontWeight: "700" },
});
