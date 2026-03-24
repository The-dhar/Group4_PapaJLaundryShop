import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import {
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { API_URL } from "../../config/api";

const ROWS_PER_PAGE = 5;


type Branch = {
  id: number;
  name: string;
  email: string;
  clerk_username?: string;
};

const BranchList = () => {

  const router = useRouter();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [page, setPage] = useState(1);

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const [username, setUsername] = useState('');
  const [clerkUsername, setClerkUsername] = useState('');
  const [password, setPassword] = useState('');

  const [open, setOpen] = useState(false);

  // LOAD BRANCHES FROM BACKEND
  const loadBranches = async () => {

    try {

      const token = await AsyncStorage.getItem("token");

      const response = await fetch(`${API_URL}/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      const data = await response.json();

      setBranches(data);

    } catch (error) {
      console.log(error);
    }

  };

  useEffect(() => {
    loadBranches();
  }, []);

  const totalPages = Math.ceil(branches.length / ROWS_PER_PAGE);
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = branches.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const handleEdit = (branch: Branch) => {

    setSelectedBranch(branch);
    setUsername(branch.email);
    setClerkUsername(branch.clerk_username ?? '');
    setModalVisible(true);

  };

  const handleDelete = () => {
    setModalVisible(false);
    setUsername('');
    setPassword('');
    setSelectedBranch(null);
  };

  // UPDATE BRANCH
  const handleConfirm = async () => {

    try {

      const token = await AsyncStorage.getItem("token");

      await fetch(`${API_URL}/branches/${selectedBranch?.id}`, {

        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },

        body: JSON.stringify({
          username: username,
          clerk_username: clerkUsername,
          password: password
        })

      });

      await loadBranches();

      setModalVisible(false);
      setSelectedBranch(null);

    } catch (error) {
      console.log(error);
    }

  };

  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };

  const handleLogout = async () => {
    setOpen(false);
    await AsyncStorage.removeItem("token");
    router.push("/login");
  };

  return (

    <SafeAreaView style={styles.safeArea}>

      <View style={styles.header}>

        <View style={styles.headerLeft}>
          <Text style={styles.headerText}>Account Settings</Text>
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

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >

        <View style={styles.card}>

          <View style={styles.cardHeader}>
            <Text style={styles.cardHeaderTitle}>Branch Name</Text>
            <Text style={styles.headerEdit}>Edit</Text>
          </View>

          <View style={styles.listContainer}>

            {pageData.map((branch, index) => (

              <View
                key={branch.id}
                style={[
                  styles.branchItem,
                  index < pageData.length - 1 && styles.branchItemBorder,
                ]}
              >

                <View style={styles.branchLeft}>

                  <View style={styles.branchIconContainer}>
                    <Ionicons name="location" size={20} color="#3b82f6" />
                  </View>

                  <View>
                    <Text style={styles.branchName}>{branch.name}</Text>

                    <Text style={{color:"#64748b"}}>
                      Clerk: {branch.clerk_username ?? "Not assigned"}
                    </Text>

                  </View>

                </View>

                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(branch)}
                >
                  <Ionicons name="create-outline" size={22} color="#3b82f6" />
                </TouchableOpacity>

              </View>

            ))}

          </View>

          <View style={styles.pagination}>

          <TouchableOpacity
            style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
            disabled={page === 1}
            onPress={() => setPage(page - 1)}
          >
            <Text style={[styles.pageText, page === 1 && styles.disabledText]}>
              Prev
            </Text>
          </TouchableOpacity>

          <View style={styles.pageNumberContainer}>
            <Text style={styles.pageNumber}>
              {page} / {totalPages}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.pageBtn, page === totalPages && styles.disabledBtn]}
            disabled={page === totalPages}
            onPress={() => setPage(page + 1)}
          >
            <Text style={[styles.pageText, page === totalPages && styles.disabledText]}>
              Next
            </Text>
          </TouchableOpacity>

        </View>

        </View>

      </ScrollView>

      {/* MODAL */}

      <Modal visible={modalVisible} transparent animationType="fade">

        <View style={styles.modalOverlay}>

          <View style={styles.modalBox}>

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Branch</Text>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>

            </View>

            <View style={styles.modalContent}>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Username</Text>

                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                />

              </View>

              <View style={styles.inputContainer}>

                <Text style={styles.inputLabel}>Clerk Username</Text>

                <TextInput
                  style={styles.input}
                  value={clerkUsername}
                  onChangeText={setClerkUsername}
                  placeholder="Assign clerk username"
                />

              </View>

              <View style={styles.inputContainer}>

                <Text style={styles.inputLabel}>Password</Text>

                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />

              </View>

              <View style={styles.modalButtons}>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                >
                  <Text style={styles.confirmButtonText}>Confirm</Text>
                </TouchableOpacity>

              </View>

            </View>

          </View>

        </View>

      </Modal>

    </SafeAreaView>

  );

};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
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
  headerEdit: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
  },
  cardHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: -0.3,
  },
  listContainer: {
    paddingVertical: 8,
  },
  branchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
    marginVertical: 4,
    marginHorizontal: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  branchItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  branchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 16,
  },
  branchIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  branchName: {
    fontSize: 17,
    color: '#1e293b',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  editButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
    borderTopWidth: 2,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pageBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  disabledBtn: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  pageText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  disabledText: {
    color: '#94a3b8',
  },
  pageNumberContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  pageNumber: {
    fontWeight: '700',
    fontSize: 14,
    color: '#1e293b',
    letterSpacing: 0.3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
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
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: -0.5,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 20,
    color: '#64748b',
    fontWeight: '600',
  },
  modalContent: {
    padding: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
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
    marginTop: 8,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButtonText: {
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
  profileContainer: {
    position: "relative",
    zIndex: 2000, // Higher z-index for profile container
  },
  profileBtn: {
    padding: 6,
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
});

export default BranchList;
