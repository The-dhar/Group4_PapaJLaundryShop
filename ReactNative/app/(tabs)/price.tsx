import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  LayoutAnimation,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { API_URL, resolvePublicFileUrl } from "../../config/api";

/** Scroll area max height so the sheet scrolls internally; avoids the footer clipping the last controls. */
const CREATE_SERVICE_SCROLL_MAX_H = Math.round(Dimensions.get("window").height * 0.52);

type PriceTier = { range: string; price: number; description: string };
type PriceService = {
  id: number;
  name: string;
  category: string;
  unit: "kg" | "per piece";
  tiers: PriceTier[];
  updatedAt: string | null;
  effectiveDate: string | null;
  imageUrl: string | null;
};
type ServiceCategory = {
  id: number;
  name: string;
};
type PickedImage = {
  uri: string;
  name: string;
  type: string;
  file?: any;
};

function mergeServiceFromApi(item: any): PriceService {
  const firstRange = String(item?.tiers?.[0]?.range || "").toLowerCase();
  const inferredUnit: "kg" | "per piece" =
    String(item?.unit || "").toLowerCase() === "per piece" || firstRange.includes("piece")
      ? "per piece"
      : "kg";
  const resolvedImageUrl =
    item.image_url != null && item.image_url !== ""
      ? resolvePublicFileUrl(String(item.image_url))
      : null;
  const imageVersion = item.updated_at ?? item.effective_date ?? item.id;
  return {
    id: Number(item.id),
    name: String(item.name),
    category: String(item.category),
    unit: inferredUnit,
    tiers: Array.isArray(item.tiers)
      ? item.tiers.map((t: any) => ({
          range: String(t.range || ""),
          price: Number(t.price || 0),
          description: String(t.description || ""),
        }))
      : [],
    updatedAt: item.updated_at ?? null,
    effectiveDate: item.effective_date ?? null,
    imageUrl: resolvedImageUrl
      ? (resolvedImageUrl.includes("?")
          ? `${resolvedImageUrl}&v=${encodeURIComponent(String(imageVersion ?? ""))}`
          : `${resolvedImageUrl}?v=${encodeURIComponent(String(imageVersion ?? ""))}`)
      : null,
  };
}

function normalizeTiersForUnit(
  tiers: { range: string; price: number; description: string }[],
  unit: "kg" | "per piece"
) {
  if (unit === "per piece") {
    return tiers.map((tier) => ({ ...tier, range: "per piece" }));
  }
  return tiers;
}

function mapServiceRows(data: unknown): PriceService[] {
  return (Array.isArray(data) ? data : []).map((item: any) => mergeServiceFromApi(item));
}

function imageMimeFromUri(uri: string): { name: string; type: string } {
  const tail = uri.split("/").pop() || "photo.jpg";
  const ext = tail.includes(".") ? tail.split(".").pop()?.toLowerCase() : "jpg";
  if (ext === "png") return { name: "upload.png", type: "image/png" };
  if (ext === "webp") return { name: "upload.webp", type: "image/webp" };
  return { name: "upload.jpg", type: "image/jpeg" };
}

function extractApiErrorMessage(err: any, fallback: string): string {
  const lines: string[] = [];
  if (err?.errors && typeof err.errors === "object") {
    Object.values(err.errors).forEach((v: any) => {
      if (Array.isArray(v)) v.forEach((x) => typeof x === "string" && lines.push(x));
      else if (typeof v === "string") lines.push(v);
    });
  }
  if (lines.length) return lines.join("\n");
  if (typeof err?.message === "string" && err.message.trim()) return err.message;
  return fallback;
}

/** Laravel parses `tiers[0][range]` multipart keys into an array; JSON strings often stay strings and fail validation. */
function appendTiersToFormData(
  form: FormData,
  tiers: { range: string; price: number; description: string }[]
) {
  tiers.forEach((tier, index) => {
    form.append(`tiers[${index}][range]`, tier.range);
    form.append(`tiers[${index}][price]`, String(tier.price));
    form.append(`tiers[${index}][description]`, tier.description ?? "");
  });
}

/** Matches backend seed: additional charges (e.g. Penalty) use category `Misc`. */
function isAdditionalChargeService(s: PriceService): boolean {
  return s.category === "Misc";
}

type PriceSectionTab = "services" | "additional" | "categories";
type ExtraChargeType = "fixed" | "incremental";

function parseExtraChargeDescription(raw: string): { type: ExtraChargeType; description: string } {
  const text = String(raw || "").trim();
  const m = text.match(/^\[(?:charge_)?type:(fixed|incremental)\]\s*/i);
  if (!m) return { type: "fixed", description: text };
  const type = m[1].toLowerCase() === "incremental" ? "incremental" : "fixed";
  return { type, description: text.replace(m[0], "").trim() };
}

function buildExtraChargeDescription(type: ExtraChargeType, description: string): string {
  const clean = String(description || "").trim();
  return `[type:${type}]${clean ? ` ${clean}` : ""}`;
}

const LaundryPriceManager = () => {
  type Tier = PriceTier;
  type Service = PriceService;
  type Category = ServiceCategory;
  type NewService = {
    name: string;
    category: string;
    unit: "kg" | "per piece";
    tiers: { range: string; price: string; description: string }[];
  };

  const [priceSectionTab, setPriceSectionTab] = useState<PriceSectionTab>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoadingPrices, setIsLoadingPrices] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [confirmKind, setConfirmKind] = useState<'edit' | 'create' | null>(null);
  const [pendingEffectiveDate, setPendingEffectiveDate] = useState<Date | null>(null);
  const [pendingDeleteService, setPendingDeleteService] = useState<Service | null>(null);
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<Category | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  /** True when creating from Additional Charges tab (category fixed to Misc). */
  const [createForAdditional, setCreateForAdditional] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editedTiers, setEditedTiers] = useState<Tier[]>([]);
  const [newService, setNewService] = useState<NewService>({
    name: '',
    category: '',
    unit: "kg",
    tiers: [{ range: '', price: '', description: '' }],
  });
  const [createImageUri, setCreateImageUri] = useState<PickedImage | null>(null);
  /** Additional Charges tab: flat name / price / description (API maps to a single Misc tier). */
  const [additionalChargeDraft, setAdditionalChargeDraft] = useState({
    name: "",
    type: "fixed" as ExtraChargeType,
    price: "",
    description: "",
  });
  const [categoryDraftName, setCategoryDraftName] = useState("");
  const [isCreateCategoryPickerOpen, setIsCreateCategoryPickerOpen] = useState(false);
  const [isEditCategoryPickerOpen, setIsEditCategoryPickerOpen] = useState(false);

  const [editedName, setEditedName] = useState("");
  const [editedCategory, setEditedCategory] = useState("");
  const [editedUnit, setEditedUnit] = useState<"kg" | "per piece">("kg");
  const [editedAdditionalType, setEditedAdditionalType] = useState<ExtraChargeType>("fixed");
  const [editImageUri, setEditImageUri] = useState<PickedImage | null>(null);
  const [editRemoveImage, setEditRemoveImage] = useState(false);

  const { token, logout } = useAuth();

  const loadCategories = useCallback(async () => {
    try {
      if (!token) {
        setCategories([]);
        return;
      }
      const response = await fetch(`${API_URL}/service-categories`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      const mapped: Category[] = (Array.isArray(data) ? data : [])
        .map((c: any) => ({ id: Number(c.id), name: String(c.name || "").trim() }))
        .filter((c) => !!c.name && c.name.toLowerCase() !== "misc");
      setCategories(mapped);
    } catch {
      /* ignore */
    }
  }, [token]);

  const loadServices = useCallback(async () => {
    setLoadError(null);
    setIsLoadingPrices(true);
    try {
      if (!token) {
        setServices([]);
        setLoadError('You are not signed in.');
        return;
      }

      const response = await fetch(`${API_URL}/service-prices`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        setServices([]);
        setLoadError(`Could not load prices (error ${response.status}).`);
        return;
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        setServices([]);
        setLoadError('Invalid response from server.');
        return;
      }

      setServices(mapServiceRows(data));
    } catch (error) {
      console.log(error);
      setServices([]);
      setLoadError('Something went wrong. Check your connection.');
    } finally {
      setIsLoadingPrices(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadServices();
      loadCategories();
    }, [loadServices, loadCategories])
  );

  const servicesTabRows = useMemo(
    () => services.filter((s) => !isAdditionalChargeService(s)),
    [services]
  );
  /** No default label: empty until owner adds at least one category in the Category tab. */
  const defaultServiceCategory = useMemo(() => categories[0]?.name ?? "", [categories]);
  const additionalTabRows = useMemo(() => services.filter(isAdditionalChargeService), [services]);
  const displayedRows = priceSectionTab === "services" ? servicesTabRows : additionalTabRows;

  const onSelectPriceSection = (tab: PriceSectionTab) => {
    if (tab === priceSectionTab) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsCreateCategoryPickerOpen(false);
    setIsEditCategoryPickerOpen(false);
    setPriceSectionTab(tab);
  };

  const pickServiceImage = async (): Promise<PickedImage | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library access to attach an image.");
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return null;
    const asset: any = result.assets[0];
    const guessed = imageMimeFromUri(asset.uri);
    return {
      uri: asset.uri,
      name: asset.fileName || guessed.name,
      type: asset.mimeType || guessed.type,
      file: asset.file,
    };
  };

  const handleEditService = (service: Service) => {
    setSelectedService(service);
    if (isAdditionalChargeService(service)) {
      const t0 = service.tiers?.[0];
      const parsed = parseExtraChargeDescription(t0?.description || "");
      setEditedTiers([
        t0
          ? { ...t0, range: "—", description: parsed.description }
          : { range: "—", price: 0, description: "" },
      ]);
      setEditedAdditionalType(parsed.type);
    } else {
      setEditedTiers(JSON.parse(JSON.stringify(service.tiers)) as Tier[]);
    }
    setEditedName(service.name);
    setEditedCategory(service.category);
  setEditedUnit(service.unit || "kg");
    setEditImageUri(null);
    setEditRemoveImage(false);
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

  const handleSaveChanges = () => {
    if (!selectedService) return;

    if (!editedName.trim()) {
      Alert.alert("Error", "Name is required.");
      return;
    }

    const isMisc = isAdditionalChargeService(selectedService);
    if (!isMisc && !editedCategory.trim()) {
      Alert.alert("Error", "Please select a category.");
      return;
    }
    if (isMisc) {
      if (editedTiers.length === 0) {
        Alert.alert("Error", "Price information is missing.");
        return;
      }
      const p = editedTiers[0].price;
      if (typeof p !== "number" || Number.isNaN(p) || p < 0) {
        Alert.alert("Error", "Please enter a valid price.");
        return;
      }
    } else if (editedTiers.length === 0 || editedTiers.some((t) => !String(t.range || "").trim())) {
      Alert.alert("Error", "Each tier must have a range.");
      return;
    }

    const tiersChanged = JSON.stringify(editedTiers) !== JSON.stringify(selectedService.tiers);
    const metaChanged = isMisc
      ? editedName.trim() !== selectedService.name
      : editedName.trim() !== selectedService.name || editedCategory !== selectedService.category;
    const imageDirty = !isMisc && (editImageUri !== null || editRemoveImage);

    if (!tiersChanged && !metaChanged && !imageDirty) {
      setIsEditModalOpen(false);
      return;
    }

    if (tiersChanged) {
      const effectiveDate = new Date();
      effectiveDate.setDate(effectiveDate.getDate() + 7);
      setPendingEffectiveDate(effectiveDate);
    } else {
      setPendingEffectiveDate(null);
    }

    setConfirmKind("edit");
  };

  const submitEditAfterConfirm = async () => {
    if (!selectedService) return;

    setIsMutating(true);
    try {
      if (!token) {
        Alert.alert("Error", "Not signed in.");
        return;
      }

      const isMisc = isAdditionalChargeService(selectedService);
      const categoryForApi = isMisc ? "Misc" : editedCategory;

      const eff =
        pendingEffectiveDate != null ? pendingEffectiveDate.toISOString().slice(0, 10) : undefined;

      if (isMisc) {
        const body: Record<string, unknown> = {
          name: editedName.trim(),
          category: "Misc",
          price: editedTiers[0].price,
          description: buildExtraChargeDescription(
            editedAdditionalType,
            editedTiers[0].description ?? ""
          ),
        };
        if (eff) body.effective_date = eff;

        const response = await fetch(`${API_URL}/service-prices/${selectedService.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let msg = "Failed to update additional charge.";
          try {
            const err = await response.json();
            msg = extractApiErrorMessage(err, msg);
          } catch {
            /* ignore */
          }
          Alert.alert("Error", msg);
          return;
        }

        const updated = await response.json();
        const merged = mergeServiceFromApi(updated);
        setServices((prev) => prev.map((s) => (s.id === merged.id ? merged : s)));

        setConfirmKind(null);
        setPendingEffectiveDate(null);
        setEditImageUri(null);
        setEditRemoveImage(false);
        setIsEditModalOpen(false);
        return;
      }

      if (editImageUri) {
        const form = new FormData();
        form.append("name", editedName.trim());
        form.append("category", categoryForApi);
        appendTiersToFormData(form, editedTiers);
        if (eff) form.append("effective_date", eff);
        if (editRemoveImage) form.append("remove_image", "1");
        if (editImageUri.file) form.append("image", editImageUri.file as any);
        else form.append("image", { uri: editImageUri.uri, name: editImageUri.name, type: editImageUri.type } as any);

        const response = await fetch(`${API_URL}/service-prices/${selectedService.id}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: form,
        });

        if (!response.ok) {
          let msg = "Failed to update service.";
          try {
            const err = await response.json();
            msg = extractApiErrorMessage(err, msg);
          } catch {
            /* ignore */
          }
          Alert.alert("Error", msg);
          return;
        }

        const updated = await response.json();
        const merged = mergeServiceFromApi(updated);
        setServices((prev) => prev.map((s) => (s.id === merged.id ? merged : s)));
      } else {
        const body: Record<string, unknown> = {
          name: editedName.trim(),
          category: categoryForApi,
          tiers: normalizeTiersForUnit(editedTiers, editedUnit),
        };
        if (eff) body.effective_date = eff;
        if (editRemoveImage) body.remove_image = true;

        const response = await fetch(`${API_URL}/service-prices/${selectedService.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          let msg = "Failed to update service.";
          try {
            const err = await response.json();
            msg = extractApiErrorMessage(err, msg);
          } catch {
            /* ignore */
          }
          Alert.alert("Error", msg);
          return;
        }

        const updated = await response.json();
        const merged = mergeServiceFromApi(updated);
        setServices((prev) => prev.map((s) => (s.id === merged.id ? merged : s)));
      }

      setConfirmKind(null);
      setPendingEffectiveDate(null);
      setEditImageUri(null);
      setEditRemoveImage(false);
      setIsEditModalOpen(false);
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to update service.");
    } finally {
      setIsMutating(false);
    }
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

  const handleCreateService = () => {
    if (createForAdditional) {
      if (!additionalChargeDraft.name.trim()) {
        Alert.alert("Error", "Extra charges name is required.");
        return;
      }
      const p = parseFloat(additionalChargeDraft.price);
      if (
        !additionalChargeDraft.price.trim() ||
        Number.isNaN(p) ||
        p < 0
      ) {
        Alert.alert("Error", "Please enter a valid price.");
        return;
      }
      setConfirmKind("create");
      return;
    }
    if (!newService.category.trim()) {
      Alert.alert("Error", "Please select a category.");
      return;
    }
    if (!newService.name.trim() || newService.tiers.some((t) => !String(t.range || "").trim() || !String(t.price || "").trim())) {
      Alert.alert("Error", "Please fill in service name and required tier fields.");
      return;
    }
    setConfirmKind("create");
  };

  const submitCreateAfterConfirm = async () => {
    setIsMutating(true);
    try {
      if (!token) {
        Alert.alert("Error", "Not signed in.");
        return;
      }

      if (createForAdditional) {
        const response = await fetch(`${API_URL}/service-prices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: additionalChargeDraft.name.trim(),
            category: "Misc",
            price: parseFloat(additionalChargeDraft.price) || 0,
            description: buildExtraChargeDescription(
              additionalChargeDraft.type,
              additionalChargeDraft.description.trim() || ""
            ),
          }),
        });

        if (!response.ok) {
          let msg = "Failed to create additional charge.";
          try {
            const err = await response.json();
            msg = extractApiErrorMessage(err, msg);
          } catch {
            /* ignore */
          }
          Alert.alert("Error", msg);
          return;
        }

        const created = await response.json();
        const service = mergeServiceFromApi(created);

        setServices((prev) => [...prev, service]);
        setConfirmKind(null);
        setCreateForAdditional(false);
        setIsCreateModalOpen(false);
        setAdditionalChargeDraft({ name: "", type: "fixed", price: "", description: "" });
        setNewService({
          name: "",
          category: defaultServiceCategory,
          unit: "kg",
          tiers: [{ range: "", price: "", description: "" }],
        });
        return;
      }

      const tiersPayload = normalizeTiersForUnit(
        newService.tiers.map((t) => ({
          range: t.range,
          price: parseFloat(t.price) || 0,
          description: t.description || "",
        })),
        newService.unit
      );

      let response: Response;

      if (createImageUri) {
        const form = new FormData();
        form.append("name", newService.name.trim());
        form.append("category", newService.category);
        appendTiersToFormData(form, tiersPayload);
        if (createImageUri.file) form.append("image", createImageUri.file as any);
        else form.append("image", { uri: createImageUri.uri, name: createImageUri.name, type: createImageUri.type } as any);

        response = await fetch(`${API_URL}/service-prices`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: form,
        });
      } else {
        response = await fetch(`${API_URL}/service-prices`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({
            name: newService.name.trim(),
            category: newService.category,
            tiers: tiersPayload,
          }),
        });
      }

      if (!response.ok) {
        let msg = "Failed to create service.";
        try {
          const err = await response.json();
          msg = extractApiErrorMessage(err, msg);
        } catch {
          /* ignore */
        }
        Alert.alert("Error", msg);
        return;
      }

      const created = await response.json();
      const service = mergeServiceFromApi(created);

      setServices((prev) => [...prev, service]);
      setConfirmKind(null);
      setCreateForAdditional(false);
      setIsCreateModalOpen(false);
      setCreateImageUri(null);
      setAdditionalChargeDraft({ name: "", type: "fixed", price: "", description: "" });
      setNewService({
        name: "",
        category: defaultServiceCategory,
        unit: "kg",
        tiers: [{ range: "", price: "", description: "" }],
      });
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to create service.");
    } finally {
      setIsMutating(false);
    }
  };

  const openCreateModal = () => {
    if (priceSectionTab === "categories") {
      setSelectedCategory(null);
      setCategoryDraftName("");
      setIsCategoryModalOpen(true);
      return;
    }
    setCreateForAdditional(priceSectionTab === "additional");
    setNewService({
      name: "",
      category: priceSectionTab === "additional" ? "Misc" : defaultServiceCategory,
      unit: "kg",
      tiers: [{ range: "", price: "", description: "" }],
    });
    setAdditionalChargeDraft({ name: "", type: "fixed", price: "", description: "" });
    setCreateImageUri(null);
    setIsCreateCategoryPickerOpen(false);
    setConfirmKind(null);
    setIsCreateModalOpen(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setCategoryDraftName(category.name);
    setIsCategoryModalOpen(true);
  };

  const submitCategory = async () => {
    if (!token) {
      Alert.alert("Error", "Not signed in.");
      return;
    }
    const name = categoryDraftName.trim();
    if (!name) {
      Alert.alert("Error", "Category name is required.");
      return;
    }
    const normalized = name.toLowerCase();
    const duplicate = categories.some(
      (c) => c.name.toLowerCase() === normalized && c.id !== (selectedCategory?.id ?? -1)
    );
    if (duplicate) {
      Alert.alert("Duplicate category", "That category name already exists.");
      return;
    }
    setIsMutating(true);
    try {
      const isEdit = selectedCategory !== null;
      const url = isEdit
        ? `${API_URL}/service-categories/${selectedCategory.id}`
        : `${API_URL}/service-categories`;
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        let msg = isEdit ? "Failed to update category." : "Failed to create category.";
        try {
          const err = await response.json();
          msg = extractApiErrorMessage(err, msg);
        } catch {
          /* ignore */
        }
        Alert.alert("Error", msg);
        return;
      }

      const data = await response.json();
      const saved = { id: Number(data.id), name: String(data.name || "") };
      setCategories((prev) =>
        isEdit
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name))
      );
      setIsCategoryModalOpen(false);
      setSelectedCategory(null);
      setCategoryDraftName("");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to save category.");
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDeleteCategory = (category: Category) => {
    if (isMutating) return;
    setPendingDeleteCategory(category);
  };

  const deleteCategory = async (category: Category) => {
    if (!token) {
      Alert.alert("Error", "Not signed in.");
      return;
    }
    setIsMutating(true);
    try {
      const response = await fetch(`${API_URL}/service-categories/${category.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (!response.ok) {
        let msg = "Failed to delete category.";
        try {
          const err = await response.json();
          msg = extractApiErrorMessage(err, msg);
        } catch {
          /* ignore */
        }
        Alert.alert("Error", msg);
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setPendingDeleteCategory(null);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to delete category.");
    } finally {
      setIsMutating(false);
    }
  };

  const confirmDeleteService = (service: Service) => {
    if (isMutating) return;
    setPendingDeleteService(service);
  };

  const deleteService = async (service: Service) => {
    if (!token) {
      Alert.alert("Error", "Not signed in.");
      return;
    }
    setIsMutating(true);
    try {
      const response = await fetch(`${API_URL}/service-prices/${service.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        let msg = "Failed to delete service.";
        try {
          const err = await response.json();
          if (err?.message) msg = typeof err.message === "string" ? err.message : msg;
        } catch {
          /* ignore */
        }
        Alert.alert("Error", msg);
        return;
      }

      setServices((prev) => prev.filter((s) => s.id !== service.id));
      setPendingDeleteService(null);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to delete service.");
    } finally {
      setIsMutating(false);
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
  
  const handleLogout = async () => {
    setOpen(false);
    await logout();
    router.replace("/(openingApps)/login");
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
          <View style={styles.sectionSegmentWrap}>
            <Text style={styles.sectionSegmentLabel}>Manage</Text>
            <View style={styles.sectionSegmentRow}>
              {(
                [
                  ["services", "Services"],
                  ["additional", "Additional Charges"],
                  ["categories", "Category"],
                ] as const
              ).map(([key, label]) => {
                const active = priceSectionTab === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.sectionSegmentChip, active && styles.sectionSegmentChipActive]}
                    onPress={() => onSelectPriceSection(key)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.sectionSegmentChipText, active && styles.sectionSegmentChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* List Header */}
          <View style={styles.listHeader}>
            <View style={styles.listHeaderLeft}>
              <Text style={styles.listHeaderTitle}>
                {priceSectionTab === "services"
                  ? "Service pricing"
                  : priceSectionTab === "additional"
                    ? "Additional charges"
                    : "Service categories"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={openCreateModal}
              style={[styles.createButton, isMutating && styles.buttonDisabled]}
              disabled={isMutating}
            >
              <Text style={styles.createButtonText}>+ Create</Text>
            </TouchableOpacity>
          </View>

          {loadError ? (
            <View style={styles.loadErrorBanner}>
              <Text style={styles.loadErrorText}>{loadError}</Text>
              <TouchableOpacity style={styles.loadRetryBtn} onPress={() => loadServices()} activeOpacity={0.85}>
                <Text style={styles.loadRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {isLoadingPrices && services.length === 0 && !loadError ? (
            <View style={styles.listLoadingBox}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.listLoadingText}>Loading prices…</Text>
            </View>
          ) : null}

          {/* Services / Categories List */}
          <View style={styles.servicesList}>
            {!isLoadingPrices &&
            !loadError &&
            ((priceSectionTab === "categories" && categories.length === 0) ||
              (priceSectionTab !== "categories" && displayedRows.length === 0)) ? (
              <View style={styles.emptyTabState}>
                <Text style={styles.emptyTabTitle}>
                  {priceSectionTab === "services"
                    ? "No services yet"
                    : priceSectionTab === "additional"
                      ? "No additional charges"
                      : "No categories yet"}
                </Text>
                <Text style={styles.emptyTabSubtitle}>
                  {priceSectionTab === "services"
                    ? "Create a service or pull to refresh after the server adds defaults."
                    : priceSectionTab === "additional"
                      ? "Additional charges use category “Misc” (e.g. penalty fees). They appear here."
                      : "Add categories in the Category tab first, then assign them when creating a service."}
                </Text>
              </View>
            ) : null}
            {priceSectionTab === "categories"
              ? categories.map((category) => (
                  <View key={category.id} style={styles.serviceCard}>
                    <View style={styles.serviceHeader}>
                      <View style={styles.serviceHeaderTop}>
                        <View style={styles.serviceInfo}>
                          <Text style={styles.serviceName}>{category.name}</Text>
                        </View>
                      </View>
                      <View style={styles.serviceActions}>
                        <TouchableOpacity
                          onPress={() => confirmDeleteCategory(category)}
                          style={[styles.deleteServiceBtn, isMutating && styles.buttonDisabled]}
                          disabled={isMutating}
                        >
                          <Ionicons name="trash-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openEditCategoryModal(category)}
                          style={[styles.editButton, isMutating && styles.buttonDisabled]}
                          disabled={isMutating}
                        >
                          <Ionicons name="create-outline" size={20} color="#fff" />
                          <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              : displayedRows.map((service) => (
              <View key={service.id} style={styles.serviceCard}>
                {/* Title row: image + text use full width; actions on separate row to avoid squeezed text */}
                <View style={styles.serviceHeader}>
                  <View style={styles.serviceHeaderTop}>
                    {!isAdditionalChargeService(service) ? (
                      <View style={styles.serviceThumbWrap}>
                        {service.imageUrl ? (
                          <Image
                            source={{ uri: service.imageUrl }}
                            style={styles.serviceThumb}
                            contentFit="cover"
                            transition={200}
                          />
                        ) : (
                          <View style={styles.serviceThumbPlaceholder}>
                            <Ionicons name="image-outline" size={28} color="#94a3b8" />
                          </View>
                        )}
                      </View>
                    ) : null}
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      {!isAdditionalChargeService(service) ? (
                        <Text style={styles.serviceCategory}>{service.category}</Text>
                      ) : null}
                      {!isAdditionalChargeService(service) ? (
                        <Text style={styles.serviceCategory}>Unit: {service.unit}</Text>
                      ) : null}
                      {service.effectiveDate && (
                        <View style={styles.effectiveDateBadge}>
                          <Text style={styles.effectiveDateText}>
                            Effective: {new Date(service.effectiveDate).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.serviceActions}>
                    <TouchableOpacity
                      onPress={() => confirmDeleteService(service)}
                      style={[styles.deleteServiceBtn, isMutating && styles.buttonDisabled]}
                      disabled={isMutating}
                    >
                      <Ionicons name="trash-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleEditService(service)}
                      style={[styles.editButton, isMutating && styles.buttonDisabled]}
                      disabled={isMutating}
                    >
                      <Ionicons name="create-outline" size={20} color="#fff" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Tiers */}
                <View style={styles.tiersContainer}>
                  {service.tiers.map((tier, tierIndex) => (
                    <View key={tierIndex} style={styles.tierItem}>
                      <View style={styles.tierInfo}>
                        {isAdditionalChargeService(service) &&
                        (tier.range === "—" || tier.range === "-" || !String(tier.range || "").trim()) ? null : (
                          <Text style={styles.tierRange}>{tier.range}</Text>
                        )}
                        <Text style={styles.tierDescription}>{parseExtraChargeDescription(tier.description).description}</Text>
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
                onPress={() => {
                  setConfirmKind(null);
                  setPendingEffectiveDate(null);
                  setEditImageUri(null);
                  setEditRemoveImage(false);
                  setIsEditCategoryPickerOpen(false);
                  setIsEditModalOpen(false);
                }}
                style={styles.closeButton}
                disabled={isMutating}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            <ScrollView style={styles.modalBody}>
              {selectedService && isAdditionalChargeService(selectedService) ? (
                <>
                  <View style={styles.tierEditCard}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Extra Charges Name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Penalty"
                        value={editedName}
                        onChangeText={setEditedName}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Type</Text>
                      <View style={styles.roleRow}>
                        {(["fixed", "incremental"] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.roleChip, editedAdditionalType === t && styles.roleChipActive]}
                            onPress={() => setEditedAdditionalType(t)}
                          >
                            <Text style={[styles.roleChipText, editedAdditionalType === t && styles.roleChipTextActive]}>
                              {t === "fixed" ? "Fixed" : "Incremental"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Price * (₱)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        value={editedTiers[0] ? editedTiers[0].price.toString() : ""}
                        onChangeText={(text) => handleUpdatePrice(0, "price", text)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Description</Text>
                      <TextInput
                        style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
                        placeholder="Optional details"
                        value={editedTiers[0]?.description ?? ""}
                        onChangeText={(text) => handleUpdatePrice(0, "description", text)}
                        multiline
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.tierEditCard}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Service name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Service name"
                        value={editedName}
                        onChangeText={setEditedName}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Category</Text>
                    <TouchableOpacity
                      style={styles.categoryPickerBtn}
                      onPress={() => setIsEditCategoryPickerOpen((v) => !v)}
                    >
                      <Text style={styles.categoryPickerBtnText}>{editedCategory || "Select category"}</Text>
                      <Ionicons name="chevron-down-outline" size={18} color="#475569" />
                    </TouchableOpacity>
                    {isEditCategoryPickerOpen ? (
                      <View style={styles.categoryPickerMenu}>
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={styles.categoryPickerItem}
                            onPress={() => {
                              setEditedCategory(cat.name);
                              setIsEditCategoryPickerOpen(false);
                            }}
                          >
                            <Text style={styles.categoryPickerItemText}>{cat.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Item unit</Text>
                      <View style={styles.roleRow}>
                        {(["kg", "per piece"] as const).map((u) => (
                          <TouchableOpacity
                            key={u}
                            style={[styles.roleChip, editedUnit === u && styles.roleChipActive]}
                            onPress={() => setEditedUnit(u)}
                          >
                            <Text style={[styles.roleChipText, editedUnit === u && styles.roleChipTextActive]}>
                              {u}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <Text style={[styles.inputLabel, { marginTop: 4 }]}>Photo</Text>
                    <View style={styles.imagePickRow}>
                      {editImageUri ? (
                        <Image source={{ uri: editImageUri.uri }} style={styles.editImagePreview} contentFit="cover" />
                      ) : selectedService?.imageUrl && !editRemoveImage ? (
                        <Image
                          source={{ uri: selectedService.imageUrl }}
                          style={styles.editImagePreview}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.editImagePlaceholder}>
                          <Ionicons name="image-outline" size={36} color="#94a3b8" />
                        </View>
                      )}
                      <View style={styles.imagePickActions}>
                        <TouchableOpacity
                          style={styles.secondaryOutlineBtn}
                          onPress={async () => {
                            const uri = await pickServiceImage();
                            if (uri) {
                              setEditImageUri(uri);
                              setEditRemoveImage(false);
                            }
                          }}
                        >
                          <Text style={styles.secondaryOutlineBtnText}>
                            {editImageUri || (selectedService?.imageUrl && !editRemoveImage)
                              ? "Change photo"
                              : "Add photo"}
                          </Text>
                        </TouchableOpacity>
                        {selectedService?.imageUrl && !editImageUri && !editRemoveImage ? (
                          <TouchableOpacity
                            style={styles.secondaryOutlineBtnDanger}
                            onPress={() => {
                              setEditRemoveImage(true);
                              setEditImageUri(null);
                            }}
                          >
                            <Text style={styles.secondaryOutlineBtnDangerText}>Remove photo</Text>
                          </TouchableOpacity>
                        ) : null}
                        {editImageUri ? (
                          <TouchableOpacity
                            style={styles.secondaryOutlineBtnDanger}
                            onPress={() => setEditImageUri(null)}
                          >
                            <Text style={styles.secondaryOutlineBtnDangerText}>Discard new photo</Text>
                          </TouchableOpacity>
                        ) : null}
                        {editRemoveImage && !editImageUri ? (
                          <TouchableOpacity
                            style={styles.secondaryOutlineBtn}
                            onPress={() => setEditRemoveImage(false)}
                          >
                            <Text style={styles.secondaryOutlineBtnText}>Undo remove</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>

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
                          onChangeText={(text) => handleUpdatePrice(index, "range", text)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Price (₱)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter price"
                          value={tier.price.toString()}
                          onChangeText={(text) => handleUpdatePrice(index, "price", text)}
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter description"
                          value={tier.description}
                          onChangeText={(text) => handleUpdatePrice(index, "description", text)}
                        />
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity onPress={handleAddTier} style={styles.addTierButton}>
                    <Text style={styles.addTierButtonText}>+ Add Tier</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setConfirmKind(null);
                  setPendingEffectiveDate(null);
                  setEditImageUri(null);
                  setEditRemoveImage(false);
                  setIsEditCategoryPickerOpen(false);
                  setIsEditModalOpen(false);
                }}
                style={[styles.footerButton, styles.cancelButton]}
                disabled={isMutating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveChanges}
                style={[styles.footerButton, styles.saveButton, isMutating && styles.buttonDisabled]}
                disabled={isMutating}
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
              <Text style={styles.modalTitle}>
                {createForAdditional ? "Create additional charge" : "Create new service"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setConfirmKind(null);
                  setCreateForAdditional(false);
                  setCreateImageUri(null);
                  setAdditionalChargeDraft({ name: "", type: "fixed", price: "", description: "" });
                  setIsCreateCategoryPickerOpen(false);
                  setIsCreateModalOpen(false);
                }}
                style={styles.closeButton}
                disabled={isMutating}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Modal Body — bounded height so "+ Add Tier" stays fully scrollable above the footer */}
            <ScrollView
              style={[styles.modalBody, { maxHeight: CREATE_SERVICE_SCROLL_MAX_H }]}
              contentContainerStyle={styles.createModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {createForAdditional ? (
                <>
                  <View style={styles.tierEditCard}>
                    <Text style={styles.sectionTitle}>Details</Text>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Extra Charges Name *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Rush fee"
                        value={additionalChargeDraft.name}
                        onChangeText={(text) =>
                          setAdditionalChargeDraft((d) => ({ ...d, name: text }))
                        }
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Type</Text>
                      <View style={styles.roleRow}>
                        {(["fixed", "incremental"] as const).map((t) => (
                          <TouchableOpacity
                            key={t}
                            style={[styles.roleChip, additionalChargeDraft.type === t && styles.roleChipActive]}
                            onPress={() => setAdditionalChargeDraft((d) => ({ ...d, type: t }))}
                          >
                            <Text style={[styles.roleChipText, additionalChargeDraft.type === t && styles.roleChipTextActive]}>
                              {t === "fixed" ? "Fixed" : "Incremental"}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Price * (₱)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="0.00"
                        value={additionalChargeDraft.price}
                        onChangeText={(text) =>
                          setAdditionalChargeDraft((d) => ({ ...d, price: text }))
                        }
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Description</Text>
                      <TextInput
                        style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
                        placeholder="Optional details"
                        value={additionalChargeDraft.description}
                        onChangeText={(text) =>
                          setAdditionalChargeDraft((d) => ({ ...d, description: text }))
                        }
                        multiline
                      />
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.tierEditCard}>
                    <Text style={styles.sectionTitle}>Photo (optional)</Text>
                    <View style={styles.imagePickRow}>
                      {createImageUri ? (
                        <Image source={{ uri: createImageUri.uri }} style={styles.editImagePreview} contentFit="cover" />
                      ) : (
                        <View style={styles.editImagePlaceholder}>
                          <Ionicons name="image-outline" size={36} color="#94a3b8" />
                        </View>
                      )}
                      <View style={styles.imagePickActions}>
                        <TouchableOpacity
                          style={styles.secondaryOutlineBtn}
                          onPress={async () => {
                            const uri = await pickServiceImage();
                            if (uri) setCreateImageUri(uri);
                          }}
                        >
                          <Text style={styles.secondaryOutlineBtnText}>
                            {createImageUri ? "Change photo" : "Choose photo"}
                          </Text>
                        </TouchableOpacity>
                        {createImageUri ? (
                          <TouchableOpacity
                            style={styles.secondaryOutlineBtnDanger}
                            onPress={() => setCreateImageUri(null)}
                          >
                            <Text style={styles.secondaryOutlineBtnDangerText}>Remove</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Service name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Enter service name"
                      value={newService.name}
                      onChangeText={(text) => setNewService({ ...newService, name: text })}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Category</Text>
                    <TouchableOpacity
                      style={styles.categoryPickerBtn}
                      onPress={() => setIsCreateCategoryPickerOpen((v) => !v)}
                    >
                      <Text style={styles.categoryPickerBtnText}>{newService.category || "Select category"}</Text>
                      <Ionicons name="chevron-down-outline" size={18} color="#475569" />
                    </TouchableOpacity>
                    {isCreateCategoryPickerOpen ? (
                      <View style={styles.categoryPickerMenu}>
                        {categories.map((cat) => (
                          <TouchableOpacity
                            key={cat.id}
                            style={styles.categoryPickerItem}
                            onPress={() => {
                              setNewService({ ...newService, category: cat.name });
                              setIsCreateCategoryPickerOpen(false);
                            }}
                          >
                            <Text style={styles.categoryPickerItemText}>{cat.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Item unit</Text>
                    <View style={styles.roleRow}>
                      {(["kg", "per piece"] as const).map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.roleChip, newService.unit === u && styles.roleChipActive]}
                          onPress={() => setNewService({ ...newService, unit: u })}
                        >
                          <Text style={[styles.roleChipText, newService.unit === u && styles.roleChipTextActive]}>
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
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
                          onChangeText={(text) => handleNewServiceTierUpdate(index, "range", text)}
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Price * (₱)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter price"
                          value={tier.price.toString()}
                          onChangeText={(text) => handleNewServiceTierUpdate(index, "price", text)}
                          keyboardType="numeric"
                        />
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Description</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Enter description"
                          value={tier.description}
                          onChangeText={(text) => handleNewServiceTierUpdate(index, "description", text)}
                        />
                      </View>
                    </View>
                  ))}

                  <TouchableOpacity
                    onPress={handleAddNewServiceTier}
                    style={[styles.addTierButton, styles.addTierButtonCreate]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.addTierButtonText}>+ Add Tier</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setConfirmKind(null);
                  setCreateForAdditional(false);
                  setCreateImageUri(null);
                  setAdditionalChargeDraft({ name: "", type: "fixed", price: "", description: "" });
                  setIsCreateCategoryPickerOpen(false);
                  setIsCreateModalOpen(false);
                }}
                style={[styles.footerButton, styles.cancelButton]}
                disabled={isMutating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateService}
                style={[styles.footerButton, styles.saveButton, isMutating && styles.buttonDisabled]}
                disabled={isMutating}
              >
                <Text style={styles.saveButtonText}>
                  {createForAdditional ? "Create Charge" : "Create service"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category create/edit modal */}
      <Modal visible={isCategoryModalOpen} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedCategory ? "Edit category" : "Create category"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsCategoryModalOpen(false);
                  setSelectedCategory(null);
                  setCategoryDraftName("");
                }}
                style={styles.closeButton}
                disabled={isMutating}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter category name"
                  value={categoryDraftName}
                  onChangeText={setCategoryDraftName}
                />
              </View>
            </View>
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setIsCategoryModalOpen(false);
                  setSelectedCategory(null);
                  setCategoryDraftName("");
                }}
                style={[styles.footerButton, styles.cancelButton]}
                disabled={isMutating}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitCategory}
                style={[styles.footerButton, styles.saveButton, isMutating && styles.buttonDisabled]}
                disabled={isMutating}
              >
                <Text style={styles.saveButtonText}>{selectedCategory ? "Save" : "Create"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm price change / create (blocks duplicate submits while saving) */}
      <Modal visible={confirmKind !== null} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {confirmKind === "edit"
                ? "Confirm price update"
                : createForAdditional
                  ? "Confirm additional charge"
                  : "Confirm new service"}
            </Text>
            {confirmKind === "edit" && pendingEffectiveDate ? (
              <Text style={styles.confirmMessage}>
                New prices will be effective on{" "}
                {pendingEffectiveDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
                {"\n\n"}(7 days from now){"\n\n"}Apply this change to the server?
              </Text>
            ) : null}
            {confirmKind === "edit" && !pendingEffectiveDate ? (
              <Text style={styles.confirmMessage}>Apply these changes on the server?</Text>
            ) : null}
            {confirmKind === "create" ? (
              <Text style={styles.confirmMessage}>
                {createForAdditional
                  ? `${additionalChargeDraft.name.trim()} · ${additionalChargeDraft.type === "fixed" ? "Fixed" : "Incremental"} · ₱${(parseFloat(additionalChargeDraft.price) || 0).toFixed(2)}`
                  : `${newService.name} · ${newService.category.trim() || "—"} · ${newService.tiers.length} tier(s).`}
                {"\n\n"}
                {createForAdditional
                  ? "Create this additional charge on the server?"
                  : "Create this service on the server?"}
              </Text>
            ) : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtnSecondary, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (!isMutating) setConfirmKind(null);
                }}
                disabled={isMutating}
              >
                <Text style={styles.confirmBtnSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnPrimary, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (confirmKind === "edit") submitEditAfterConfirm();
                  else if (confirmKind === "create") submitCreateAfterConfirm();
                }}
                disabled={isMutating}
              >
                {isMutating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnPrimaryText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm delete for service/additional charge */}
      <Modal visible={pendingDeleteService !== null} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>
              {pendingDeleteService && isAdditionalChargeService(pendingDeleteService)
                ? "Delete additional charge"
                : "Delete service"}
            </Text>
            <Text style={styles.confirmMessage}>
              {pendingDeleteService
                ? `Remove "${pendingDeleteService.name}" from the server? This cannot be undone.`
                : ""}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtnSecondary, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (!isMutating) setPendingDeleteService(null);
                }}
                disabled={isMutating}
              >
                <Text style={styles.confirmBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnDanger, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (pendingDeleteService) void deleteService(pendingDeleteService);
                }}
                disabled={isMutating}
              >
                {isMutating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnPrimaryText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm delete for category */}
      <Modal visible={pendingDeleteCategory !== null} animationType="fade" transparent>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete category</Text>
            <Text style={styles.confirmMessage}>
              {pendingDeleteCategory
                ? `Delete "${pendingDeleteCategory.name}"? This cannot be undone.`
                : ""}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmBtnSecondary, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (!isMutating) setPendingDeleteCategory(null);
                }}
                disabled={isMutating}
              >
                <Text style={styles.confirmBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtnDanger, isMutating && styles.buttonDisabled]}
                onPress={() => {
                  if (pendingDeleteCategory) void deleteCategory(pendingDeleteCategory);
                }}
                disabled={isMutating}
              >
                {isMutating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnPrimaryText}>Delete</Text>
                )}
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
  sectionSegmentWrap: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sectionSegmentLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 10,
  },
  sectionSegmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  sectionSegmentChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionSegmentChipActive: {
    backgroundColor: "#3b82f6",
  },
  sectionSegmentChipText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  sectionSegmentChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  emptyTabState: {
    paddingVertical: 24,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  emptyTabTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyTabSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
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
  buttonDisabled: {
    opacity: 0.55,
  },
  loadErrorBanner: {
    padding: 20,
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  loadErrorText: {
    color: "#991b1b",
    fontWeight: "600",
    marginBottom: 12,
  },
  loadRetryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  loadRetryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  listLoadingBox: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  listLoadingText: {
    color: "#64748b",
    fontWeight: "600",
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
    marginBottom: 14,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 14,
  },
  /** Image + title row: full width so text wraps at words, not one character per line */
  serviceHeaderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  serviceThumbWrap: {
    flexShrink: 0,
  },
  serviceThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  serviceThumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  serviceActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexShrink: 0,
  },
  deleteServiceBtn: {
    backgroundColor: "#ef4444",
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  serviceInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 4,
  },
  serviceName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
    lineHeight: 26,
  },
  serviceCategory: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 8,
    lineHeight: 20,
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
    alignItems: "center",
    backgroundColor: '#3b82f6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  tiersContainer: {
    gap: 10,
  },
  tierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 14,
  },
  tierInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  tierRange: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 22,
  },
  tierDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
    flexShrink: 0,
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
  createModalScrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
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
  /** Create modal: taller tap target + spacing so the control is not clipped by the sheet/footer */
  addTierButtonCreate: {
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 18,
    minHeight: 54,
    justifyContent: 'center',
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
  categoryPickerBtn: {
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryPickerBtnText: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
  },
  categoryPickerMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  categoryPickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  categoryPickerItemText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "600",
  },
  imagePickRow: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginTop: 4,
  },
  editImagePreview: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  editImagePlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickActions: {
    flex: 1,
    gap: 8,
  },
  secondaryOutlineBtn: {
    borderWidth: 2,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  secondaryOutlineBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3b82f6",
  },
  secondaryOutlineBtnDanger: {
    borderWidth: 2,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fef2f2",
    alignItems: "center",
  },
  secondaryOutlineBtnDangerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#b91c1c",
  },
  miscCategoryBadge: {
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  miscCategoryBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  miscCategoryHint: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 4,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 16,
  },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  roleChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  roleChipActive: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  roleChipText: { fontWeight: "700", color: "#64748b", textTransform: "capitalize" },
  roleChipTextActive: { color: "#1d4ed8" },
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
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    alignSelf: "center",
    width: "100%",
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  confirmMessage: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
    marginBottom: 20,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 12,
  },
  confirmBtnSecondary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#e2e8f0",
  },
  confirmBtnSecondaryText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 16,
  },
  confirmBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#22c55e",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  confirmBtnDanger: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
  },
  confirmBtnPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});

export default LaundryPriceManager;