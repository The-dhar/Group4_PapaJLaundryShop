import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { API_URL } from "../../config/api";

type Branch = {
  id: number;
  name: string;
  email: string;
  clerk_username?: string | null;
};

type EmployeeHistory = {
  id: number;
  branch_name: string | null;
  role: string | null;
  period_label: string | null;
  revenue_outcome?: string | null;
};

type Employee = {
  id: number;
  name: string;
  username: string;
  role: string;
  status: string;
  revenue_outcome: string | null;
  gain_percent: number;
  loss_percent: number;
  net_revenue_php: number;
  clerk_since: string | null;
  branch_id: number | null;
  branch_name: string | null;
  branch_email: string | null;
  history: EmployeeHistory[];
};

const getOutcomeColor = (outcome: string | null) => {
  const normalized = String(outcome || "").toLowerCase();
  if (normalized === "gain") return "#16a34a";
  if (normalized === "loss") return "#d97706";
  if (normalized === "bad") return "#dc2626";
  return "#64748b";
};

export default function EmployeesScreen() {
  const router = useRouter();
  const { token, logout } = useAuth();

  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createUsername, setCreateUsername] = useState("");
  const [createRole, setCreateRole] = useState("Clerk");
  const [createStatus, setCreateStatus] = useState("Active");
  const [createBranchId, setCreateBranchId] = useState<number | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmployee, setAssignEmployee] = useState<Employee | null>(null);
  const [assignBranchId, setAssignBranchId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [employeesRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/employees`, { headers }),
        fetch(`${API_URL}/branches`, { headers }),
      ]);

      const employeesData = employeesRes.ok ? await employeesRes.json() : [];
      const branchesData = branchesRes.ok ? await branchesRes.json() : [];

      setEmployees(Array.isArray(employeesData) ? employeesData : []);
      setBranches(Array.isArray(branchesData) ? branchesData : []);
    } catch (error) {
      console.log(error);
      Alert.alert(
        "Load failed",
        "Unable to load employees. Please ensure backend migrations are deployed."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const filteredEmployees = useMemo(() => {
    if (!selectedBranchName) return employees;
    return employees.filter((employee) => employee.branch_name === selectedBranchName);
  }, [employees, selectedBranchName]);

  /**
   * Previous clerks graph: convert absolute net revenue (PHP) into % of team total
   * so bars compare relative contribution instead of raw peso scale.
   */
  const clerkSharePercentChart = useMemo(() => {
    const list = filteredEmployees;
    if (list.length === 0) {
      return { labels: [""], data: [0] };
    }
    const amounts = list.map((e) => Math.max(0, Number(e.net_revenue_php || 0)));
    const sum = amounts.reduce((a, b) => a + b, 0);
    const data =
      sum > 0
        ? amounts.map((a) => Number(((a / sum) * 100).toFixed(1)))
        : amounts.map(() => 0);
    const labels = list.map((e) => {
      const n = (e.name || e.username || "?").trim();
      return n.length > 9 ? `${n.slice(0, 8)}…` : n;
    });
    return { labels, data };
  }, [filteredEmployees]);

  const chartWindowW = Dimensions.get("window").width;
  const clerkChartWidth = Math.max(chartWindowW - 48, clerkSharePercentChart.labels.length * 56);

  const resetCreate = () => {
    setCreateName("");
    setCreateUsername("");
    setCreateRole("Clerk");
    setCreateStatus("Active");
    setCreateBranchId(null);
  };

  const createEmployee = async () => {
    const name = createName.trim();
    const username = createUsername.trim().toLowerCase();

    if (!name || !username) {
      Alert.alert("Required", "Name and username are required.");
      return;
    }

    try {
      setIsSaving(true);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const response = await fetch(`${API_URL}/employees`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          username,
          role: createRole,
          status: createStatus,
          branch_id: createBranchId,
          revenue_outcome: "gain",
          gain_percent: 50,
          loss_percent: 50,
          net_revenue_php: 0,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        Alert.alert("Create failed", err?.message || "Unable to create employee.");
        return;
      }

      setCreateOpen(false);
      resetCreate();
      await loadData();
      Alert.alert("Created", "Employee account saved.");
    } catch (error) {
      console.log(error);
      Alert.alert("Create failed", "Unable to create employee.");
    } finally {
      setIsSaving(false);
    }
  };

  const openAssign = (employee: Employee) => {
    setAssignEmployee(employee);
    setAssignBranchId(employee.branch_id ?? null);
    setAssignOpen(true);
  };

  const assignBranch = async () => {
    if (!assignEmployee) return;

    try {
      setIsSaving(true);
      if (!token) throw new Error("Not authenticated");
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const response = await fetch(
        `${API_URL}/employees/${assignEmployee.id}/assign-branch`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            branch_id: assignBranchId,
            period_label: "Reassigned from mobile",
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        Alert.alert("Assign failed", err?.message || "Unable to assign branch.");
        return;
      }

      setAssignOpen(false);
      setAssignEmployee(null);
      setAssignBranchId(null);
      await loadData();
      Alert.alert("Updated", "Branch assignment saved.");
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
              <TouchableOpacity
                style={[styles.dropdownItem, styles.dropdownItemLast]}
                onPress={handleLogout}
              >
                <Text style={styles.dropdownText}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.chip, !selectedBranchName && styles.chipActive]}
              onPress={() => setSelectedBranchName(null)}
            >
              <Text style={[styles.chipText, !selectedBranchName && styles.chipTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            {branches.map((branch) => {
              const active = selectedBranchName === branch.name;
              return (
                <TouchableOpacity
                  key={branch.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedBranchName(active ? null : branch.name)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {branch.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.toolbarActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadData}>
              <Ionicons name="refresh-outline" size={14} color="#1e293b" />
              <Text style={styles.secondaryBtnText}>{isLoading ? "Loading..." : "Refresh"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setCreateOpen(true)}>
              <Ionicons name="add-outline" size={14} color="#fff" />
              <Text style={styles.primaryBtnText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>

        {filteredEmployees.length > 0 ? (
          <View style={styles.chartSection}>
            <Text style={styles.chartSectionTitle}>Previous clerks — revenue share</Text>
            <Text style={styles.chartSectionSub}>
              Each bar is % of total net revenue for clerks in this list (not peso amounts).
            </Text>
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
                  formatYLabel: (y: string) => `${y}%`,
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
        ) : null}

        {filteredEmployees.map((employee) => (
          <View key={employee.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardMain}>
                <Text style={styles.name}>{employee.name}</Text>
                <Text style={styles.sub}>@{employee.username}</Text>
                <Text style={styles.sub}>{employee.status}</Text>
                <Text style={styles.sub}>Branch: {employee.branch_name || "Unassigned"}</Text>
                <Text style={[styles.sub, { color: getOutcomeColor(employee.revenue_outcome) }]}>
                  Outcome: {employee.revenue_outcome || "n/a"}
                </Text>
              </View>

              <TouchableOpacity style={styles.assignBtn} onPress={() => openAssign(employee)}>
                <Ionicons name="git-branch-outline" size={14} color="#fff" />
                <Text style={styles.assignBtnText}>Assign</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Net Revenue</Text>
                <Text style={styles.metricValue}>P {Number(employee.net_revenue_php || 0).toFixed(2)}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricLabel}>Gain/Loss %</Text>
                <Text style={styles.metricValue}>
                  {employee.gain_percent || 0} / {employee.loss_percent || 0}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {!isLoading && filteredEmployees.length === 0 && (
          <Text style={styles.empty}>No employees found.</Text>
        )}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Employee</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Full name"
              value={createName}
              onChangeText={setCreateName}
            />
            <TextInput
              style={styles.input}
              placeholder="Username"
              autoCapitalize="none"
              value={createUsername}
              onChangeText={setCreateUsername}
            />
            <TextInput
              style={styles.input}
              placeholder="Role (e.g. Clerk)"
              value={createRole}
              onChangeText={setCreateRole}
            />
            <TextInput
              style={styles.input}
              placeholder="Status (e.g. Active)"
              value={createStatus}
              onChangeText={setCreateStatus}
            />

            <Text style={styles.sectionLabel}>Initial Branch</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.chip, createBranchId === null && styles.chipActive]}
                onPress={() => setCreateBranchId(null)}
              >
                <Text style={[styles.chipText, createBranchId === null && styles.chipTextActive]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              {branches.map((branch) => {
                const active = createBranchId === Number(branch.id);
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCreateBranchId(Number(branch.id))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {branch.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setCreateOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={createEmployee} disabled={isSaving}>
                <Text style={styles.primaryBtnText}>{isSaving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={assignOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Branch</Text>
              <TouchableOpacity onPress={() => setAssignOpen(false)}>
                <Text style={styles.modalCloseText}>X</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>{assignEmployee?.name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.chip, assignBranchId === null && styles.chipActive]}
                onPress={() => setAssignBranchId(null)}
              >
                <Text style={[styles.chipText, assignBranchId === null && styles.chipTextActive]}>
                  Unassigned
                </Text>
              </TouchableOpacity>
              {branches.map((branch) => {
                const active = assignBranchId === Number(branch.id);
                return (
                  <TouchableOpacity
                    key={branch.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setAssignBranchId(Number(branch.id))}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {branch.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setAssignOpen(false)}>
                <Text style={styles.secondaryBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryBtn} onPress={assignBranch} disabled={isSaving}>
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
  empty: { textAlign: "center", color: "#64748b", fontWeight: "600", marginTop: 20 },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 14 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryBtnText: { color: "#334155", fontSize: 12, fontWeight: "700" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});

