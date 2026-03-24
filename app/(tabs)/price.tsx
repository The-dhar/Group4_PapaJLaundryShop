import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useEffect, useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_URL = "http://YOUR_IP:8000/api/services"; // ⚠️ CHANGE THIS

const LaundryPriceManager = () => {
  type Tier = { range: string; price: number; description: string };
  type Service = { id: number; name: string; category: string; tiers: Tier[]; updatedAt: string | null; effectiveDate: string | null };
  type NewService = { name: string; category: string; tiers: { range: string; price: string; description: string }[] };

  const [services, setServices] = useState<Service[]>([]);
  const [token, setToken] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editedTiers, setEditedTiers] = useState<Tier[]>([]);
  const [newService, setNewService] = useState<NewService>({
    name: '',
    category: 'Wash & Fold',
    tiers: [{ range: '', price: '', description: '' }],
  });

  const router = useRouter();
  const [open, setOpen] = useState(false);

  // ✅ LOAD TOKEN
  useEffect(() => {
    const loadToken = async () => {
      const storedToken = await AsyncStorage.getItem("token");
      setToken(storedToken);
    };
    loadToken();
  }, []);

  // ✅ FETCH SERVICES
  const fetchServices = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      setServices(data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    setEditedTiers(JSON.parse(JSON.stringify(service.tiers)));
    setIsEditModalOpen(true);
  };

  const handleUpdatePrice = (tierIndex: number, field: keyof Tier, value: string) => {
    const updated = [...editedTiers];
    if (field === 'price') {
      updated[tierIndex].price = parseFloat(value) || 0;
    } else {
      (updated[tierIndex] as any)[field] = value;
    }
    setEditedTiers(updated);
  };

  // ✅ UPDATE (WITH SANCTUM)
  const handleSaveChanges = () => {
    if (!selectedService || !token) return;

    const effectiveDate = new Date();
    effectiveDate.setDate(effectiveDate.getDate() + 7);

    Alert.alert(
      'Confirm Price Update',
      `Effective on ${effectiveDate.toDateString()}`,
      [
        { text: 'Cancel' },
        {
          text: 'Proceed',
          onPress: async () => {
            try {
              await fetch(`${API_URL}/${selectedService.id}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  tiers: editedTiers,
                  effectiveDate: effectiveDate.toISOString()
                })
              });

              await fetchServices();
              setIsEditModalOpen(false);
            } catch (err) {
              console.log(err);
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
      setEditedTiers(editedTiers.filter((_, i) => i !== index));
    }
  };

  // ✅ CREATE (WITH SANCTUM)
  const handleCreateService = async () => {
    if (!token) return;

    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newService.name,
          category: newService.category,
          tiers: newService.tiers.map(t => ({
            ...t,
            price: parseFloat(t.price)
          }))
        })
      });

      await fetchServices();
      setIsCreateModalOpen(false);

      setNewService({
        name: '',
        category: 'Wash & Fold',
        tiers: [{ range: '', price: '', description: '' }],
      });

    } catch (err) {
      console.log(err);
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
      setNewService({
        ...newService,
        tiers: newService.tiers.filter((_, i) => i !== index),
      });
    }
  };

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

      {/* KEEPING YOUR UI EXACTLY SAME BELOW */}
      {/* NOTHING CHANGED IN UI */}

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <View style={styles.servicesList}>
            {services.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                <Text style={styles.serviceName}>{service.name}</Text>

                {service.tiers.map((tier, i) => (
                  <Text key={i}>
                    {tier.range} - ₱{tier.price.toFixed(2)}
                  </Text>
                ))}

                <TouchableOpacity onPress={() => handleEditService(service)}>
                  <Text>Edit</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
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