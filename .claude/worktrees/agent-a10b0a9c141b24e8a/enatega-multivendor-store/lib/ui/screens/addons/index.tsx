import { useQuery, useMutation } from "@apollo/client";
import * as SecureStore from "../../../utils/safeSecureStore";
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApptheme } from "@/lib/context/theme.context";
import { GET_RESTAURANT_MENU } from "@/lib/api/graphql/query/restaurant";
import {
  STOR_CREATE_OPTIONS,
  STOR_EDIT_OPTION,
  STOR_DELETE_OPTION,
  STOR_CREATE_ADDONS,
  STOR_EDIT_ADDON,
  STOR_DELETE_ADDON,
} from "@/lib/api/graphql/mutation/catalog";
import { useTranslation } from "react-i18next";

interface Option {
  _id: string;
  title: string;
  description?: string;
  price?: number;
}

interface Addon {
  _id: string;
  title: string;
  description?: string;
  quantityMinimum?: number;
  quantityMaximum?: number;
  options?: string[]; // option IDs
}

type Tab = "options" | "addons";

export default function AddonsScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("options");

  // Option form state
  const [showAddOption, setShowAddOption] = useState(false);
  const [editingOption, setEditingOption] = useState<Option | null>(null);
  const [optionForm, setOptionForm] = useState({ title: "", description: "", price: "" });

  // Addon form state
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);
  const [addonForm, setAddonForm] = useState({ title: "", description: "", quantityMinimum: "0", quantityMaximum: "1" });
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);

  useEffect(() => {
    SecureStore.getItemAsync("store-id").then((id) => setRestaurantId(id));
  }, []);

  const { data, loading, refetch } = useQuery(GET_RESTAURANT_MENU, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const options: Option[] = data?.restaurant?.options ?? [];
  const addons: Addon[] = data?.restaurant?.addons ?? [];

  const onDone = () => refetch();
  const onError = (e: { message: string }) => Alert.alert("Erreur", e.message);

  const [createOption, { loading: creatingOption }] = useMutation(STOR_CREATE_OPTIONS, { onCompleted: onDone, onError });
  const [editOption, { loading: savingOption }] = useMutation(STOR_EDIT_OPTION, { onCompleted: onDone, onError });
  const [deleteOption] = useMutation(STOR_DELETE_OPTION, { onCompleted: onDone, onError });
  const [createAddon, { loading: creatingAddon }] = useMutation(STOR_CREATE_ADDONS, { onCompleted: onDone, onError });
  const [editAddon, { loading: savingAddon }] = useMutation(STOR_EDIT_ADDON, { onCompleted: onDone, onError });
  const [deleteAddon] = useMutation(STOR_DELETE_ADDON, { onCompleted: onDone, onError });

  const inputStyle = {
    borderWidth: 1,
    borderColor: appTheme.borderLineColor,
    borderRadius: 8,
    padding: 10,
    color: appTheme.fontMainColor,
    backgroundColor: appTheme.themeBackground,
    marginBottom: 8,
  } as const;

  // ── Option handlers ────────────────────────────────────────────────────────

  const resetOptionForm = () => {
    setOptionForm({ title: "", description: "", price: "" });
    setShowAddOption(false);
    setEditingOption(null);
  };

  const handleSaveOption = () => {
    if (!optionForm.title.trim() || !restaurantId) return;
    const price = parseFloat(optionForm.price) || 0;
    if (editingOption) {
      editOption({
        variables: {
          option: {
            _id: editingOption._id,
            restaurant: restaurantId,
            title: optionForm.title.trim(),
            description: optionForm.description.trim() || undefined,
            price,
          },
        },
      });
    } else {
      createOption({
        variables: {
          options: {
            restaurant: restaurantId,
            options: [{ title: optionForm.title.trim(), description: optionForm.description.trim() || undefined, price }],
          },
        },
      });
    }
    resetOptionForm();
  };

  const openEditOption = (opt: Option) => {
    setEditingOption(opt);
    setOptionForm({ title: opt.title, description: opt.description ?? "", price: opt.price != null ? String(opt.price) : "" });
    setShowAddOption(true);
  };

  const confirmDeleteOption = (id: string) => {
    Alert.alert(t("Delete") || "Supprimer", t("confirmDelete") || "Confirmer la suppression ?", [
      { text: t("Cancel") || "Annuler", style: "cancel" },
      { text: t("Delete") || "Supprimer", style: "destructive", onPress: () => deleteOption({ variables: { id } }) },
    ]);
  };

  // ── Addon handlers ─────────────────────────────────────────────────────────

  const resetAddonForm = () => {
    setAddonForm({ title: "", description: "", quantityMinimum: "0", quantityMaximum: "1" });
    setSelectedOptionIds([]);
    setShowAddAddon(false);
    setEditingAddon(null);
  };

  const handleSaveAddon = () => {
    if (!addonForm.title.trim() || !restaurantId) return;
    const base = {
      title: addonForm.title.trim(),
      description: addonForm.description.trim() || undefined,
      quantityMinimum: parseInt(addonForm.quantityMinimum) || 0,
      quantityMaximum: parseInt(addonForm.quantityMaximum) || 1,
      options: selectedOptionIds,
    };
    if (editingAddon) {
      editAddon({
        variables: { addons: { restaurant: restaurantId, addons: { _id: editingAddon._id, ...base } } },
      });
    } else {
      createAddon({
        variables: { addons: { restaurant: restaurantId, addons: [base] } },
      });
    }
    resetAddonForm();
  };

  const openEditAddon = (addon: Addon) => {
    setEditingAddon(addon);
    setAddonForm({
      title: addon.title,
      description: addon.description ?? "",
      quantityMinimum: String(addon.quantityMinimum ?? 0),
      quantityMaximum: String(addon.quantityMaximum ?? 1),
    });
    setSelectedOptionIds(addon.options ?? []);
    setShowAddAddon(true);
  };

  const confirmDeleteAddon = (id: string) => {
    Alert.alert(t("Delete") || "Supprimer", t("confirmDelete") || "Confirmer la suppression ?", [
      { text: t("Cancel") || "Annuler", style: "cancel" },
      { text: t("Delete") || "Supprimer", style: "destructive", onPress: () => deleteAddon({ variables: { id } }) },
    ]);
  };

  const toggleOptionSelection = (id: string) => {
    setSelectedOptionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: appTheme.themeBackground }}>
        <ActivityIndicator color={appTheme.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: appTheme.themeBackground }}>
      {/* Tab bar */}
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: appTheme.borderLineColor }}>
        {(["options", "addons"] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={{
              flex: 1,
              paddingVertical: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab ? appTheme.primary : "transparent",
            }}
            accessibilityRole="tab"
            accessibilityLabel={t(tab === "options" ? "Options" : "Addons") || tab}
          >
            <Text style={{ color: activeTab === tab ? appTheme.primary : appTheme.fontSecondColor, fontWeight: "600" }}>
              {tab === "options" ? (t("Options") || "Options") : (t("Addons") || "Groupes suppléments")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {activeTab === "options" ? (
          <>
            {/* Add Option button */}
            <TouchableOpacity
              onPress={() => { resetOptionForm(); setShowAddOption(true); }}
              style={{ backgroundColor: appTheme.primary, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 }}
              accessibilityRole="button"
              accessibilityLabel={t("addOption") || "Ajouter une option"}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>+ {t("addOption") || "Ajouter une option"}</Text>
            </TouchableOpacity>

            {/* Option form */}
            {showAddOption && (
              <View style={{ borderWidth: 1, borderColor: appTheme.borderLineColor, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", marginBottom: 8 }}>
                  {editingOption ? (t("editOption") || "Modifier l'option") : (t("addOption") || "Nouvelle option")}
                </Text>
                <TextInput style={inputStyle} placeholder={t("title") || "Titre"} placeholderTextColor={appTheme.fontSecondColor} value={optionForm.title} onChangeText={(v) => setOptionForm({ ...optionForm, title: v })} accessibilityLabel="Title" />
                <TextInput style={inputStyle} placeholder={t("description") || "Description (optionnel)"} placeholderTextColor={appTheme.fontSecondColor} value={optionForm.description} onChangeText={(v) => setOptionForm({ ...optionForm, description: v })} accessibilityLabel="Description" />
                <TextInput style={inputStyle} placeholder={t("price") || "Prix"} placeholderTextColor={appTheme.fontSecondColor} value={optionForm.price} onChangeText={(v) => setOptionForm({ ...optionForm, price: v })} keyboardType="decimal-pad" accessibilityLabel="Price" />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TouchableOpacity onPress={handleSaveOption} disabled={creatingOption || savingOption} style={{ flex: 1, backgroundColor: appTheme.primary, borderRadius: 8, padding: 10, alignItems: "center" }} accessibilityRole="button">
                    {creatingOption || savingOption ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={resetOptionForm} style={{ flex: 1, backgroundColor: appTheme.borderLineColor, borderRadius: 8, padding: 10, alignItems: "center" }} accessibilityRole="button">
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{t("Cancel") || "Annuler"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Options list */}
            {options.length === 0 ? (
              <Text style={{ color: appTheme.fontSecondColor, textAlign: "center", marginTop: 32 }}>
                {t("noOptions") || "Aucune option. Ajoutez des options pour les utiliser dans vos groupes de suppléments."}
              </Text>
            ) : (
              options.map((opt) => (
                <View key={opt._id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderColor: appTheme.borderLineColor }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{opt.title}</Text>
                    {opt.description ? <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>{opt.description}</Text> : null}
                    <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>{opt.price != null ? `${opt.price.toFixed(2)} DT` : "Gratuit"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity onPress={() => openEditOption(opt)} style={{ backgroundColor: "#EFF6FF", borderRadius: 6, padding: 8 }} accessibilityRole="button" accessibilityLabel="Edit"><Text style={{ color: "#2563EB" }}>✎</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDeleteOption(opt._id)} style={{ backgroundColor: "#FEE2E2", borderRadius: 6, padding: 8 }} accessibilityRole="button" accessibilityLabel="Delete"><Text style={{ color: "#DC2626" }}>✕</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            {/* Add Addon button */}
            <TouchableOpacity
              onPress={() => { resetAddonForm(); setShowAddAddon(true); }}
              style={{ backgroundColor: appTheme.primary, borderRadius: 8, padding: 12, alignItems: "center", marginBottom: 16 }}
              accessibilityRole="button"
              accessibilityLabel={t("addAddon") || "Ajouter un groupe"}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>+ {t("addAddon") || "Ajouter un groupe"}</Text>
            </TouchableOpacity>

            {/* Addon form */}
            {showAddAddon && (
              <View style={{ borderWidth: 1, borderColor: appTheme.borderLineColor, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", marginBottom: 8 }}>
                  {editingAddon ? (t("editAddon") || "Modifier le groupe") : (t("addAddon") || "Nouveau groupe")}
                </Text>
                <TextInput style={inputStyle} placeholder={t("title") || "Titre du groupe"} placeholderTextColor={appTheme.fontSecondColor} value={addonForm.title} onChangeText={(v) => setAddonForm({ ...addonForm, title: v })} accessibilityLabel="Title" />
                <TextInput style={inputStyle} placeholder={t("description") || "Description (optionnel)"} placeholderTextColor={appTheme.fontSecondColor} value={addonForm.description} onChangeText={(v) => setAddonForm({ ...addonForm, description: v })} accessibilityLabel="Description" />
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginBottom: 4 }}>{t("minQty") || "Qté min"}</Text>
                    <TextInput style={inputStyle} value={addonForm.quantityMinimum} onChangeText={(v) => setAddonForm({ ...addonForm, quantityMinimum: v })} keyboardType="number-pad" accessibilityLabel="Min quantity" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginBottom: 4 }}>{t("maxQty") || "Qté max"}</Text>
                    <TextInput style={inputStyle} value={addonForm.quantityMaximum} onChangeText={(v) => setAddonForm({ ...addonForm, quantityMaximum: v })} keyboardType="number-pad" accessibilityLabel="Max quantity" />
                  </View>
                </View>

                {/* Option selector */}
                {options.length > 0 && (
                  <>
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", marginBottom: 8 }}>{t("selectOptions") || "Sélectionner les options"}</Text>
                    {options.map((opt) => (
                      <TouchableOpacity
                        key={opt._id}
                        onPress={() => toggleOptionSelection(opt._id)}
                        style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: appTheme.borderLineColor + "44" }}
                        accessibilityRole="checkbox"
                        accessibilityLabel={opt.title}
                        accessibilityState={{ checked: selectedOptionIds.includes(opt._id) }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: appTheme.primary, backgroundColor: selectedOptionIds.includes(opt._id) ? appTheme.primary : "transparent", marginRight: 10, justifyContent: "center", alignItems: "center" }}>
                          {selectedOptionIds.includes(opt._id) && <Text style={{ color: "white", fontSize: 12, fontWeight: "bold" }}>✓</Text>}
                        </View>
                        <Text style={{ color: appTheme.fontMainColor, flex: 1 }}>{opt.title}</Text>
                        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>{opt.price != null ? `${opt.price.toFixed(2)} DT` : "Gratuit"}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {options.length === 0 && (
                  <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginBottom: 8 }}>
                    {t("createOptionsFirst") || "Créez d'abord des options dans l'onglet Options."}
                  </Text>
                )}

                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity onPress={handleSaveAddon} disabled={creatingAddon || savingAddon} style={{ flex: 1, backgroundColor: appTheme.primary, borderRadius: 8, padding: 10, alignItems: "center" }} accessibilityRole="button">
                    {creatingAddon || savingAddon ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={resetAddonForm} style={{ flex: 1, backgroundColor: appTheme.borderLineColor, borderRadius: 8, padding: 10, alignItems: "center" }} accessibilityRole="button">
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{t("Cancel") || "Annuler"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Addons list */}
            {addons.length === 0 ? (
              <Text style={{ color: appTheme.fontSecondColor, textAlign: "center", marginTop: 32 }}>
                {t("noAddons") || "Aucun groupe de suppléments."}
              </Text>
            ) : (
              addons.map((addon) => {
                const addonOptions = options.filter((o) => (addon.options ?? []).includes(o._id));
                return (
                  <View key={addon._id} style={{ borderWidth: 1, borderColor: appTheme.borderLineColor, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: appTheme.fontMainColor, fontWeight: "700", fontSize: 15 }}>{addon.title}</Text>
                        {addon.description ? <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>{addon.description}</Text> : null}
                        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginTop: 2 }}>
                          {addon.quantityMinimum ?? 0} — {addon.quantityMaximum ?? 1} {t("choices") || "choix"}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TouchableOpacity onPress={() => openEditAddon(addon)} style={{ backgroundColor: "#EFF6FF", borderRadius: 6, padding: 8 }} accessibilityRole="button" accessibilityLabel="Edit"><Text style={{ color: "#2563EB" }}>✎</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDeleteAddon(addon._id)} style={{ backgroundColor: "#FEE2E2", borderRadius: 6, padding: 8 }} accessibilityRole="button" accessibilityLabel="Delete"><Text style={{ color: "#DC2626" }}>✕</Text></TouchableOpacity>
                      </View>
                    </View>
                    {addonOptions.length > 0 && (
                      <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: appTheme.borderLineColor + "44" }}>
                        {addonOptions.map((o) => (
                          <Text key={o._id} style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>
                            • {o.title}{o.price ? ` (+${o.price.toFixed(2)} DT)` : ""}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
