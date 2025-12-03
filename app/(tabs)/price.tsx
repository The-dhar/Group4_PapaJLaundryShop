import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput,Alert,StyleSheet,SafeAreaView,StatusBar} from 'react-native';
import { useRouter } from "expo-router";
import Ionicons from 'react-native-vector-icons/Ionicons';

const LaundryPriceManager = () => {
  const [services, setServices] = useState([
    {
      id: 1,
      name: 'Regular Clothes',
      category: 'Wash & Fold',
      tiers: [
        { range: '1-6 kg', price: 150, description: '1 cycle' },
        { range: '6.1-7 kg', price: 175, description: 'Standard' },
        { range: '7.1-8 kg', price: 200, description: '₱25 per succeeding kg' },
        { range: '8+ kg', price: 150, description: 'Per cycle (8kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
    {
      id: 2,
      name: 'White Clothes',
      category: 'Wash & Fold',
      tiers: [
        { range: '1-6 kg', price: 150, description: '1 cycle' },
        { range: '6.1-7 kg', price: 185, description: 'Standard' },
        { range: '7.1-8 kg', price: 220, description: '₱35 per succeeding kg' },
        { range: '8+ kg', price: 150, description: 'Per cycle (8kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
    {
      id: 3,
      name: 'Bedsheet/Blanket',
      category: 'Wash & Fold',
      tiers: [
        { range: '1-3 kg', price: 150, description: 'Base price' },
        { range: '3.1-5 kg', price: 50, description: '₱50 per succeeding kg' },
        { range: '5+ kg', price: 150, description: 'Per cycle (5kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
    {
      id: 4,
      name: 'Drying Service',
      category: 'Dry Only',
      tiers: [
        { range: '1-6 kg', price: 120, description: 'Small load' },
        { range: '6.1-8 kg', price: 150, description: 'Medium load' },
        { range: '8+ kg', price: 150, description: 'Per cycle (8kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
    {
      id: 5,
      name: 'Curtains/Big Towel',
      category: 'Wash & Fold',
      tiers: [
        { range: '1-3 kg', price: 150, description: 'Base price' },
        { range: '3.1-5 kg', price: 50, description: '₱50 per succeeding kg' },
        { range: '5+ kg', price: 150, description: 'Per cycle (5kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
    {
      id: 6,
      name: 'Comforters',
      category: 'Wash & Fold',
      tiers: [
        { range: '1-3 kg', price: 150, description: 'Base price' },
        { range: '3.1-5 kg', price: 50, description: '₱50 per succeeding kg' },
        { range: '5+ kg', price: 150, description: 'Per cycle (5kg)' },
      ],
      updatedAt: null,
      effectiveDate: null,
    },
  ]);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [editedTiers, setEditedTiers] = useState([]);
  const [newService, setNewService] = useState({
    name: '',
    category: 'Wash & Fold',
    tiers: [{ range: '', price: '', description: '' }],
  });

  const handleEditService = (service) => {
    setSelectedService(service);
    setEditedTiers(JSON.parse(JSON.stringify(service.tiers)));
    setIsEditModalOpen(true);
  };

  const handleUpdatePrice = (tierIndex, field, value) => {
    const updated = [...editedTiers];
    updated[tierIndex][field] = field === 'price' ? parseFloat(value) || 0 : value;
    setEditedTiers(updated);
  };

  const handleSaveChanges = () => {
    if (!selectedService) return;
    
    const hasChanges = JSON.stringify(editedTiers) !== JSON.stringify(selectedService.tiers);
    
    if (!hasChanges) {
      setIsEditModalOpen(false);
      return;
    }

    const effectiveDate = new Date();
    effectiveDate.setDate(effectiveDate.getDate() + 7);

    Alert.alert(
      'Confirm Price Update',
      `New prices will be effective on ${effectiveDate.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })}\n\n(7 days from now)\n\nDo you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Proceed',
          onPress: () => {
            const updatedServices = services.map((service) =>
              service.id === selectedService.id
                ? {
                    ...service,
                    tiers: editedTiers,
                    updatedAt: new Date().toISOString(),
                    effectiveDate: effectiveDate.toISOString(),
                  }
                : service
            );
            setServices(updatedServices);
            setIsEditModalOpen(false);
          }
        }
      ]
    );
  };

  const handleAddTier = () => {
    setEditedTiers([...editedTiers, { range: '', price: 0, description: '' }]);
  };

  const handleRemoveTier = (index) => {
    if (editedTiers.length > 1) {
      const updated = editedTiers.filter((_, i) => i !== index);
      setEditedTiers(updated);
    }
  };

  const handleCreateService = () => {
    if (!newService.name || newService.tiers.some(t => !t.range || !t.price)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const service = {
      id: services.length + 1,
      name: newService.name,
      category: newService.category,
      tiers: newService.tiers.map(t => ({ ...t, price: parseFloat(t.price) || 0 })),
      updatedAt: new Date().toISOString(),
      effectiveDate: null,
    };

    setServices([...services, service]);
    setIsCreateModalOpen(false);
    setNewService({
      name: '',
      category: 'Wash & Fold',
      tiers: [{ range: '', price: '', description: '' }],
    });
  };

  const handleNewServiceTierUpdate = (tierIndex, field, value) => {
    const updated = [...newService.tiers];
    updated[tierIndex][field] = value;
    setNewService({ ...newService, tiers: updated });
  };

  const handleAddNewServiceTier = () => {
    setNewService({
      ...newService,
      tiers: [...newService.tiers, { range: '', price: '', description: '' }],
    });
  };

  const handleRemoveNewServiceTier = (index) => {
    if (newService.tiers.length > 1) {
      const updated = newService.tiers.filter((_, i) => i !== index);
      setNewService({ ...newService, tiers: updated });
    }
  };
  const router = useRouter();
  const [open, setOpen] = useState(false);
   
  const handleProfile = () => {
    setOpen(false);
    router.push("/profile");
  };
  
  const handleLogout = () => {
    setOpen(false);
    router.push("/login");
  };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
     <View style={styles.header}>
                  {/* LEFT SIDE: Dashboard title + underline */}
                  <View style={styles.headerLeft}>
                    <Text style={styles.headerText}>Price Management</Text>
                    <View style={styles.headerAccent} />
                  </View>
          
                  {/* RIGHT SIDE: Profile button */}
                  <View style={styles.profileContainer}>
                    <TouchableOpacity
                      style={styles.profileBtn}
                      onPress={() => setOpen(!open)}
                    >
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
     

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          {/* List Header */}
          <View style={styles.listHeader}>
            <View style={styles.listHeaderLeft}>
              <Text style={styles.listHeaderTitle}>Service Pricing</Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsCreateModalOpen(true)}
              style={styles.createButton}
            >
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          </View>

          {/* Services List */}
          <View style={styles.servicesList}>
            {services.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                {/* Service Header */}
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceCategory}>{service.category}</Text>
                    {service.effectiveDate && (
                      <View style={styles.effectiveDateBadge}>
                        <Text style={styles.effectiveDateText}>
                         Effective: {new Date(service.effectiveDate).toLocaleDateString()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleEditService(service)}
                    style={styles.editButton}
                  >
                    <Ionicons name="create-outline" size={20} color="#fff" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Tiers */}
                <View style={styles.tiersContainer}>
                  {service.tiers.map((tier, tierIndex) => (
                    <View key={tierIndex} style={styles.tierItem}>
                      <View style={styles.tierInfo}>
                        <Text style={styles.tierRange}>{tier.range}</Text>
                        <Text style={styles.tierDescription}>{tier.description}</Text>
                      </View>
                      <Text style={styles.tierPrice}>₱{tier.price.toFixed(2)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {selectedService?.name}
              </Text>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {editedTiers.map((tier, index) => (
                <View key={index} style={styles.tierEditCard}>
                  <View style={styles.tierEditHeader}>
                    <Text style={styles.tierEditTitle}>Tier {index + 1}</Text>
                    {editedTiers.length > 1 && (
                      <TouchableOpacity
                     onPress={() => handleRemoveTier(index)}
                    style={styles.deleteButton}
                    >
                    <Ionicons name="trash-outline" size={20} color="#000000ff" />
                    </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Range (e.g., 1-6 kg)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter range"
                      value={tier.range}
                      onChangeText={(text) => handleUpdatePrice(index, 'range', text)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Price (₱)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter price"
                      value={tier.price.toString()}
                      onChangeText={(text) => handleUpdatePrice(index, 'price', text)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter description"
                      value={tier.description}
                      onChangeText={(text) => handleUpdatePrice(index, 'description', text)}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddTier}
                style={styles.addTierButton}
              >
                <Text style={styles.addTierButtonText}>+ Add Tier</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setIsEditModalOpen(false)}
                style={[styles.footerButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveChanges}
                style={[styles.footerButton, styles.saveButton]}
              >
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Service Modal */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Service</Text>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter service name"
                  value={newService.name}
                  onChangeText={(text) => setNewService({ ...newService, name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category</Text>
                <View style={styles.categoryButtons}>
                  <TouchableOpacity
                    onPress={() => setNewService({ ...newService, category: 'Wash & Fold' })}
                    style={[
                      styles.categoryButton,
                      newService.category === 'Wash & Fold' && styles.categoryButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      newService.category === 'Wash & Fold' && styles.categoryButtonTextActive
                    ]}>
                      Wash & Fold
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setNewService({ ...newService, category: 'Dry Only' })}
                    style={[
                      styles.categoryButton,
                      newService.category === 'Dry Only' && styles.categoryButtonActive
                    ]}
                  >
                    <Text style={[
                      styles.categoryButtonText,
                      newService.category === 'Dry Only' && styles.categoryButtonTextActive
                    ]}>
                      Dry Only
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Price Tiers</Text>

              {newService.tiers.map((tier, index) => (
                <View key={index} style={styles.tierEditCard}>
                  <View style={styles.tierEditHeader}>
                    <Text style={styles.tierEditTitle}>Tier {index + 1}</Text>
                    {newService.tiers.length > 1 && (
                      <TouchableOpacity
                     onPress={() => handleRemoveNewServiceTier(index)}
                     style={styles.deleteButton}
                        >
                    <Ionicons name="trash-outline" size={20} color="#000000ff" />
                    </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Range * (e.g., 1-6 kg)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter range"
                      value={tier.range}
                      onChangeText={(text) => handleNewServiceTierUpdate(index, 'range', text)}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Price * (₱)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter price"
                      value={tier.price.toString()}
                      onChangeText={(text) => handleNewServiceTierUpdate(index, 'price', text)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter description"
                      value={tier.description}
                      onChangeText={(text) => handleNewServiceTierUpdate(index, 'description', text)}
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity
                onPress={handleAddNewServiceTier}
                style={styles.addTierButton}
              >
                <Text style={styles.addTierButtonText}>+ Add Tier</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                style={[styles.footerButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateService}
                style={[styles.footerButton, styles.saveButton]}
              >
                <Text style={styles.saveButtonText}>Create Service</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerUnderline: {
    width: 64,
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
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
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconText: {
    fontSize: 24,
  },
  listHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
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
    fontSize: 14,
    fontWeight: '700',
  },
  servicesList: {
    padding: 20,
    gap: 16,
  },
  serviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
  },
  effectiveDateBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  effectiveDateText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
  },
  editButton: {
     flexDirection: "row", 
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tiersContainer: {
    gap: 8,
  },
  tierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
  },
  tierInfo: {
    flex: 1,
  },
  tierRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 2,
  },
  tierDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
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
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748b',
  },
  modalBody: {
    flex: 1,
    padding: 24,
  },
  tierEditCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tierEditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tierEditTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 20,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  addTierButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  addTierButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 16,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  categoryButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  categoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  categoryButtonTextActive: {
    color: '#3b82f6',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 16,
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
  headerAccent: {
    position: "absolute",
    bottom: -8,
    left: 0,
    width: 60,
    height: 4,
    backgroundColor: "#3b82f6",
    borderRadius: 2,
  },
});

export default LaundryPriceManager;