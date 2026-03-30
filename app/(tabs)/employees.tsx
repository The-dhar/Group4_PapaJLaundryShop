import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  ScrollView,
  TextInput,
  Switch,
  Dimensions,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { PieChart } from "react-native-chart-kit";

// --- 11 branches ---
const MOCK_BRANCHES = [
  "Brgy Sta Cruz",
  "Tumaga",
  "Brgy Santa Cruz 2",
  "Brgy Sunrise",
  "Lower Calarian",
  "Tetuan",
  "Pasonanca",
  "San Roque",
  "Baliwasan",
  "Guiwan",
  "Talon-Talon",
] as const;

type RevenueOutcome = "gain" | "loss" | "bad";

type Employee = {
  id: string;
  name: string;
  username: string;
  role: string;
  branch: string;
  status: string;
  revenueOutcome: RevenueOutcome;
  gainPercent: number;
  lossPercent: number;
  netRevenuePhp: number;
  clerkSinceLabel: string;
};

type HistoryEntry = {
  id: string;
  branch: string;
  name: string;
  role: string;
  period: string;
  revenueWhenThere: RevenueOutcome;
};

const INITIAL_EMPLOYEES: Employee[] = [
  {
    id: "1",
    name: "John Doe",
    username: "john.doe",
    role: "Clerk",
    branch: "Brgy Sta Cruz",
    status: "Active",
    revenueOutcome: "gain",
    gainPercent: 72,
    lossPercent: 28,
    netRevenuePhp: 148_200,
    clerkSinceLabel: "Jan 2025",
  },
  {
    id: "2",
    name: "Jane Smith",
    username: "jane.smith",
    role: "Manager",
    branch: "Tumaga",
    status: "Active",
    revenueOutcome: "gain",
    gainPercent: 65,
    lossPercent: 35,
    netRevenuePhp: 121_400,
    clerkSinceLabel: "Nov 2024",
  },
  {
    id: "3",
    name: "Elaine Foster",
    username: "elaine.foster",
    role: "Clerk",
    branch: "Brgy Santa Cruz 2",
    status: "Active",
    revenueOutcome: "loss",
    gainPercent: 42,
    lossPercent: 58,
    netRevenuePhp: -18_300,
    clerkSinceLabel: "Mar 2025",
  },
  {
    id: "4",
    name: "Camil santos",
    username: "camil.santos",
    role: "Clerk",
    branch: "Brgy Sunrise",
    status: "On Leave",
    revenueOutcome: "bad",
    gainPercent: 28,
    lossPercent: 72,
    netRevenuePhp: -52_100,
    clerkSinceLabel: "Jun 2024",
  },
  {
    id: "5",
    name: "Carlos Mendoza",
    username: "carlos.mendoza",
    role: "Delivery",
    branch: "Lower Calarian",
    status: "Active",
    revenueOutcome: "gain",
    gainPercent: 58,
    lossPercent: 42,
    netRevenuePhp: 64_800,
    clerkSinceLabel: "Feb 2025",
  },
  {
    id: "6",
    name: "Maria Garcia",
    username: "maria.garcia",
    role: "Clerk",
    branch: "Unassigned",
    status: "New",
    revenueOutcome: "gain",
    gainPercent: 55,
    lossPercent: 45,
    netRevenuePhp: 0,
    clerkSinceLabel: "New",
  },
  {
    id: "7",
    name: "Juan Dela Cruz",
    username: "juan.delacruz",
    role: "Cleaner",
    branch: "Brgy Sta Cruz",
    status: "Active",
    revenueOutcome: "loss",
    gainPercent: 45,
    lossPercent: 55,
    netRevenuePhp: -8_900,
    clerkSinceLabel: "Aug 2024",
  },
];

const INITIAL_HISTORY: HistoryEntry[] = [
  {
    id: "h1",
    branch: "Brgy Sta Cruz",
    name: "Alice Johnson",
    role: "Clerk",
    period: "Jan 2025 – Aug 2025",
    revenueWhenThere: "gain",
  },
  {
    id: "h2",
    branch: "Tumaga",
    name: "Mark Anthony",
    role: "Clerk",
    period: "Mar 2024 – Dec 2024",
    revenueWhenThere: "loss",
  },
  {
    id: "h3",
    branch: "Brgy Sta Cruz",
    name: "Samuel Lee",
    role: "Clerk",
    period: "Sep 2024 – Dec 2024",
    revenueWhenThere: "bad",
  },
  {
    id: "h4",
    branch: "Pasonanca",
    name: "Jessica Alba",
    role: "Clerk",
    period: "Jan 2024 – Feb 2025",
    revenueWhenThere: "gain",
  },
  {
    id: "h5",
    branch: "Brgy Santa Cruz 2",
    name: "Rico Navarro",
    role: "Clerk",
    period: "Jun 2023 – Feb 2025",
    revenueWhenThere: "gain",
  },
  {
    id: "h6",
    branch: "Brgy Sunrise",
    name: "Patricia Go",
    role: "Clerk",
    period: "Jan 2024 – May 2025",
    revenueWhenThere: "loss",
  },
  {
    id: "h7",
    branch: "Lower Calarian",
    name: "Dennis Cruz",
    role: "Clerk",
    period: "Aug 2023 – Jan 2025",
    revenueWhenThere: "bad",
  },
  {
    id: "h8",
    branch: "Tetuan",
    name: "Lorna Dizon",
    role: "Clerk",
    period: "2023 – 2025",
    revenueWhenThere: "gain",
  },
  {
    id: "h9",
    branch: "San Roque",
    name: "Benjamin Lim",
    role: "Clerk",
    period: "Apr 2024 – present (prev.)",
    revenueWhenThere: "gain",
  },
  {
    id: "h10",
    branch: "Baliwasan",
    name: "Cherry Ann",
    role: "Clerk",
    period: "Jan 2025 – Mar 2025",
    revenueWhenThere: "loss",
  },
  {
    id: "h11",
    branch: "Guiwan",
    name: "Omar Santos",
    role: "Clerk",
    period: "Nov 2024 – Feb 2025",
    revenueWhenThere: "bad",
  },
  {
    id: "h12",
    branch: "Talon-Talon",
    name: "Grace Poe",
    role: "Clerk",
    period: "May 2024 – Jan 2025",
    revenueWhenThere: "gain",
  },
];

function outcomeLabel(o: RevenueOutcome): string {
  if (o === "gain") return "Increasing revenue";
  if (o === "loss") return "Decreasing revenue";
  return "Below target";
}

function outcomeColors(o: RevenueOutcome): { bg: string; text: string; border: string } {
  if (o === "gain") return { bg: "#ecfdf5", text: "#047857", border: "#6ee7b7" };
  if (o === "loss") return { bg: "#fffbeb", text: "#b45309", border: "#fcd34d" };
  return { bg: "#fef2f2", text: "#b91c1c", border: "#fca5a5" };
}

export default function EmployeesList() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeUsername, setNewEmployeeUsername] = useState("");
  const [newEmployeeBranch, setNewEmployeeBranch] = useState("");
  const [newEmployeeStatus, setNewEmployeeStatus] = useState(true);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [openProfileDropdown, setOpenProfileDropdown] = useState(false);

  const [isCreateBranchDropdownOpen, setIsCreateBranchDropdownOpen] = useState(false);
  const [profileEmployee, setProfileEmployee] = useState<Employee | null>(null);
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<HistoryEntry[]>(INITIAL_HISTORY);

  const [selectedBranchChip, setSelectedBranchChip] = useState<string | null>(null);

  const filteredEmployees = employees;

  const chartDataFor = (emp: Employee) => [
    {
      name: "Increasing revenue",
      population: emp.gainPercent,
      color: "#22C55E",
      legendFontColor: "#1e293b",
      legendFontSize: 11,
    },
    {
      name: "Decreasing revenue",
      population: emp.lossPercent,
      color: "#EF4444",
      legendFontColor: "#1e293b",
      legendFontSize: 11,
    },
  ];

  const branchDetail = useMemo(() => {
    if (!selectedBranchChip) return null;
    const current = employees.filter((e) => e.branch === selectedBranchChip);
    const previous = assignmentHistory
      .filter((h) => h.branch === selectedBranchChip)
      .sort((a, b) => a.name.localeCompare(b.name));
    return { current, previous };
  }, [selectedBranchChip, employees, assignmentHistory]);

  const resetCreateForm = () => {
    setNewEmployeeName("");
    setNewEmployeeUsername("");
    setNewEmployeeBranch("");
    setNewEmployeeStatus(true);
    setIsCreateBranchDropdownOpen(false);
  };

  const handleCreateEmployee = () => {
    const name = newEmployeeName.trim();
    const usernameRaw = newEmployeeUsername.trim();
    if (!name) return;
    if (!usernameRaw) {
      Alert.alert("Username required", "Please enter a username for this employee.");
      return;
    }
    const username = usernameRaw.toLowerCase().replace(/\s+/g, "_");
    if (employees.some((e) => e.username.toLowerCase() === username)) {
      Alert.alert("Username taken", "That username is already in use. Choose another.");
      return;
    }

    const newEmp: Employee = {
      id: Math.random().toString(),
      name,
      username,
      role: "Staff",
      branch: newEmployeeBranch || "Unassigned",
      status: newEmployeeStatus ? "Active" : "Inactive",
      revenueOutcome: "gain",
      gainPercent: 55 + Math.floor(Math.random() * 15),
      lossPercent: 0,
      netRevenuePhp: 0,
      clerkSinceLabel: "Just added",
    };
    newEmp.lossPercent = 100 - newEmp.gainPercent;

    setEmployees((prev) => [...prev, newEmp]);
    setIsCreateModalVisible(false);
    resetCreateForm();
  };

  const handleAssignBranch = (branchName: string) => {
    if (!selectedEmployee) return;

    const oldBranch = selectedEmployee.branch;
    if (
      oldBranch &&
      oldBranch !== "Unassigned" &&
      oldBranch !== branchName &&
      MOCK_BRANCHES.includes(oldBranch as (typeof MOCK_BRANCHES)[number])
    ) {
      const entry: HistoryEntry = {
        id: `h-${Date.now()}`,
        branch: oldBranch,
        name: selectedEmployee.name,
        role: selectedEmployee.role,
        period: `Ended ${new Date().toLocaleDateString("en-PH", { month: "short", year: "numeric" })}`,
        revenueWhenThere: selectedEmployee.revenueOutcome,
      };
      setAssignmentHistory((prev) => [entry, ...prev]);
    }

    setEmployees((prev) =>
      prev.map((emp) => (emp.id === selectedEmployee.id ? { ...emp, branch: branchName } : emp))
    );
    setIsAssignModalVisible(false);
    setSelectedEmployee(null);
  };

  const openAssignModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsAssignModalVisible(true);
  };

  const openProfileModal = (employee: Employee) => {
    setProfileEmployee(employee);
    setIsProfileModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Employees</Text>
          <View style={styles.headerAccent} />
        </View>

        <View style={styles.profileContainer}>
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setOpenProfileDropdown(!openProfileDropdown)}
          >
            <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
          </TouchableOpacity>

          {openProfileDropdown && (
            <View style={styles.dropdown}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => {
                  setOpenProfileDropdown(false);
                  router.push("/profile");
                }}
              >
                <Text style={styles.dropdownText}>Profile</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.branchesCard}>
          <View style={styles.branchesCardHeader}>
            <View style={styles.branchesTitleRow}>
              <Ionicons name="git-branch-outline" size={22} color="#2563eb" />
              <Text style={styles.branchesCardTitle}>Branches</Text>
            </View>
            <Text style={styles.branchesCardSubtitle}>
              Tap a branch to see who is assigned now and past clerks.
            </Text>
          </View>
          <View style={styles.branchScrollHintRow}>
            <Ionicons name="swap-horizontal" size={16} color="#64748b" />
            <Text style={styles.branchScrollHintText}>Swipe sideways — list scrolls to show all branches</Text>
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator
            persistentScrollbar
            bounces
            contentContainerStyle={styles.branchChipsScroll}
          >
            {MOCK_BRANCHES.map((b) => {
              const active = selectedBranchChip === b;
              return (
                <Pressable
                  key={b}
                  onPress={() => setSelectedBranchChip(active ? null : b)}
                  style={[styles.branchChip, active && styles.branchChipActive]}
                >
                  <Text style={[styles.branchChipText, active && styles.branchChipTextActive]} numberOfLines={1}>
                    {b}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {selectedBranchChip && branchDetail && (
            <View style={styles.branchDetailBox}>
              <Text style={styles.branchDetailTitle}>{selectedBranchChip}</Text>

              <Text style={styles.subheading}>Current assignment</Text>
              {branchDetail.current.length === 0 ? (
                <Text style={styles.muted}>No employee assigned to this branch yet.</Text>
              ) : (
                branchDetail.current.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.assigneeRow}
                    onPress={() => openProfileModal(e)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.assigneeAvatar}>
                      <Text style={styles.assigneeAvatarText}>{e.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.assigneeName}>{e.name}</Text>
                      <Text style={styles.assigneeUsername}>@{e.username}</Text>
                      <Text style={styles.assigneeMeta}>
                        {e.role} · {e.status}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                ))
              )}

              <Text style={[styles.subheading, { marginTop: 16 }]}>Previous clerks & staff</Text>
              {branchDetail.previous.length === 0 ? (
                <Text style={styles.muted}>No history recorded for this branch.</Text>
              ) : (
                branchDetail.previous.map((h, idx) => {
                  const oc = outcomeColors(h.revenueWhenThere);
                  return (
                    <View
                      key={h.id}
                      style={[styles.prevRow, idx > 0 && styles.prevRowBorder]}
                    >
                      <View style={styles.prevDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.prevName}>{h.name}</Text>
                        <Text style={styles.prevMeta}>
                          {h.role} · {h.period}
                        </Text>
                      </View>
                      <View style={[styles.outcomePill, { backgroundColor: oc.bg, borderColor: oc.border }]}>
                        <Text style={[styles.outcomePillText, { color: oc.text }]}>
                          {outcomeLabel(h.revenueWhenThere)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <View style={styles.listContainer}>
          <View style={styles.listHeaderRow}>
            <Text style={styles.listHeaderTitle}>All employees</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setIsCreateModalVisible(true)}>
              <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.createBtnText}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Name</Text>
            <Text style={styles.colRole}>Role</Text>
            <Text style={styles.colBranch}>Branch</Text>
            <Text style={styles.colStatus}>Status</Text>
            <Text style={styles.colAction}>Action</Text>
          </View>

          {filteredEmployees.map((item, index) => (
            <View
              key={item.id}
              style={[styles.tableRow, index < filteredEmployees.length - 1 && styles.rowDivider]}
            >
              <TouchableOpacity style={styles.colNameWrap} onPress={() => openProfileModal(item)} activeOpacity={0.7}>
                <Text style={styles.colNameText} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.colUsernameText} numberOfLines={1}>
                  @{item.username}
                </Text>
              </TouchableOpacity>
              <Text style={styles.colRoleText}>{item.role}</Text>
              <Text style={styles.colBranchText} numberOfLines={1}>
                {item.branch}
              </Text>

              <View style={styles.statusCol}>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "Active" ? "#22C55E20" : "#F59E0B20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: item.status === "Active" ? "#22C55E" : "#F59E0B" },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>

              <View style={styles.actionCol}>
                <TouchableOpacity style={styles.iconActionBtn} onPress={() => openProfileModal(item)}>
                  <Ionicons name="person" size={18} color="#3b82f6" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => openAssignModal(item)}>
                  <Ionicons name="business-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.actionBtnText}>Assign</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {filteredEmployees.length === 0 && (
            <Text style={styles.emptyText}>No employees found.</Text>
          )}
        </View>
      </ScrollView>

      {/* Create Employee Modal */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsCreateModalVisible(false);
          resetCreateForm();
        }}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalBox, styles.createModalBox]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create employee</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setIsCreateModalVisible(false);
                  resetCreateForm();
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.createModalScrollContent}
              nestedScrollEnabled
            >
              <Text style={[styles.label, styles.labelFirstInForm]}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="#94a3b8"
                value={newEmployeeName}
                onChangeText={setNewEmployeeName}
              />

              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. maria.reyes"
                placeholderTextColor="#94a3b8"
                value={newEmployeeUsername}
                onChangeText={setNewEmployeeUsername}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
              />

              <Text style={styles.label}>Branch (optional)</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => setIsCreateBranchDropdownOpen(!isCreateBranchDropdownOpen)}
              >
                <Text style={styles.dropdownSelectorText} numberOfLines={1}>
                  {newEmployeeBranch || "Select branch"}
                </Text>
                <Ionicons
                  name={isCreateBranchDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#64748b"
                />
              </TouchableOpacity>

              {isCreateBranchDropdownOpen && (
                <ScrollView
                  style={styles.dropdownPushContainer}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator
                >
                  <TouchableOpacity
                    style={styles.dropdownListItem}
                    onPress={() => {
                      setNewEmployeeBranch("");
                      setIsCreateBranchDropdownOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownListItemText}>None (Unassigned)</Text>
                  </TouchableOpacity>
                  {MOCK_BRANCHES.map((branch) => (
                    <TouchableOpacity
                      key={branch}
                      style={styles.dropdownListItem}
                      onPress={() => {
                        setNewEmployeeBranch(branch);
                        setIsCreateBranchDropdownOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownListItemText}>{branch}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.switchContainer}>
                <Text style={styles.label}>Active</Text>
                <Switch
                  value={newEmployeeStatus}
                  onValueChange={setNewEmployeeStatus}
                  trackColor={{ false: "#cbd5e1", true: "#3b82f6" }}
                  thumbColor="#ffffff"
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateEmployee}>
                <Text style={styles.submitBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={isProfileModalVisible} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={[styles.modalBox, styles.profileModalBox]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Employee profile</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => {
                  setIsProfileModalVisible(false);
                  setProfileEmployee(null);
                }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: Dimensions.get("window").height * 0.82 }}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {profileEmployee && (
                <>
                  <View style={styles.profileHero}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarText}>{profileEmployee.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.profileName}>{profileEmployee.name}</Text>
                      <Text style={styles.profileUsername}>@{profileEmployee.username}</Text>
                      <Text style={styles.profileRole}>
                        {profileEmployee.role} ·{" "}
                        <Text
                          style={{
                            color: profileEmployee.status === "Active" ? "#16a34a" : "#d97706",
                            fontWeight: "700",
                          }}
                        >
                          {profileEmployee.status}
                        </Text>
                      </Text>
                      <Text style={styles.profileSince}>Clerk / branch since: {profileEmployee.clerkSinceLabel}</Text>
                    </View>
                  </View>

                  {(() => {
                    const oc = outcomeColors(profileEmployee.revenueOutcome);
                    return (
                      <View style={[styles.outcomeBanner, { borderColor: oc.border, backgroundColor: oc.bg }]}>
                        <Ionicons
                          name={
                            profileEmployee.revenueOutcome === "gain"
                              ? "trending-up"
                              : profileEmployee.revenueOutcome === "loss"
                                ? "trending-down"
                                : "warning-outline"
                          }
                          size={22}
                          color={oc.text}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={[styles.outcomeBannerTitle, { color: oc.text }]}>
                            Revenue while assigned as clerk: {outcomeLabel(profileEmployee.revenueOutcome)}
                          </Text>
                          <Text style={styles.outcomeBannerSub}>
                            Based on branch sales vs. targets during their shifts (demo data).
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  <View style={styles.statGrid}>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Net (₱)</Text>
                      <Text
                        style={[
                          styles.statValue,
                          { color: profileEmployee.netRevenuePhp >= 0 ? "#047857" : "#b91c1c" },
                        ]}
                      >
                        {profileEmployee.netRevenuePhp >= 0 ? "+" : ""}
                        {profileEmployee.netRevenuePhp.toLocaleString("en-PH")}
                      </Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Increase %</Text>
                      <Text style={[styles.statValue, { color: "#16a34a" }]}>{profileEmployee.gainPercent}%</Text>
                    </View>
                    <View style={styles.statCell}>
                      <Text style={styles.statLabel}>Decrease %</Text>
                      <Text style={[styles.statValue, { color: "#dc2626" }]}>{profileEmployee.lossPercent}%</Text>
                    </View>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>Revenue mix (clerk period)</Text>
                    <Text style={styles.statsInfo}>Green vs red share of tracked revenue.</Text>
                    <View style={styles.chartWrap}>
                      <PieChart
                        data={chartDataFor(profileEmployee)}
                        width={Math.min(Dimensions.get("window").width - 80, 340)}
                        height={170}
                        chartConfig={{ color: (opacity = 1) => `rgba(30, 41, 59, ${opacity})` }}
                        accessor="population"
                        backgroundColor="transparent"
                        paddingLeft="0"
                        center={[0, 0]}
                        absolute
                      />
                    </View>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>Current branch</Text>
                    <View style={styles.assignRow}>
                      <View>
                        <Text style={styles.currentBranchLabel}>Assigned to</Text>
                        <Text style={styles.branchHighlight}>{profileEmployee.branch}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.reassignBtn}
                        onPress={() => {
                          setIsProfileModalVisible(false);
                          setTimeout(() => {
                            const latest = employees.find((e) => e.id === profileEmployee.id) ?? profileEmployee;
                            openAssignModal(latest);
                          }, 250);
                        }}
                      >
                        <Ionicons name="swap-horizontal" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.reassignBtnText}>Reassign</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.profileSection}>
                    <Text style={styles.sectionTitle}>
                      Previous clerks at {profileEmployee.branch === "Unassigned" ? "branch" : profileEmployee.branch}
                    </Text>
                    {profileEmployee.branch === "Unassigned" ? (
                      <Text style={styles.emptyHistoryText}>Assign this employee to a branch to see branch history.</Text>
                    ) : (
                      <View style={styles.historyList}>
                        {assignmentHistory.filter((h) => h.branch === profileEmployee.branch).length > 0 ? (
                          assignmentHistory
                            .filter((h) => h.branch === profileEmployee.branch)
                            .map((item, idx) => {
                              const oc = outcomeColors(item.revenueWhenThere);
                              return (
                                <View
                                  key={item.id}
                                  style={[styles.historyItem, idx !== 0 && styles.historyItemBorder]}
                                >
                                  <View style={styles.historyDot} />
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.historyName}>{item.name}</Text>
                                    <Text style={styles.historyPeriod}>
                                      {item.role} · {item.period}
                                    </Text>
                                  </View>
                                  <View style={[styles.outcomePillSmall, { backgroundColor: oc.bg }]}>
                                    <Text style={[styles.outcomePillText, { color: oc.text, fontSize: 11 }]}>
                                      {outcomeLabel(item.revenueWhenThere)}
                                    </Text>
                                  </View>
                                </View>
                              );
                            })
                        ) : (
                          <Text style={styles.emptyHistoryText}>No previous clerks recorded yet.</Text>
                        )}
                      </View>
                    )}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Assign Branch Modal */}
      <Modal visible={isAssignModalVisible} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign branch</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setIsAssignModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              <Text style={styles.modalSubtitle}>
                Choose branch for{" "}
                <Text style={{ fontWeight: "800" }}>{selectedEmployee?.name}</Text>
              </Text>

              <TouchableOpacity style={styles.branchOption} onPress={() => handleAssignBranch("Unassigned")}>
                <Text style={styles.branchOptionText}>Unassigned</Text>
              </TouchableOpacity>

              {MOCK_BRANCHES.map((branch) => (
                <TouchableOpacity
                  key={branch}
                  style={[
                    styles.branchOption,
                    selectedEmployee?.branch === branch && styles.branchOptionActive,
                  ]}
                  onPress={() => handleAssignBranch(branch)}
                >
                  <Text
                    style={[
                      styles.branchOptionText,
                      selectedEmployee?.branch === branch && styles.branchOptionTextActive,
                    ]}
                  >
                    {branch}
                  </Text>
                  {selectedEmployee?.branch === branch && (
                    <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f1f5f9" },
  scrollContent: { padding: 20, paddingBottom: 48 },
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
    zIndex: 9999,
  },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  dropdownText: { fontSize: 14, color: "#1e293b", fontWeight: "600" },

  branchesCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  branchesCardHeader: { marginBottom: 12 },
  branchesTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  branchesCardTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a" },
  branchesCardSubtitle: { fontSize: 13, color: "#64748b", marginTop: 6, lineHeight: 18 },
  branchScrollHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  branchScrollHintText: { flex: 1, fontSize: 12, color: "#475569", fontWeight: "600" },
  branchChipsScroll: {
    paddingVertical: 6,
    paddingBottom: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  branchChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginRight: 8,
    maxWidth: 200,
  },
  branchChipActive: {
    backgroundColor: "#1e3a8a",
    borderColor: "#1e3a8a",
  },
  branchChipText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  branchChipTextActive: { color: "#ffffff" },
  branchDetailBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  branchDetailTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  subheading: { fontSize: 12, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },
  muted: { fontSize: 13, color: "#94a3b8", fontStyle: "italic" },
  assigneeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  assigneeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  assigneeAvatarText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  assigneeName: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  assigneeUsername: { fontSize: 12, fontWeight: "600", color: "#3b82f6", marginTop: 2 },
  assigneeMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  prevRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  prevRowBorder: { borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  prevDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#cbd5e1", marginRight: 10 },
  prevName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  prevMeta: { fontSize: 12, color: "#64748b", marginTop: 2 },
  outcomePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  outcomePillSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  outcomePillText: { fontSize: 12, fontWeight: "800" },

  listContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 24,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  createBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: "#475569", marginBottom: 8, marginTop: 16 },
  labelFirstInForm: { marginTop: 0 },
  input: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  submitBtn: {
    backgroundColor: "#0f172a",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  submitBtnText: { color: "#ffffff", fontSize: 15, fontWeight: "700" },
  listHeaderTitle: { fontSize: 16, fontWeight: "800", color: "#1e293b" },

  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  colName: { width: "24%", fontWeight: "700", fontSize: 11, color: "#475569" },
  colRole: { width: "16%", fontWeight: "700", fontSize: 11, color: "#475569" },
  colBranch: { width: "22%", fontWeight: "700", fontSize: 11, color: "#475569" },
  colStatus: { width: "16%", fontWeight: "700", fontSize: 11, color: "#475569" },
  colAction: { width: "22%", fontWeight: "700", fontSize: 11, color: "#475569", textAlign: "right" },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  colNameWrap: { width: "24%" },
  colNameText: { fontSize: 13, color: "#1e293b", fontWeight: "700" },
  colUsernameText: { fontSize: 10, color: "#64748b", fontWeight: "600", marginTop: 2 },
  colRoleText: { width: "16%", fontSize: 12, color: "#64748b", fontWeight: "500" },
  colBranchText: { width: "22%", fontSize: 12, color: "#2563eb", fontWeight: "600" },
  statusCol: { width: "16%", alignItems: "flex-start", justifyContent: "center" },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "700" },

  actionCol: { width: "22%", flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  iconActionBtn: { padding: 6, backgroundColor: "#eff6ff", borderRadius: 8, marginRight: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1e293b",
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  actionBtnText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },

  dropdownSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#f8fafc",
  },
  dropdownSelectorText: { fontSize: 15, color: "#1e293b" },
  dropdownPushContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 240,
  },
  dropdownListItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  dropdownListItemText: { fontSize: 14, color: "#1e293b", fontWeight: "500" },

  statsInfo: { textAlign: "center", color: "#64748b", marginTop: 6, fontSize: 12 },
  emptyText: { padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 14, fontStyle: "italic" },

  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalBox: { width: "100%", maxWidth: 400, backgroundColor: "#ffffff", borderRadius: 22, overflow: "hidden" },
  createModalBox: { maxHeight: Dimensions.get("window").height * 0.88 },
  profileModalBox: { maxWidth: 440 },
  createModalScrollContent: { padding: 20, paddingBottom: 28 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTitle: { fontWeight: "800", fontSize: 17, color: "#1e293b" },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCloseText: { fontSize: 16, color: "#64748b", fontWeight: "700" },
  modalContent: { padding: 20, paddingBottom: 28 },
  modalSubtitle: { fontSize: 14, color: "#475569", marginBottom: 14 },
  branchOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 8,
    backgroundColor: "#fff",
  },
  branchOptionActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  branchOptionText: { fontSize: 14, color: "#1e293b", fontWeight: "600" },
  branchOptionTextActive: { color: "#1d4ed8", fontWeight: "800" },

  profileHero: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  profileAvatarText: { fontSize: 28, color: "#ffffff", fontWeight: "800" },
  profileName: { fontSize: 21, fontWeight: "800", color: "#1e293b" },
  profileUsername: { fontSize: 14, fontWeight: "700", color: "#2563eb", marginTop: 4 },
  profileRole: { fontSize: 14, color: "#64748b", fontWeight: "500", marginTop: 6 },
  profileSince: { fontSize: 12, color: "#94a3b8", marginTop: 6 },

  outcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  outcomeBannerTitle: { fontSize: 14, fontWeight: "800" },
  outcomeBannerSub: { fontSize: 11, color: "#64748b", marginTop: 4, lineHeight: 16 },

  statGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCell: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statLabel: { fontSize: 11, fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginTop: 6 },

  profileSection: {
    marginBottom: 16,
    padding: 14,
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  assignRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  currentBranchLabel: { fontSize: 13, color: "#64748b", marginBottom: 4 },
  branchHighlight: { fontWeight: "800", color: "#1d4ed8", fontSize: 16 },
  reassignBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  reassignBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  chartWrap: { alignItems: "center", marginTop: 8 },
  historyList: { marginTop: 4 },
  historyItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  historyItemBorder: { borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  historyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#cbd5e1", marginRight: 10 },
  historyName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  historyPeriod: { fontSize: 12, color: "#64748b", marginTop: 2 },
  emptyHistoryText: { fontSize: 13, color: "#94a3b8", fontStyle: "italic", paddingVertical: 10, textAlign: "center" },
});
