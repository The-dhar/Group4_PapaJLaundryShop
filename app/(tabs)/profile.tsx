import React, { useState} from 'react';
import {Modal,SafeAreaView,StatusBar,StyleSheet,Text,TextInput,TouchableOpacity, View, Image} from 'react-native';
import { useRouter } from "expo-router";
import Ionicons from 'react-native-vector-icons/Ionicons';
export default function ProfileScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();
  const handleConfirm = () => {
    // Add your password change logic here
    console.log('Password change confirmed');
    setModalVisible(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleDelete = () => {
    // Add your delete logic here
    console.log('Delete clicked');
    setModalVisible(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />

    <View style={styles.container}>
      <View style={styles.header}>
  <View style={styles.headerRow}>
    {/* Back Button */}
    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
      <Ionicons name="chevron-back" size={26} color="#1e293b" />
    </TouchableOpacity>

    {/* Title + Accent */}
    <View style={styles.headerContent}>
      <Text style={styles.headerTitle}>Profile</Text>
      <View style={styles.headerAccent} />
    </View>
  </View>
</View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
  {/* Logo */}
  <View style={styles.logoContainer}>
    <View style={styles.logoCircle}>
      <Image 
        source={require("../../assets/images/papaj logo.png")}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  </View>
  {/* Name Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value="admin@example.com"
            editable={false}
          />
        </View>

        {/* Password Field */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value="************"
            secureTextEntry
            editable={false}
          />
        </View>

        {/* Edit Password Button */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.editButtonText}>Edit Password</Text>
        </TouchableOpacity>
      </View>

</View>

        

      {/* Password Edit Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Profile</Text>
            </View>

            {/* Logo in Modal */}
              <View style={styles.logoContainer}>
    <View style={styles.logoCircle}>
      <Image 
        source={require("../../assets/images/papaj logo.png")}
        style={styles.logoImage}
        resizeMode="contain"
      />
    </View>
  </View>

            {/* Password Form */}
            <View style={styles.passwordForm}>
              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Old Password:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                  secureTextEntry
                  placeholder=""
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>New Password:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder=""
                />
              </View>

              <View style={styles.modalInputGroup}>
                <Text style={styles.modalLabel}>Re-enter New Password:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder=""
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={handleDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
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
  headerRow: {
  flexDirection: "row",
  alignItems: "center",
},

backBtn: {
  marginRight: 10,
  padding: 4,
},

  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
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
  logoInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#60a5fa',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  logoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3b82f6',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    paddingHorizontal: 16,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    width: 44,
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  backButtonText: {
    fontSize: 24,
    color: '#1e293b',
    fontWeight: '600',
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '800',
    color: '#1e293b',
    marginRight: 44,
    letterSpacing: -0.5,
  },
  modalLogoContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  passwordForm: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  modalInputGroup: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  modalInput: {
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    paddingVertical:20,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  logoImage: {
  width: 80,
  height: 80,
  borderRadius: 40,   // para bilog
},

});