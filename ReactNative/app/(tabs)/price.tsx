import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput,Alert,StyleSheet,SafeAreaView,StatusBar} from 'react-native';
import { useRouter } from "expo-router";
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from "../../config/api";

const LaundryPriceManager = () => {
  type Tier = { range: string; price: number; description: string };
  type Service = { id: number; name: string; category: string; tiers: Tier[]; updatedAt: string | null; effectiveDate: string | null };
  type NewService = { name: string; category: string; tiers: { range: string; price: string; description: string }[] };

  const [services, setServices] = useState<Service[]>([]);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editedTiers, setEditedTiers] = useState<Tier[]>([]);
  const [newService, setNewService] = useState<NewService>({
    name: '',
    category: 'Wash & Fold',
    tiers: [{ range: '', price: '', description: '' }],
  });

  React.useEffect(() => {
    const loadServices = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${API_URL}/service-prices`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        const mapped: Service[] = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: Number(item.id),
          name: String(item.name),
          category: String(item.category),
          tiers: Array.isArray(item.tiers) ? item.tiers.map((t: any) => ({
            range: String(t.range || ''),
            price: Number(t.price || 0),
            description: String(t.description || ''),
          })) : [],
          updatedAt: item.updated_at || null,
          effectiveDate: item.effective_date || null,
        }));

        setServices(mapped);
      } catch (error) {
        console.log(error);
      }
    };

    loadServices();
  }, []);

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setEditedTiers(JSON.parse(JSON.stringify(service.tiers)) as Tier[]);
    setIsEditModalOpen(true);
  };

  const handleUpdatePrice = (tierIndex: number, field: keyof Tier, value: string) => {
    const updated = [...editedTiers];
    if (field === 'price') {
      updated[tierIndex] = { ...updated[tierIndex], price: parseFloat(value) || 0 };
    } else if (field === 'range') {
      updated[tierIndex] = { ...updated[tierIndex], range: value };
    } else {
      updated[tierIndex] = { ...updated[tierIndex], description: value };
    }
    setEditedTiers(updated);
  };

  const handleSaveChanges = async () => {
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
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              if (!token) return;

              const response = await fetch(`${API_URL}/service-prices/${selectedService.id}`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  tiers: editedTiers,
                  effective_date: effectiveDate.toISOString().slice(0, 10),
                }),
              });

              if (!response.ok) {
                Alert.alert("Error", "Failed to update pricing.");
                return;
              }

              const updated = await response.json();

              const updatedServices = services.map((service) =>
                service.id === selectedService.id
                  ? {
                      ...service,
                      tiers: Array.isArray(updated.tiers) ? updated.tiers : editedTiers,
                      updatedAt: updated.updated_at || new Date().toISOString(),
                      effectiveDate: updated.effective_date || effectiveDate.toISOString(),
                    }
                  : service
              );

              setServices(updatedServices);
              setIsEditModalOpen(false);
            } catch (error) {
              console.log(error);
              Alert.alert("Error", "Failed to update pricing.");
            }
          }
        }
      ]
    );
  };

  const handleAddTier = () => {
    setEditedTiers([...editedTiers, { range: '', price: 0, description: '' }]);
  };

  const handleRemoveTier = (index: number) => {
    if (editedTiers.length > 1) {
      const updated = editedTiers.filter((_, i) => i !== index);
      setEditedTiers(updated);
    }
  };

  const handleCreateService = async () => {
    if (!newService.name || newService.tiers.some(t => !t.range || !t.price)) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const response = await fetch(`${API_URL}/service-prices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: newService.name,
          category: newService.category,
          tiers: newService.tiers.map(t => ({
            range: t.range,
            price: parseFloat(t.price) || 0,
            description: t.description || '',
          })),
        }),
      });

      if (!response.ok) {
        Alert.alert("Error", "Failed to create service.");
        return;
      }

      const created = await response.json();

      const service: Service = {
        id: Number(created.id),
        name: created.name,
        category: created.category,
        tiers: Array.isArray(created.tiers)
          ? created.tiers.map((t: any) => ({
              range: String(t.range || ''),
              price: Number(t.price || 0),
              description: String(t.description || ''),
            }))
          : [],
        updatedAt: created.updated_at || new Date().toISOString(),
        effectiveDate: created.effective_date || null,
      };

      setServices([...services, service]);
      setIsCreateModalOpen(false);
      setNewService({
        name: '',
        category: 'Wash & Fold',
        tiers: [{ range: '', price: '', description: '' }],
      });
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to create service.");
    }
  };

  const handleNewServiceTierUpdate = (tierIndex: number, field: 'range' | 'price' | 'description', value: string) => {
    const updated = [...newService.tiers];
    updated[tierIndex] = { ...updated[tierIndex], [field]: value };
    setNewService({ ...newService, tiers: updated });
  };

  const handleAddNewServiceTier = () => {
    setNewService({
      ...newService,
      tiers: [...newService.tiers, { range: '', price: '', description: '' }],
    });
  };

  const handleRemoveNewServiceTier = (index: number) => {
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
        animationType="fade"
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
              {selectedService?.name === 'Penalty' ? (
                <View style={styles.tierEditCard}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Penalty Price (₱)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter price"
                      value={editedTiers[0]?.price.toString() ?? '0'}
                      onChangeText={(text) => handleUpdatePrice(0, 'price', text)}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Description</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter description"
                      value={editedTiers[0]?.description ?? ''}
                      onChangeText={(text) => handleUpdatePrice(0, 'description', text)}
                    />
                  </View>
                </View>
              ) : (
                editedTiers.map((tier, index) => (
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
                ))
              )}

              {selectedService?.name !== 'Penalty' && (
                <TouchableOpacity
                  onPress={handleAddTier}
                  style={styles.addTierButton}
                >
                  <Text style={styles.addTierButtonText}>+ Add Tier</Text>
                </TouchableOpacity>
              )}
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
    justifyContent: 'flex-end', // Aligns the modal to the bottom like a "bottom sheet"
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32, // Rounded corners at the top
    borderTopRightRadius: 32,
    maxHeight: '90%',
    width: '100%', // Ensure it spans the full width
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 }, 
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalBody: {
    padding: 24,
    
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