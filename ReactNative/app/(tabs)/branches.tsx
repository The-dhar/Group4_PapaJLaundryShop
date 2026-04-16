import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from "@/contexts/AuthContext";
import Ionicons from 'react-native-vector-icons/Ionicons';

import { API_URL } from "../../config/api";

type Branch = {
  id: number;
  name: string;
  clerk_username?: string | null;
  is_active?: boolean;
  created_at?: string;
};

const BranchAccountManager = () => {
  const router = useRouter();
  const { token, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoadingBranches, setIsLoadingBranches] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const ITEMS_PER_PAGE = 5;

  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
  };

  const loadBranches = useCallback(async () => {
    try {
      if (!token) {
        setIsLoadingBranches(false);
        return;
      }

      setIsLoadingBranches(true);
      const response = await fetch(`${API_URL}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setBranches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadBranches();
    }, [loadBranches])
  );

  const branchesSorted = useMemo(() => {
    return [...branches].sort((a, b) => {
      const nameA = String(a.name || '').trim();
      const nameB = String(b.name || '').trim();
      const compare = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      return sortOrder === 'asc' ? compare : -compare;
    });
  }, [branches, sortOrder]);

  const paginatedBranches = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return branchesSorted.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [branchesSorted, currentPage]);

  const totalPages = Math.ceil(branchesSorted.length / ITEMS_PER_PAGE);

  const handleConfirm = async () => {
    const name = branchName.trim();
    if (!name) {
      Alert.alert("Error", "Branch name is required.");
      return;
    }

    try {
      setIsSaving(true);
      if (!token) {
        Alert.alert("Error", "Not signed in.");
        return;
      }

      const isEditing = editingBranch !== null;
      const endpoint = isEditing
        ? `${API_URL}/branches/${editingBranch.id}`
        : `${API_URL}/branches`;
      const response = await fetch(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        body: JSON.stringify({ name })
      });

      if (!response.ok) {
        let msg = isEditing
          ? `Could not update branch (${response.status}).`
          : `Could not create branch (${response.status}).`;
        try {
          const err = await response.json();
          if (err?.message) msg = typeof err.message === "string" ? err.message : msg;
        } catch { /* ignore */ }
        Alert.alert("Error", msg);
        return;
      }

      const savedBranch: Branch = await response.json();
      if (isEditing) {
        setBranches((prev) =>
          prev.map((b) => (b.id === editingBranch.id ? { ...b, ...savedBranch, name } : b))
        );
      } else {
        setBranches((prev) => [...prev, savedBranch]);
      }
      setIsModalOpen(false);
      setEditingBranch(null);
      setBranchName('');
      Alert.alert("Success", isEditing ? "Branch updated successfully." : "Branch created successfully.");
    } catch (error) {
      console.log(error);
      Alert.alert("Error", editingBranch ? "Failed to update branch." : "Failed to create branch.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setIsModalOpen(false);
    setEditingBranch(null);
    setBranchName('');
  };

  const handleEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchName(branch.name || '');
    setIsModalOpen(true);
  };

  const handleViewBranch = (branch: Branch) => {
    router.push({
      pathname: '/dashboardbyaccount',
      params: {
        branchId: branch.id.toString(),
        branchName: branch.name,
        createdAt: branch.created_at ?? '',
      },
    });
  };

  const toggleEditingBranchStatus = async () => {
    if (!editingBranch || !token) return;

    const isActive = editingBranch.is_active !== false;
    const endpoint = isActive
      ? `${API_URL}/branches/${editingBranch.id}/deactivate`
      : `${API_URL}/branches/${editingBranch.id}/activate`;

    try {
      setIsUpdatingStatus(true);
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        Alert.alert('Error', `Could not ${isActive ? 'deactivate' : 'reactivate'} branch.`);
        return;
      }

      const payload = await response.json().catch(() => ({}));
      const updatedBranch: Branch = {
        ...editingBranch,
        ...(payload?.branch || {}),
        is_active: payload?.branch?.is_active ?? !isActive,
      };

      setBranches((prev) =>
        prev.map((b) =>
          b.id === editingBranch.id
            ? updatedBranch
            : b
        )
      );
      setEditingBranch(updatedBranch);
      Alert.alert('Success', `Branch ${isActive ? 'deactivated' : 'reactivated'} successfully.`);
    } catch (error) {
      console.log(error);
      Alert.alert('Error', `Failed to ${isActive ? 'deactivate' : 'reactivate'} branch.`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>

        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Branches</Text>
          <View style={styles.headerAccent} />
        </View>

        <View style={styles.profileContainer}>

          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => setOpen(!open)}
          >
            <Ionicons name="person-circle-outline" size={30} color="#1e293b" />
          </TouchableOpacity>

          {open && (

            <View style={styles.dropdown}>

              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={handleProfile}
              >
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.listContainer}>

          <View style={styles.listHeader}>

            <View style={styles.listHeaderLeft}>
              <View style={styles.iconWrapper}>
                <Ionicons name="location" size={22} color="#3b82f6" />
              </View>
              <Text style={styles.listHeaderText}>Branch name</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsModalOpen(true)}
              style={styles.createButton}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>

          </View>

          <View style={styles.filterBar}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <Ionicons
                name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'}
                size={16}
                color="#3b82f6"
              />
              <Text style={styles.sortButtonText}>
                {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tableContent}>

            {isLoadingBranches && branchesSorted.length === 0 ? (
              <View style={styles.loadingState}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
            ) : (

              paginatedBranches.map((branch, index) => (

                <View key={branch.id} style={styles.branchRowWrapper}>

                  <TouchableOpacity
                    style={styles.branchRow}
                    activeOpacity={0.92}
                    onPress={() => handleViewBranch(branch)}
                  >

                    <View style={styles.branchLeft}>

                      <View style={styles.branchIconContainer}>
                        <Ionicons name="business" size={20} color="#3b82f6" />
                      </View>

                      <View style={styles.branchInfo}>
                        <View style={styles.branchTopRow}>
                          <Text style={styles.branchName} numberOfLines={1}>{branch.name}</Text>
                          <View style={styles.inlineActions}>
                            <TouchableOpacity
                              onPress={(event) => {
                                event.stopPropagation();
                                handleEditBranch(branch);
                              }}
                              style={styles.editButtonInline}
                            >
                              <Ionicons name="create-outline" size={14} color="#fff" />
                              <Text style={styles.editButtonInlineText}>Edit</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <Text style={styles.branchUsername} numberOfLines={1}>
                          {branch.is_active === false ? 'Inactive · ' : ''}
                          Clerk label: {branch.clerk_username?.trim() ? `@${branch.clerk_username}` : '—'}
                        </Text>
                      </View>

                    </View>
                  </TouchableOpacity>

                  {index < paginatedBranches.length - 1 && (
                    <View style={styles.rowDivider} />
                  )}

                </View>

              ))
            )}

          </View>

          {totalPages > 1 && (
            <View style={styles.paginationContainer}>
              <TouchableOpacity
                disabled={currentPage === 1}
                onPress={() => setCurrentPage((page) => Math.max(1, page - 1))}
                style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
              >
                <Text style={styles.paginationButtonText}>← Previous</Text>
              </TouchableOpacity>
              <Text style={styles.paginationText}>Page {currentPage} of {totalPages}</Text>
              <TouchableOpacity
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
              >
                <Text style={styles.paginationButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>

      </ScrollView>

      <Modal visible={isModalOpen} transparent animationType="fade">

        <View style={styles.modalOverlay}>

          <View style={styles.modalBox}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                {editingBranch ? 'Edit branch' : 'Create branch'}
              </Text>

              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>

            </View>

            <Text style={styles.modalHint}>
              Branches are locations only. Employee logins are created under the Employees tab.
            </Text>

            <View style={styles.inputContainer}>

              <Text style={styles.inputLabel}>Branch name</Text>

              <TextInput
                placeholder="e.g. Santa Catalina"
                placeholderTextColor="#9ca3af"
                value={branchName}
                onChangeText={setBranchName}
                style={styles.input}
              />

            </View>

            {editingBranch && (
              <View style={styles.statusToggleContainer}>
                <TouchableOpacity
                  onPress={toggleEditingBranchStatus}
                  style={[
                    styles.statusToggleButton,
                    editingBranch.is_active === false
                      ? styles.activateConfirmButton
                      : styles.deactivateConfirmButton,
                  ]}
                  disabled={isUpdatingStatus}
                >
                  {isUpdatingStatus ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.statusConfirmButtonText}>
                      {editingBranch.is_active === false ? 'Reactivate branch' : 'Deactivate branch'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.modalButtons}>

              <TouchableOpacity
                onPress={handleClear}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                style={styles.confirmButton}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>
                    {editingBranch ? 'Save changes' : 'Confirm'}
                  </Text>
                )}
              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
};

export default BranchAccountManager;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContent: {
    position: 'relative',
  },
  headerTitle: {
    fontSize: 28,
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
  content: {
    flex: 1,
    padding: 20,
  },
  listContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
  },
  listHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  listHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    alignItems: 'center',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  tableContent: {
    paddingVertical: 8,
  },
  loadingState: {
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  branchRowWrapper: {
    marginHorizontal: 4,
  },
  branchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginVertical: 6,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  branchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  branchIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  branchInfo: {
    flex: 1,
  },
  branchTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  branchName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  editButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  editButtonInlineText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  branchUsername: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  paginationButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
    minWidth: 104,
    alignItems: 'center',
  },
  paginationButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  paginationButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  paginationText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  modalHint: {
    paddingHorizontal: 24,
    paddingTop: 12,
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: 20,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
    color: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    padding: 24,
    paddingTop: 8,
  },
  statusToggleContainer: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  statusToggleButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clearButtonText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  deactivateConfirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#f97316',
    alignItems: 'center',
  },
  activateConfirmButton: {
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  statusConfirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1e293b",
    letterSpacing: -0.5,
  },
  headerLeft: {
    flexDirection: "column",
    position: "relative",
  },
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
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
  profileContainer: {
    position: "relative",
    zIndex: 2000,
  },
  profileBtn: {
    padding: 6,
  }
});
