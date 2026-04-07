import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BarChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../../config/api";

type Branch = {
  id: number;
  name: string;
};

type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  branch_id: number | null;
  is_active?: boolean;
  /** True while staff has an active web POS session (updated on login/logout). */
  is_online?: boolean;
  branch?: { id: number; name: string } | null;
  /** Sum of paid POS transactions this login created (from API). */
  total_revenue_php?: number | string | null;
};

type RoleFilter = "all" | "clerk" | "staff";

/** HR / clerk record from `/employees` (revenue metrics for chart). */
type HrEmployee = {
  id: number;
  name: string;
  username: string;
  net_revenue_php: number;
  gain_percent: number;
  loss_percent: number;
  revenue_outcome: string | null;
  branch_name: string | null;
};

/** Laravel JSON: { message, errors?: { field: string[] } } */
function formatLaravelApiError(data: unknown, httpStatus?: number): string {
  if (!data || typeof data !== "object") {
    return "Unable to create staff account.";
  }
  const d = data as Record<string, unknown>;
  const rawErrors = d.errors;
  if (rawErrors && typeof rawErrors === "object" && rawErrors !== null) {
    const lines: string[] = [];
    for (const [, msgs] of Object.entries(rawErrors)) {
      if (Array.isArray(msgs)) {
        for (const m of msgs) {
          if (typeof m === "string") lines.push(m);
        }
      } else if (typeof msgs === "string") {
        lines.push(msgs);
      }
    }
    if (lines.length) return lines.join("\n");
  }
  if (typeof d.message === "string" && d.message.trim()) {
    const msg = d.message.trim();
    if (httpStatus === 500 || msg === "Server Error") {
      return `${msg}\n\nIf this continues, deploy the latest API and run php artisan migrate on Render (or check server logs).`;
    }
    return msg;
  }
  return "Unable to create staff account.";
}

/** X-axis label for chart: email local-part, or display name. */
function chartLabelForStaffUser(s: StaffUser): string {
  if (s.email) {
    const local = String(s.email).split("@")[0];
    return local.length > 10 ? `${local.slice(0, 9)}…` : local;
  }
  const n = (s.name || "?").trim();
  return n.length > 10 ? `${n.slice(0, 9)}…` : n;
}

const getOutcomeColor = (outcome: string | null) => {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "gain") return "#16a34a";
  if (normalized === "loss") return "#d97706";
  if (normalized === "bad") return "#dc2626";
  return "#64748b";
};

/** How often to refetch staff / HR / branches while this screen is focused. */
const EMPLOYEES_POLL_MS = 30_000;

export default function EmployeesScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [hrEmployees, setHrEmployees] = useState<HrEmployee[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [cFirst, setCFirst] = useState("");
  const [cMiddle, setCMiddle] = useState("");
  const [cLast, setCLast] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPassword, setCPassword] = useState("");
  const [cPassword2, setCPassword2] = useState("");
  const [cRole, setCRole] = useState<"clerk" | "staff">("clerk");
  const [cBranchId, setCBranchId] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [assignStaffOpen, setAssignStaffOpen] = useState(false);
  const [assignStaffUser, setAssignStaffUser] = useState<StaffUser | null>(null);
  const [assignStaffBranchId, setAssignStaffBranchId] = useState<number | null>(null);

  const loadData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) setIsLoading(true);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [staffRes, hrRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/staff-accounts`, { headers }),
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/branches`, { headers }),
      ]);

      const staffData = staffRes.ok ? await staffRes.json() : [];
      const hrData = hrRes.ok ? await hrRes.json() : [];
      const branchesData = branchesRes.ok ? await branchesRes.json() : [];

      setStaffUsers(Array.isArray(staffData) ? staffData : []);
      setHrEmployees(Array.isArray(hrData) ? hrData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (error) {
      console.log(error);
      if (!silent) {
        Alert.alert("Load failed", "Unable to load data. Check your connection.");
      }
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();

      const intervalId = setInterval(() => {
        loadData({ silent: true });
      }, EMPLOYEES_POLL_MS);

      const onAppState = (next: AppStateStatus) => {
        if (next === "active") loadData({ silent: true });
      };
      const appSub = AppState.addEventListener("change", onAppState);

      return () => {
        clearInterval(intervalId);
        appSub.remove();
      };
    }, [loadData])
  );

  const filteredStaff = useMemo(() => {
    let list = staffUsers;
    if (roleFilter === "clerk") list = list.filter((s) => s.role === "clerk");
    if (roleFilter === "staff") list = list.filter((s) => s.role === "staff");
    if (selectedBranchName) {
      list = list.filter((s) => (s.branch?.name || "") === selectedBranchName);
    }
    return list;
  }, [staffUsers, roleFilter, selectedBranchName]);

  /** Revenue share chart: one bar per staff login; peso amounts from POS totals when API provides them, else HR name match. */
  const clerkSharePercentChart = useMemo(() => {
    const list = filteredStaff;
    if (list.length === 0) {
      return { labels: [""], data: [0] };
    }
    const amounts = list.map((s) => {
      if ("total_revenue_php" in s && s.total_revenue_php != null && s.total_revenue_php !== "") {
        return Math.max(0, Number(s.total_revenue_php));
      }
      const key = (s.name || "").trim().toLowerCase();
      const h = hrEmployees.find((e) => (e.name || "").trim().toLowerCase() === key);
      return Math.max(0, Number(h?.net_revenue_php || 0));
    });
    const sum = amounts.reduce((a, b) => a + b, 0);
    const data =
      sum > 0
        ? amounts.map((a) => Number(((a / sum) * 100).toFixed(1)))
        : amounts.map(() => 0);
    const labels = list.map((s) => chartLabelForStaffUser(s));
    return { labels, data };
  }, [filteredStaff, hrEmployees]);

  const chartWindowW = Dimensions.get("window").width;
  const clerkChartWidth = Math.max(chartWindowW - 48, clerkSharePercentChart.labels.length * 56);

  const hrMatchForStaff = useCallback(
    (s: StaffUser) => {
      const key = (s.name || "").trim().toLowerCase();
      if (!key) return null;
      return hrEmployees.find((h) => (h.name || "").trim().toLowerCase() === key) ?? null;
    },
    [hrEmployees]
  );

  const resetCreate = () => {
    setCreateStep(1);
    setCFirst("");
    setCMiddle("");
    setCLast("");
    setCEmail("");
    setCPassword("");
    setCPassword2("");
    setCRole("clerk");
    setCBranchId(null);
    setCreateError(null);
  };

  const createStaffAccount = async () => {
    try {
      setIsSaving(true);
      setCreateError(null);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const response = await fetch(`${API_URL}/staff-accounts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          first_name: cFirst.trim(),
          middle_initial: cMiddle.trim() || null,
          last_name: cLast.trim(),
          email: cEmail.trim().toLowerCase(),
          password: cPassword,
          password_confirmation: cPassword2,
          role: cRole,
          branch_id: cBranchId,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setCreateError(formatLaravelApiError(data, response.status));
        return;
      }

      setCreateOpen(false);
      resetCreate();
      await loadData();
      Alert.alert("Created", "Staff login account saved.");
    } catch (error) {
      console.log(error);
      setCreateError(
        error instanceof Error ? error.message : "Unable to create staff account. Check your connection."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openStaffAssign = (staff: StaffUser) => {
    setAssignStaffUser(staff);
    setAssignStaffBranchId(staff.branch?.id ?? null);
    setAssignStaffOpen(true);
  };

  const assignStaffBranch = async () => {
    if (!assignStaffUser) return;
    try {
      setIsSaving(true);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const response = await fetch(`${API_URL}/staff-accounts/${assignStaffUser.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          branch_id: assignStaffBranchId,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        Alert.alert("Assign failed", formatLaravelApiError(err, response.status));
        return;
      }
      setAssignStaffOpen(false);
      setAssignStaffUser(null);
      setAssignStaffBranchId(null);
      await loadData();
      Alert.alert("Updated", "Branch assignment saved for this web login.");
    } catch (error) {
      console.log(error);
      Alert.alert("Assign failed", "Unable to assign branch.");
    } finally {
      setIsSaving(false);
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

  const goNextStep = () => {
    if (createStep === 1) {
      if (!cFirst.trim() || !cLast.trim()) {
        Alert.alert("Required", "First and last name are required.");
        return;
      }
      setCreateStep(2);
      return;
    }
    if (createStep === 2) {
      if (!cEmail.trim() || !cPassword || cPassword.length < 6) {
        Alert.alert("Required", "Valid email and password (min 6 chars) are required.");
        return;
      }
      if (cPassword !== cPassword2) {
        Alert.alert("Mismatch", "Passwords do not match.");
        return;
      }
      setCreateStep(3);
      return;
    }
    if (createStep === 3) {
      setCreateError(null);
      setCreateStep(4);
    }
  };

  const goPrevStep = () => {
    if (createStep > 1) {
      if (createStep === 4) setCreateError(null);
      setCreateStep((s) => s - 1);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Employees</Text>
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

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarLabel}>Role</Text>
          <View style={styles.segmentRow}>
            {(
              [
                ["all", "All"],
                ["clerk", "Clerk"],
                ["staff", "Staff"],
              ] as const
            ).map(([key, label]) => {
              const active = roleFilter === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.segmentChip, active && styles.segmentChipActive]}
                  onPress={() => setRoleFilter(key)}
                >
                  <Text style={[styles.segmentChipText, active && styles.segmentChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.toolbarLabel, { marginTop: 10 }]}>Branch</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.chip, !selectedBranchName && styles.chipActive]}
              onPress={() => setSelectedBranchName(null)}
            >
              <Text style={[styles.chipText, !selectedBranchName && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {branches.map((branch) => {
              const active = selectedBranchName === branch.name;
              return (
                <TouchableOpacity
                  key={branch.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedBranchName(active ? null : branch.name)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{branch.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.toolbarActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadData}>
              <Ionicons name="refresh-outline" size={14} color="#1e293b" />
              <Text style={styles.secondaryBtnText}>{isLoading ? "Loading..." : "Refresh"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                resetCreate();
                setCreateOpen(true);
              }}
            >
              <Ionicons name="add-outline" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>Create staff</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Revenue share</Text>
        <Text style={styles.sectionHint}>
          One bar per web staff login (same filters as below). Percentages are shares of total paid POS revenue for
          those staff (from the database). If the API does not expose totals yet, amounts fall back to HR when names
          match.
        </Text>

        {filteredStaff.length > 0 ? (
          <View style={styles.chartSection}>
            <Text style={styles.chartSectionTitle}>Staff — revenue share</Text>
            <Text style={styles.chartSectionSub}>Percent of total net revenue (not peso amounts).</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <BarChart
                data={{
                  labels: clerkSharePercentChart.labels,
                  datasets: [{ data: clerkSharePercentChart.data }],
                }}
                width={clerkChartWidth}
                height={220}
                yAxisLabel=""
                yAxisSuffix="%"
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  decimalPlaces: 1,
                  color: () => "rgba(37, 99, 235, 1)",
                  labelColor: () => "#334155",
                  formatYLabel: (y: string) => String(y),
                  propsForLabels: { fontSize: 11 },
                  propsForBackgroundLines: { stroke: "#e2e8f0", strokeWidth: 1 },
                }}
                style={styles.barChart}
                fromZero
                showValuesOnTopOfBars
                verticalLabelRotation={0}
              />
            </ScrollView>
          </View>
        ) : !isLoading ? (
          <Text style={styles.empty}>No staff accounts for this filter — nothing to chart.</Text>
        ) : null}

        <Text style={[styles.sectionHeading, { marginTop: 20 }]}>Staff logins (web)</Text>
        <Text style={styles.sectionHint}>
          Accounts that can sign in on the web POS. Assign a branch so they work in that location.
        </Text>
        {filteredStaff.length === 0 && !isLoading ? (
          <Text style={styles.empty}>No staff accounts match this filter.</Text>
        ) : (
          filteredStaff.map((s) => {
            const linked = hrMatchForStaff(s);
            const hasDbTotal = "total_revenue_php" in s && s.total_revenue_php != null && s.total_revenue_php !== "";
            const net = hasDbTotal
              ? Math.max(0, Number(s.total_revenue_php))
              : linked
                ? Number(linked.net_revenue_php || 0)
                : 0;
            const gain = linked ? linked.gain_percent || 0 : 0;
            const loss = linked ? linked.loss_percent || 0 : 0;
            const outcome = linked?.revenue_outcome || null;
            const handle = s.email ? `@${String(s.email).split("@")[0]}` : "—";
            return (
              <View key={`staff-${s.id}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardMain}>
                    <Text style={styles.name}>{s.name}</Text>
                    <Text style={styles.sub}>{handle}</Text>
                    <Text
                      style={[
                        styles.sub,
                        styles.presenceLabel,
                        s.is_active === false
                          ? styles.presenceDisabled
                          : s.is_online
                            ? styles.presenceActive
                            : styles.presenceInactive,
                      ]}
                    >
                      {s.is_active === false ? "Disabled" : s.is_online ? "Active" : "Inactive"}
                    </Text>
                    <Text style={styles.sub}>Branch: {s.branch?.name || "Unassigned"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                      <Text style={styles.badge}>{(s.role || "staff").toUpperCase()}</Text>
                      <Text
                        style={[styles.sub, { color: outcome ? getOutcomeColor(outcome) : "#64748b" }]}
                      >
                        Outcome: {outcome || (linked ? "n/a" : "—")}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.assignBtn} onPress={() => openStaffAssign(s)}>
                    <Ionicons name="git-branch-outline" size={14} color="#fff" />
                    <Text style={styles.assignBtnText}>Assign</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.sub, { marginTop: 4, fontSize: 11 }]}>{s.email}</Text>
                <View style={styles.metrics}>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Net Revenue</Text>
                    <Text style={styles.metricValue}>₱ {net.toFixed(2)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <Text style={styles.metricLabel}>Gain/Loss %</Text>
                    <Text style={styles.metricValue}>{linked ? `${gain} / ${loss}` : "— / —"}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create staff · Step {createStep} of 4</Text>
              <TouchableOpacity
                onPress={() => {
                  setCreateOpen(false);
                  resetCreate();
                }}
              >
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            {createError ? (
              <View style={styles.createErrorBanner}>
                <Text style={styles.createErrorTitle}>Could not save</Text>
                <Text style={styles.createErrorBody}>{createError}</Text>
              </View>
            ) : null}

            {createStep === 1 && (
              <>
                <Text style={styles.stepHint}>Personal information</Text>
                <TextInput style={styles.input} placeholder="First name" value={cFirst} onChangeText={setCFirst} />
                <TextInput style={styles.input} placeholder="Middle initial (optional)" value={cMiddle} onChangeText={setCMiddle} />
                <TextInput style={styles.input} placeholder="Last name" value={cLast} onChangeText={setCLast} />
              </>
            )}

            {createStep === 2 && (
              <>
                <Text style={styles.stepHint}>Login credentials</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={cEmail}
                  onChangeText={setCEmail}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password (min 6)"
                  secureTextEntry
                  value={cPassword}
                  onChangeText={setCPassword}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  secureTextEntry
                  value={cPassword2}
                  onChangeText={setCPassword2}
                />
                <Text style={styles.sectionLabel}>Role</Text>
                <View style={styles.rolePickRow}>
                  <TouchableOpacity
                    style={[styles.rolePick, cRole === "clerk" && styles.rolePickOn]}
                    onPress={() => setCRole("clerk")}
                  >
                    <Text style={[styles.rolePickText, cRole === "clerk" && styles.rolePickTextOn]}>Clerk</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rolePick, cRole === "staff" && styles.rolePickOn]}
                    onPress={() => setCRole("staff")}
                  >
                    <Text style={[styles.rolePickText, cRole === "staff" && styles.rolePickTextOn]}>Staff</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {createStep === 3 && (
              <>
                <Text style={styles.stepHint}>Assign branch (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity
                    style={[styles.chip, cBranchId === null && styles.chipActive]}
                    onPress={() => setCBranchId(null)}
                  >
                    <Text style={[styles.chipText, cBranchId === null && styles.chipTextActive]}>Unassigned</Text>
                  </TouchableOpacity>
                  {branches.map((branch) => {
                    const active = cBranchId === branch.id;
                    return (
                      <TouchableOpacity
                        key={branch.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setCBranchId(branch.id)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{branch.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {createStep === 4 && (
              <View style={styles.summaryBox}>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryBold}>Name: </Text>
                  {cFirst.trim()} {cMiddle.trim() ? `${cMiddle.trim()}. ` : ""}
                  {cLast.trim()}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryBold}>Email: </Text>
                  {cEmail.trim()}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryBold}>Role: </Text>
                  {cRole}
                </Text>
                <Text style={styles.summaryLine}>
                  <Text style={styles.summaryBold}>Branch: </Text>
                  {cBranchId ? branches.find((b) => b.id === cBranchId)?.name || "—" : "Unassigned"}
                </Text>
              </View>
            )}

            <View style={styles.modalActions}>
              {createStep > 1 ? (
                <TouchableOpacity style={styles.secondaryBtn} onPress={goPrevStep}>
                  <Text style={styles.secondaryBtnText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => {
                    setCreateOpen(false);
                    resetCreate();
                  }}
                >
                  <Text style={styles.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
              {createStep < 4 ? (
                <TouchableOpacity style={styles.primaryBtn} onPress={goNextStep}>
                  <Text style={styles.primaryBtnText}>Next</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.primaryBtn} onPress={createStaffAccount} disabled={isSaving}>
                  <Text style={styles.primaryBtnText}>{isSaving ? "Saving..." : "Confirm"}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={assignStaffOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign branch (web login)</Text>
              <TouchableOpacity
                onPress={() => {
                  setAssignStaffOpen(false);
                  setAssignStaffUser(null);
                }}
              >
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>{assignStaffUser?.name}</Text>
            <Text style={[styles.sub, { marginBottom: 8 }]}>{assignStaffUser?.email}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.chip, assignStaffBranchId === null && styles.chipActive]}
                onPress={() => setAssignStaffBranchId(null)}
              >
                <Text style={[styles.chipText, assignStaffBranchId === null && styles.chipTextActive]}>Unassigned</Text>
              </TouchableOpacity>
              {branches.map((branch) => {
                const active = assignStaffBranchId === branch.id;
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setAssignStaffBranchId(branch.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{branch.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setAssignStaffOpen(false);
                  setAssignStaffUser(null);
                }}
              >
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={assignStaffBranch} disabled={isSaving}>
                <Text style={styles.primaryBtnText}>{isSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f1f5f9" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1000,
  },
  headerText: { fontSize: 24, fontWeight: "800", color: "#1e293b", letterSpacing: -0.5 },
  headerLeft: { position: "relative" },
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 56,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
  profileContainer: { zIndex: 2000 },
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
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownText: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  content: { padding: 16, paddingBottom: 48 },
  toolbar: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 14,
  },
  toolbarLabel: { fontSize: 11, fontWeight: "800", color: "#64748b", marginBottom: 6, textTransform: "uppercase" },
  segmentRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segmentChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  segmentChipActive: { backgroundColor: "#1e3a8a", borderColor: "#1e3a8a" },
  segmentChipText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  segmentChipTextActive: { color: "#fff" },
  toolbarActions: { marginTop: 10, flexDirection: "row", justifyContent: "flex-end", gap: 8 },
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
  sectionHeading: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 8 },
  sectionHint: { fontSize: 12, color: "#64748b", marginBottom: 10 },
  badge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  chartSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    marginBottom: 14,
  },
  chartSectionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  chartSectionSub: { fontSize: 11, color: "#64748b", marginTop: 4, marginBottom: 8 },
  barChart: { borderRadius: 12, marginVertical: 4 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  cardMain: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  presenceLabel: { fontWeight: "700" },
  presenceActive: { color: "#16a34a" },
  presenceInactive: { color: "#dc2626" },
  presenceDisabled: { color: "#94a3b8" },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexShrink: 0,
  },
  assignBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  metrics: { flexDirection: "row", marginTop: 12, gap: 10, alignItems: "stretch" },
  metric: {
    flex: 1,
    minWidth: 0,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
  metricLabel: { fontSize: 11, color: "#64748b", fontWeight: "700" },
  metricValue: { fontSize: 13, color: "#0f172a", fontWeight: "800", marginTop: 4 },
  empty: { textAlign: "center", color: "#64748b", fontWeight: "600", marginTop: 12, marginBottom: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  modalCloseText: { fontSize: 16, color: "#64748b", fontWeight: "700" },
  createErrorBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  createErrorTitle: { fontSize: 13, fontWeight: "800", color: "#b91c1c", marginBottom: 6 },
  createErrorBody: { fontSize: 13, color: "#7f1d1d", lineHeight: 20 },
  stepHint: { fontSize: 13, color: "#0f172a", fontWeight: "700", marginBottom: 8 },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  sectionLabel: { marginTop: 12, marginBottom: 8, color: "#334155", fontWeight: "700" },
  rolePickRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  rolePick: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  rolePickOn: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  rolePickText: { fontWeight: "700", color: "#64748b" },
  rolePickTextOn: { color: "#1d4ed8" },
  summaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 8,
  },
  summaryLine: { fontSize: 14, color: "#334155", marginBottom: 6 },
  summaryBold: { fontWeight: "800", color: "#0f172a" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
