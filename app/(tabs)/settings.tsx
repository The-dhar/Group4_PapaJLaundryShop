import React, { useState } from 'react';
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

import Ionicons from '@expo/vector-icons/Ionicons';

const ROWS_PER_PAGE = 5;
type Branch = {
  id: number;
  name: string;
  username: string;
  password: string;
};

const BranchList = () => {
  const [page, setPage] = useState(1);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const branches: Branch[] = [
    { id: 1, name: 'Upper Calarian', username: 'upper_calarian', password: 'pass123' },
    { id: 2, name: 'Pasonanca', username: 'pasonanca', password: 'pass123' },
    { id: 3, name: 'San Roque 1', username: 'san_roque_1', password: 'pass123' },
    { id: 4, name: 'San Roque 2', username: 'san_roque_2', password: 'pass123' },
    { id: 5, name: 'Boalan', username: 'boalan', password: 'pass123' },
    { id: 6, name: 'Lunzuran', username: 'lunzuran', password: 'pass123' },
    { id: 7, name: 'Tumaga', username: 'tumaga', password: 'pass123' },
    { id: 8, name: 'Lower Calarian', username: 'lower_calarian', password: 'pass123' },
  ];

  const totalPages = Math.ceil(branches.length / ROWS_PER_PAGE);
  const startIndex = (page - 1) * ROWS_PER_PAGE;
  const pageData = branches.slice(startIndex, startIndex + ROWS_PER_PAGE);

  const handleEdit = (branch: Branch) => {
    setSelectedBranch(branch);
    setUsername(branch.username);
    setPassword(branch.password);
    setModalVisible(true);
  };

  const handleDelete = () => {
    setModalVisible(false);
    setUsername('');
    setPassword('');
    setSelectedBranch(null);
  };

  const handleConfirm = () => {
    if (username && password) {
      // Handle update logic here
      console.log('Updating branch:', selectedBranch?.name, { username, password });
      setModalVisible(false);
      setUsername('');
      setPassword('');
      setSelectedBranch(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Branch Settings</Text>
            <View style={styles.headerAccent} />
          </View>
        </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
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
                  <Text style={styles.branchName}>{branch.name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => handleEdit(branch)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={22} color="#3b82f6" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Pagination */}
          <View style={styles.pagination}>
            <TouchableOpacity
              disabled={page === 1}
              onPress={() => setPage(page - 1)}
              style={[styles.pageBtn, page === 1 && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageText, page === 1 && styles.disabledText]}>Prev</Text>
            </TouchableOpacity>

            <View style={styles.pageNumberContainer}>
              <Text style={styles.pageNumber}>
                Page {page} of {totalPages}
              </Text>
            </View>

            <TouchableOpacity
              disabled={page === totalPages}
              onPress={() => setPage(page + 1)}
              style={[styles.pageBtn, page === totalPages && styles.disabledBtn]}
              activeOpacity={0.7}
            >
              <Text style={[styles.pageText, page === totalPages && styles.disabledText]}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
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
                <Text style={styles.inputLabel}>Username:</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#9ca3af"
                />
              </View>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}> Clerk Username:</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Clerk username"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password:</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                />
              </View>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                  activeOpacity={0.8}
                >
                  <Text style={styles.deleteButtonText}>Archive</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
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
 header: {
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
});

export default BranchList;
