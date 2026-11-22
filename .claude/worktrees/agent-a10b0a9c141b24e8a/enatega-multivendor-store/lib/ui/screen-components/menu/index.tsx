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
  Image,
} from "react-native";
import { useApptheme } from "@/lib/context/theme.context";
import { GET_RESTAURANT_MENU } from "@/lib/api/graphql/query/restaurant";
import {
  STOR_CREATE_CATEGORY,
  STOR_EDIT_CATEGORY,
  STOR_DELETE_CATEGORY,
  STOR_CREATE_FOOD,
  STOR_EDIT_FOOD,
  STOR_DELETE_FOOD,
  STOR_UPDATE_FOOD_OUT_OF_STOCK,
} from "@/lib/api/graphql/mutation/catalog";
import { CREATE_CLOUDINARY_UPLOAD_SIGNATURE } from "@/lib/api/graphql/mutation/upload";
import { useTranslation } from "react-i18next";
import {
  pickCompressedImageUpload,
  uploadPreparedImageToCloudinary,
} from "@/lib/utils/methods/prepare-image-upload";

interface Variation {
  _id: string;
  title: string;
  price: number;
  discounted: number;
}

interface Food {
  _id: string;
  title: string;
  description?: string;
  image?: string;
  isOutOfStock: boolean;
  variations?: Variation[];
}

interface Category {
  _id: string;
  title: string;
  description?: string;
  foods: Food[];
}

interface FoodFormState {
  title: string;
  description: string;
  price: string;
  imageUri: string;  // local URI (before upload) or remote URL (after upload / existing)
}

const EMPTY_FOOD_FORM: FoodFormState = { title: "", description: "", price: "", imageUri: "" };

async function pickImage(): Promise<string | null> {
  const image = await pickCompressedImageUpload({ aspect: [1, 1] });
  return image?.uri ?? null;
}

export default function MenuScreen() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  // Category add form
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryTitle, setNewCategoryTitle] = useState("");

  // Category edit form
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryTitle, setEditCategoryTitle] = useState("");

  // Food add form
  const [selectedCategoryForAdd, setSelectedCategoryForAdd] = useState<string | null>(null);
  const [addFoodForm, setAddFoodForm] = useState<FoodFormState>(EMPTY_FOOD_FORM);

  // Food edit form
  const [editingFood, setEditingFood] = useState<{ foodId: string; categoryId: string } | null>(null);
  const [editFoodForm, setEditFoodForm] = useState<FoodFormState>(EMPTY_FOOD_FORM);
  const [editFoodVariationId, setEditFoodVariationId] = useState<string>("");

  // Image upload state
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("store-id").then((id) => setRestaurantId(id));
  }, []);

  const { data, loading, refetch } = useQuery(GET_RESTAURANT_MENU, {
    variables: { id: restaurantId },
    skip: !restaurantId,
    fetchPolicy: "cache-and-network",
  });

  const onCompleteRefetch = () => refetch();
  const onError = (e: { message: string }) => Alert.alert("Erreur", e.message);

  const [createCategory, { loading: creatingCategory }] = useMutation(STOR_CREATE_CATEGORY, {
    onCompleted: () => {
      onCompleteRefetch();
      setNewCategoryTitle("");
      setShowAddCategory(false);
    },
    onError,
  });

  const [editCategory, { loading: savingCategory }] = useMutation(STOR_EDIT_CATEGORY, {
    onCompleted: () => {
      onCompleteRefetch();
      setEditingCategoryId(null);
      setEditCategoryTitle("");
    },
    onError,
  });

  const [deleteCategory] = useMutation(STOR_DELETE_CATEGORY, {
    onCompleted: onCompleteRefetch,
    onError,
  });

  const [createFood, { loading: creatingFood }] = useMutation(STOR_CREATE_FOOD, {
    onCompleted: () => {
      onCompleteRefetch();
      setAddFoodForm(EMPTY_FOOD_FORM);
      setSelectedCategoryForAdd(null);
    },
    onError,
  });

  const [editFood, { loading: savingFood }] = useMutation(STOR_EDIT_FOOD, {
    onCompleted: () => {
      onCompleteRefetch();
      setEditingFood(null);
      setEditFoodForm(EMPTY_FOOD_FORM);
      setEditFoodVariationId("");
    },
    onError,
  });

  const [deleteFood] = useMutation(STOR_DELETE_FOOD, {
    onCompleted: onCompleteRefetch,
    onError,
  });

  const [updateOutOfStock] = useMutation(STOR_UPDATE_FOOD_OUT_OF_STOCK, {
    onCompleted: onCompleteRefetch,
    onError,
  });

  const [createUploadSignature] = useMutation(CREATE_CLOUDINARY_UPLOAD_SIGNATURE);

  // ── Image helpers ──────────────────────────────────────────────────────────

  const handlePickImage = async (
    setForm: (f: FoodFormState) => void,
    currentForm: FoodFormState
  ) => {
    const dataUri = await pickImage();
    if (!dataUri) return;
    setForm({ ...currentForm, imageUri: dataUri });
  };

  const resolveImageUrl = async (imageUri: string): Promise<string | undefined> => {
    if (!imageUri) return undefined;
    if (imageUri.startsWith("http")) return imageUri;
    // It's a local compressed file URI — upload it directly to Cloudinary.
    setUploadingImage(true);
    try {
      const signatureResult = await createUploadSignature();
      const signature = signatureResult.data?.createCloudinaryUploadSignature;
      if (!signature) throw new Error("Missing upload signature");

      return uploadPreparedImageToCloudinary(
        { uri: imageUri, name: "upload.jpg", type: "image/jpeg" },
        signature
      );
    } catch {
      Alert.alert("Erreur", "Image upload failed");
      return undefined;
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAddCategory = () => {
    if (!newCategoryTitle.trim() || !restaurantId) return;
    createCategory({
      variables: { category: { title: newCategoryTitle.trim(), restaurant: restaurantId } },
    });
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategoryId(cat._id);
    setEditCategoryTitle(cat.title);
  };

  const handleSaveCategory = () => {
    if (!editCategoryTitle.trim() || !editingCategoryId || !restaurantId) return;
    editCategory({
      variables: {
        category: { _id: editingCategoryId, title: editCategoryTitle.trim(), restaurant: restaurantId },
      },
    });
  };

  const handleDeleteCategory = (id: string) => {
    Alert.alert(
      t("deleteCategory") || "Supprimer la catégorie",
      t("confirmDeleteCategory") || "Voulez-vous supprimer cette catégorie?",
      [
        { text: t("Cancel") || "Annuler", style: "cancel" },
        { text: t("Delete") || "Supprimer", style: "destructive", onPress: () => deleteCategory({ variables: { id } }) },
      ]
    );
  };

  const handleAddFood = async (categoryId: string) => {
    const price = parseFloat(addFoodForm.price);
    if (!addFoodForm.title.trim() || isNaN(price) || !restaurantId) return;
    const image = await resolveImageUrl(addFoodForm.imageUri);
    createFood({
      variables: {
        food: {
          title: addFoodForm.title.trim(),
          description: addFoodForm.description.trim(),
          image,
          variations: [{ title: "Default", price, discounted: 0 }],
          category: categoryId,
          restaurant: restaurantId,
        },
      },
    });
  };

  const openEditFood = (food: Food, categoryId: string) => {
    const firstVariation = food.variations?.[0];
    setEditingFood({ foodId: food._id, categoryId });
    setEditFoodForm({
      title: food.title,
      description: food.description ?? "",
      price: firstVariation ? String(firstVariation.price) : "",
      imageUri: food.image ?? "",
    });
    setEditFoodVariationId(firstVariation?._id ?? "");
  };

  const handleSaveFood = async () => {
    if (!editingFood || !editFoodForm.title.trim() || !restaurantId) return;
    const price = parseFloat(editFoodForm.price);
    if (isNaN(price)) return;
    const image = await resolveImageUrl(editFoodForm.imageUri);
    const variations: { _id?: string; title: string; price: number; discounted: number }[] = [
      { title: "Default", price, discounted: 0 },
    ];
    if (editFoodVariationId) variations[0] = { ...variations[0], _id: editFoodVariationId };
    editFood({
      variables: {
        food: {
          _id: editingFood.foodId,
          title: editFoodForm.title.trim(),
          description: editFoodForm.description.trim(),
          image,
          variations,
          category: editingFood.categoryId,
          restaurant: restaurantId,
        },
      },
    });
  };

  const handleDeleteFood = (foodId: string, categoryId: string) => {
    Alert.alert(
      t("deleteFood") || "Supprimer l'article",
      t("confirmDeleteFood") || "Voulez-vous supprimer cet article?",
      [
        { text: t("Cancel") || "Annuler", style: "cancel" },
        { text: t("Delete") || "Supprimer", style: "destructive", onPress: () => deleteFood({ variables: { id: foodId, categoryId } }) },
      ]
    );
  };

  // ── Reusable sub-components ────────────────────────────────────────────────

  const inputStyle = {
    borderWidth: 1,
    borderColor: appTheme.borderLineColor,
    borderRadius: 8,
    padding: 10,
    color: appTheme.fontMainColor,
    backgroundColor: appTheme.themeBackground,
    marginBottom: 8,
  } as const;

  const renderFoodForm = (
    form: FoodFormState,
    setForm: (f: FoodFormState) => void,
    onSave: () => void,
    onCancel: () => void,
    saving: boolean
  ) => (
    <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderColor: appTheme.borderLineColor }}>
      {/* Image picker */}
      <TouchableOpacity
        onPress={() => handlePickImage(setForm, form)}
        style={{
          width: 80,
          height: 80,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: appTheme.borderLineColor,
          borderStyle: "dashed",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 8,
          overflow: "hidden",
        }}
        accessibilityRole="button"
        accessibilityLabel={t("addImage") || "Add image"}
      >
        {form.imageUri ? (
          <Image
            source={{ uri: form.imageUri }}
            style={{ width: 80, height: 80 }}
            resizeMode="cover"
          />
        ) : (
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 11, textAlign: "center" }}>
            {t("addImage") || "Add image"}
          </Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={inputStyle}
        placeholder={t("foodName") || "Nom de l'article"}
        placeholderTextColor={appTheme.fontSecondColor}
        value={form.title}
        onChangeText={(v) => setForm({ ...form, title: v })}
        accessibilityLabel={t("foodName") || "Nom de l'article"}
      />
      <TextInput
        style={inputStyle}
        placeholder={t("description") || "Description (optionnel)"}
        placeholderTextColor={appTheme.fontSecondColor}
        value={form.description}
        onChangeText={(v) => setForm({ ...form, description: v })}
        multiline
        numberOfLines={2}
        accessibilityLabel={t("description") || "Description"}
      />
      <TextInput
        style={inputStyle}
        placeholder={t("price") || "Prix"}
        placeholderTextColor={appTheme.fontSecondColor}
        value={form.price}
        onChangeText={(v) => setForm({ ...form, price: v })}
        keyboardType="decimal-pad"
        accessibilityLabel={t("price") || "Prix"}
      />
      <View className="flex-row gap-x-2">
        <TouchableOpacity
          onPress={onSave}
          disabled={saving || uploadingImage}
          className="flex-1 py-2 rounded-lg items-center"
          style={{ backgroundColor: appTheme.primary }}
          accessibilityRole="button"
        >
          {saving || uploadingImage ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onCancel}
          className="flex-1 py-2 rounded-lg items-center"
          style={{ backgroundColor: appTheme.borderLineColor }}
          accessibilityRole="button"
        >
          <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{t("Cancel") || "Annuler"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const categories: Category[] = data?.restaurant?.categories ?? [];

  if (loading && !data) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: appTheme.themeBackground }}>
        <ActivityIndicator color={appTheme.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: appTheme.themeBackground }}
      contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-4">
        <Text style={{ color: appTheme.fontMainColor, fontSize: 20, fontWeight: "bold" }}>
          {t("Menu") || "Menu"}
        </Text>
        <TouchableOpacity
          onPress={() => { setShowAddCategory(!showAddCategory); setEditingCategoryId(null); }}
          className="px-4 py-2 rounded-lg"
          style={{ backgroundColor: appTheme.primary }}
          accessibilityLabel={t("addCategory") || "Ajouter une catégorie"}
          accessibilityRole="button"
        >
          <Text style={{ color: "white", fontWeight: "600" }}>{t("addCategory") || "+ Catégorie"}</Text>
        </TouchableOpacity>
      </View>

      {/* Add Category Form */}
      {showAddCategory && (
        <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: appTheme.borderLineColor + "33", borderWidth: 1, borderColor: appTheme.borderLineColor }}>
          <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", marginBottom: 8 }}>
            {t("newCategory") || "Nouvelle catégorie"}
          </Text>
          <TextInput
            style={inputStyle}
            placeholder={t("categoryName") || "Nom de la catégorie"}
            placeholderTextColor={appTheme.fontSecondColor}
            value={newCategoryTitle}
            onChangeText={setNewCategoryTitle}
            accessibilityLabel={t("categoryName") || "Nom de la catégorie"}
          />
          <View className="flex-row gap-x-2">
            <TouchableOpacity
              onPress={handleAddCategory}
              disabled={creatingCategory}
              className="flex-1 py-2 rounded-lg items-center"
              style={{ backgroundColor: appTheme.primary }}
              accessibilityRole="button"
            >
              {creatingCategory ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setShowAddCategory(false); setNewCategoryTitle(""); }}
              className="flex-1 py-2 rounded-lg items-center"
              style={{ backgroundColor: appTheme.borderLineColor }}
              accessibilityRole="button"
            >
              <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{t("Cancel") || "Annuler"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <View className="items-center py-12">
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 16 }}>
            {t("noCategories") || "Aucune catégorie. Ajoutez une catégorie pour commencer."}
          </Text>
        </View>
      ) : (
        categories.map((cat) => (
          <View key={cat._id} className="rounded-xl mb-4 overflow-hidden" style={{ borderWidth: 1, borderColor: appTheme.borderLineColor }}>
            {/* Category Header */}
            <View className="flex-row justify-between items-center px-4 py-3" style={{ backgroundColor: appTheme.borderLineColor + "44" }}>
              <Text style={{ color: appTheme.fontMainColor, fontSize: 16, fontWeight: "700", flex: 1 }} numberOfLines={1}>
                {cat.title}
              </Text>
              <View className="flex-row gap-x-2 ml-2">
                <TouchableOpacity
                  onPress={() => { setSelectedCategoryForAdd(selectedCategoryForAdd === cat._id ? null : cat._id); setAddFoodForm(EMPTY_FOOD_FORM); }}
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: appTheme.primary }}
                  accessibilityLabel={t("addFood") || "Ajouter un article"}
                  accessibilityRole="button"
                >
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>+ Article</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { if (editingCategoryId === cat._id) setEditingCategoryId(null); else openEditCategory(cat); }}
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: "#EFF6FF" }}
                  accessibilityLabel={t("editCategory") || "Modifier catégorie"}
                  accessibilityRole="button"
                >
                  <Text style={{ color: "#2563EB", fontSize: 12, fontWeight: "600" }}>✎</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteCategory(cat._id)}
                  className="px-3 py-1 rounded-lg"
                  style={{ backgroundColor: "#FEE2E2" }}
                  accessibilityLabel={t("deleteCategory") || "Supprimer catégorie"}
                  accessibilityRole="button"
                >
                  <Text style={{ color: "#DC2626", fontSize: 12, fontWeight: "600" }}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Edit Category Form */}
            {editingCategoryId === cat._id && (
              <View className="px-4 py-3" style={{ borderBottomWidth: 1, borderColor: appTheme.borderLineColor }}>
                <Text style={{ color: appTheme.fontMainColor, fontWeight: "600", marginBottom: 8 }}>
                  {t("editCategory") || "Modifier la catégorie"}
                </Text>
                <TextInput
                  style={inputStyle}
                  placeholder={t("categoryName") || "Nom de la catégorie"}
                  placeholderTextColor={appTheme.fontSecondColor}
                  value={editCategoryTitle}
                  onChangeText={setEditCategoryTitle}
                  accessibilityLabel={t("categoryName") || "Nom de la catégorie"}
                />
                <View className="flex-row gap-x-2">
                  <TouchableOpacity
                    onPress={handleSaveCategory}
                    disabled={savingCategory}
                    className="flex-1 py-2 rounded-lg items-center"
                    style={{ backgroundColor: appTheme.primary }}
                    accessibilityRole="button"
                  >
                    {savingCategory ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setEditingCategoryId(null); setEditCategoryTitle(""); }}
                    className="flex-1 py-2 rounded-lg items-center"
                    style={{ backgroundColor: appTheme.borderLineColor }}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: appTheme.fontMainColor, fontWeight: "600" }}>{t("Cancel") || "Annuler"}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Add Food Form */}
            {selectedCategoryForAdd === cat._id &&
              renderFoodForm(addFoodForm, setAddFoodForm, () => handleAddFood(cat._id), () => { setSelectedCategoryForAdd(null); setAddFoodForm(EMPTY_FOOD_FORM); }, creatingFood)}

            {/* Foods list */}
            {cat.foods.length === 0 ? (
              <View className="px-4 py-3">
                <Text style={{ color: appTheme.fontSecondColor, fontSize: 13 }}>
                  {t("noFoods") || "Aucun article dans cette catégorie."}
                </Text>
              </View>
            ) : (
              cat.foods.map((food) => (
                <View key={food._id}>
                  <View className="flex-row justify-between items-center px-4 py-3" style={{ borderTopWidth: 1, borderColor: appTheme.borderLineColor + "44" }}>
                    {/* Food thumbnail */}
                    {food.image ? (
                      <Image source={{ uri: food.image }} style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10 }} resizeMode="cover" />
                    ) : (
                      <View style={{ width: 44, height: 44, borderRadius: 6, marginRight: 10, backgroundColor: appTheme.borderLineColor + "44", justifyContent: "center", alignItems: "center" }}>
                        <Text style={{ fontSize: 20 }}>🍽</Text>
                      </View>
                    )}
                    <View className="flex-1 mr-2">
                      <View className="flex-row items-center gap-x-2">
                        <Text style={{ color: appTheme.fontMainColor, fontSize: 14, fontWeight: "600" }}>{food.title}</Text>
                        {food.isOutOfStock && (
                          <View className="px-2 py-0.5 rounded bg-red-100">
                            <Text style={{ color: "#DC2626", fontSize: 11, fontWeight: "600" }}>{t("outOfStock") || "Épuisé"}</Text>
                          </View>
                        )}
                      </View>
                      {food.description ? (
                        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginTop: 2 }} numberOfLines={1}>{food.description}</Text>
                      ) : null}
                      {food.variations && food.variations.length > 0 && (
                        <Text style={{ color: appTheme.fontSecondColor, fontSize: 12, marginTop: 2 }}>
                          {food.variations[0].price.toFixed(2)} DT
                        </Text>
                      )}
                    </View>
                    <View className="flex-row gap-x-2">
                      <TouchableOpacity
                        onPress={() => updateOutOfStock({ variables: { id: food._id, categoryId: cat._id } })}
                        className="px-2 py-1 rounded-lg"
                        style={{ backgroundColor: food.isOutOfStock ? "#D1FAE5" : "#FEF3C7" }}
                        accessibilityLabel={food.isOutOfStock ? (t("markAvailable") || "Disponible") : (t("markOutOfStock") || "Épuisé")}
                        accessibilityRole="button"
                      >
                        <Text style={{ fontSize: 11, fontWeight: "600", color: food.isOutOfStock ? "#059669" : "#D97706" }}>
                          {food.isOutOfStock ? "✓" : "✗"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { if (editingFood?.foodId === food._id) setEditingFood(null); else openEditFood(food, cat._id); }}
                        className="px-2 py-1 rounded-lg"
                        style={{ backgroundColor: "#EFF6FF" }}
                        accessibilityLabel={t("editFood") || "Modifier l'article"}
                        accessibilityRole="button"
                      >
                        <Text style={{ color: "#2563EB", fontSize: 11, fontWeight: "600" }}>✎</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteFood(food._id, cat._id)}
                        className="px-2 py-1 rounded-lg"
                        style={{ backgroundColor: "#FEE2E2" }}
                        accessibilityLabel={t("deleteFood") || "Supprimer l'article"}
                        accessibilityRole="button"
                      >
                        <Text style={{ color: "#DC2626", fontSize: 11, fontWeight: "600" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Edit Food Form */}
                  {editingFood?.foodId === food._id &&
                    renderFoodForm(editFoodForm, setEditFoodForm, handleSaveFood, () => { setEditingFood(null); setEditFoodForm(EMPTY_FOOD_FORM); }, savingFood)}
                </View>
              ))
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
