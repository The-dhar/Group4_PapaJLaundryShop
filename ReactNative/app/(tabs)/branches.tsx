import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from "../config/api";

/* -----------------------------
   Branch Type
------------------------------*/

type Branch = {
  id: number;
  name: string;
  email: string;
  created_at?: string;
};

const BranchAccountManager = () => {

  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [branches, setBranches] = useState<Branch[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    branchName: '',
    email: '',
    password: '',
  });

  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  const handleLogout = async () => {
    setOpen(false);
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  /* -----------------------------
     Load Branches
  ------------------------------*/

  const loadBranches = async () => {

    try {

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_URL}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      const data: Branch[] = await response.json();

      setBranches(data);

    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  /* -----------------------------
     Create Branch
  ------------------------------*/

  const handleConfirm = async () => {

    if (!formData.branchName || !formData.email || !formData.password) {
      Alert.alert("Error", "All fields are required");
      return;
    }

    try {

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_URL}/branches`, {

        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },

        body: JSON.stringify({
          branchName: formData.branchName,
          email: formData.email,
          password: formData.password
        })

      });

      const newBranch: Branch = await response.json();

      setBranches([...branches, newBranch]);

      setIsModalOpen(false);

      setFormData({
        branchName: '',
        email: '',
        password: ''
      });

    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to create branch");
    }
  };

  const handleDelete = () => {
    setIsModalOpen(false);
    setFormData({ branchName: '', email: '', password: '' });
  };

  const handleViewBranch = (branch: Branch) => {

    router.push({
      pathname: '/dashboardbyaccount',
      params: {
        branchId: branch.id.toString(),
        branchName: branch.name,
        username: branch.email,
        createdAt: branch.created_at,
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>

        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Branch Accounts</Text>
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
              <Text style={styles.listHeaderText}>Branch Name</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsModalOpen(true)}
              style={styles.createButton}
            >
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.createButtonText}>Create</Text>
            </TouchableOpacity>

          </View>

          <View style={styles.tableContent}>

            {branches.map((branch, index) => (

              <View key={branch.id} style={styles.branchRowWrapper}>

                <View style={styles.branchRow}>

                  <View style={styles.branchLeft}>

                    <View style={styles.branchIconContainer}>
                      <Ionicons name="business" size={20} color="#3b82f6" />
                    </View>

                    <View style={styles.branchInfo}>
                      <Text style={styles.branchName}>{branch.name}</Text>
                      <Text style={styles.branchUsername}>@{branch.email}</Text>
                    </View>

                  </View>

                  <TouchableOpacity
                    onPress={() => handleViewBranch(branch)}
                    style={styles.viewButton}
                  >
                    <Ionicons name="eye" size={16} color="#fff" />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>

                </View>

                {index < branches.length - 1 && (
                  <View style={styles.rowDivider} />
                )}

              </View>

            ))}

          </View>

        </View>

      </ScrollView>

      {/* CREATE BRANCH MODAL */}

      <Modal visible={isModalOpen} transparent animationType="fade">

        <View style={styles.modalOverlay}>

          <View style={styles.modalBox}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>Create Account</Text>

              <TouchableOpacity
                onPress={() => setIsModalOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>

            </View>

            <View style={styles.inputContainer}>

              <Text style={styles.inputLabel}>Branch Name</Text>

              <TextInput
                placeholder="Enter branch name"
                placeholderTextColor="#9ca3af"
                value={formData.branchName}
                onChangeText={(t) =>
                  setFormData({ ...formData, branchName: t })
                }
                style={styles.input}
              />

            </View>

            <View style={styles.inputContainer}>

              <Text style={styles.inputLabel}>Username</Text>

              <TextInput
                placeholder="Enter username (branch@gmail.com)"
                placeholderTextColor="#9ca3af"
                value={formData.email}
                onChangeText={(t) =>
                  setFormData({ ...formData, email: t })
                }
                style={styles.input}
              />

            </View>

            <View style={styles.inputContainer}>

              <Text style={styles.inputLabel}>Password</Text>

              <TextInput
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={formData.password}
                onChangeText={(t) =>
                  setFormData({ ...formData, password: t })
                }
                style={styles.input}
              />

            </View>

            <View style={styles.modalButtons}>

              <TouchableOpacity
                onPress={handleDelete}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                style={styles.confirmButton}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>

            </View>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
};

export default BranchAccountManager;

/* YOUR STYLES REMAIN EXACTLY THE SAME BELOW */

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
  tableContent: {
    paddingVertical: 8,
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
  branchName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  branchUsername: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3b82f6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  viewButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
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
    zIndex: 1000, // Added high z-index to header
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
    elevation: 999, // Very high elevation for dropdown
    minWidth: 120,
    zIndex: 9999, // Extremely high z-index
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownItemLast: {
    borderBottomWidth: 0, // Remove border from last item
  },
  dropdownText: {
    fontSize: 14,
    color: "#1e293b",
    fontWeight: "600",
  },
profileContainer: {
    position: "relative",
    zIndex: 2000, // Higher z-index for profile container
  },
  profileBtn: {
    padding: 6,
  }
});
