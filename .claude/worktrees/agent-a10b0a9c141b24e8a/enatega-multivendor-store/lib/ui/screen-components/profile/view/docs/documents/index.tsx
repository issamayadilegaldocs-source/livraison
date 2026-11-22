// Hooks
import { useUserContext } from "@/lib/context/global/user.context";
import { useTranslation } from "react-i18next";

// Core
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useState } from "react";

// Expo
import { useApptheme } from "@/lib/context/theme.context";
import { app_theme } from "@/lib/utils/types/theme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Switch } from "react-native-switch";
import { useMutation } from "@apollo/client";
import { STOR_EDIT_RESTAURANT_PROFILE } from "@/lib/api/graphql/mutation/restaurant";
import { STORE_PROFILE } from "@/lib/apollo/queries";

export default function DocumentsSection() {
  const { appTheme, currentTheme, toggleTheme } = useApptheme();
  const { t } = useTranslation();
  const { dataProfile } = useUserContext();

  const [editingCuisines, setEditingCuisines] = useState(false);
  const [cuisineInput, setCuisineInput] = useState("");

  const [editProfile] = useMutation(STOR_EDIT_RESTAURANT_PROFILE, {
    refetchQueries: [STORE_PROFILE],
    onError: (e) => Alert.alert("Erreur", e.message),
    onCompleted: () => setEditingCuisines(false),
  });

  const currentCuisines: string[] = dataProfile?.cuisines ?? [];

  const handleSaveCuisines = () => {
    const newList = cuisineInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    editProfile({ variables: { restaurant: { _id: dataProfile!._id, cuisines: newList } } });
  };

  return (
    <View className="flex flex-col h-[20%] w-full justify-between items-center">
      {/* Cuisines row */}
      <View className="flex flex-col px-5 w-full border-b-2 py-3" style={{ borderColor: appTheme.borderLineColor }}>
        <View className="flex flex-row w-full justify-between items-center mb-2">
          <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>{t("Cuisines") || "Cuisines"}</Text>
          <TouchableOpacity onPress={() => { setEditingCuisines(!editingCuisines); setCuisineInput(currentCuisines.join(", ")); }}>
            <Text className="font-semibold text-[#0EA5E9]">{editingCuisines ? (t("Cancel") || "Annuler") : (t("Edit") || "Modifier")}</Text>
          </TouchableOpacity>
        </View>
        {editingCuisines ? (
          <View>
            <TextInput
              value={cuisineInput}
              onChangeText={setCuisineInput}
              placeholder={t("cuisinesPlaceholder") || "Tunisien, Français, Japonais..."}
              placeholderTextColor={appTheme.fontSecondColor}
              style={{ borderWidth: 1, borderColor: appTheme.borderLineColor, borderRadius: 8, padding: 8, color: appTheme.fontMainColor, marginBottom: 8 }}
            />
            <TouchableOpacity onPress={handleSaveCuisines} style={{ backgroundColor: appTheme.primary, borderRadius: 8, padding: 10, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "600" }}>{t("Save") || "Enregistrer"}</Text>
            </TouchableOpacity>
          </View>
        ) : currentCuisines.length > 0 ? (
          <View className="flex flex-row flex-wrap gap-2">
            {currentCuisines.map((c) => (
              <View key={c} className="px-3 py-1 rounded-full" style={{ backgroundColor: appTheme.primary + "22" }}>
                <Text style={{ color: appTheme.primary, fontSize: 12, fontWeight: "600" }}>{c}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: appTheme.fontSecondColor, fontSize: 12 }}>{t("noCuisines") || "Aucune cuisine définie"}</Text>
        )}
      </View>

      <View
        className="flex flex-col gap-3 items-start justify-center px-5 w-full border-b-2 py-3"
        style={{ borderColor: appTheme.borderLineColor }}
      >
        <View className="flex flex-row w-full justify-between items-start">
          <Text
            className="font-bold"
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("bankDetails")}
          </Text>
          <TouchableOpacity
            className="top-6"
            onPress={() => router.push("/bank-management")}
          >
            <Text className="font-semibold text-[#0EA5E9]">
              {dataProfile?.bussinessDetails?.accountNumber
                ? t("Update")
                : t("Add")}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          className={`${dataProfile?.bussinessDetails?.accountNumber ? "bg-[#E0F2FE]" : "bg-[#FEE2E2]"} p-2 border rounded-3xl border-[#E0F2FE]`}
        >
          <Text
            className={`${dataProfile?.bussinessDetails?.accountNumber ? "text-[#0D99FF]" : "text-[#991B1B]"} font-semibold`}
          >
            {dataProfile?.bussinessDetails?.accountNumber
              ? t("submittedData")
              : t("missingData")}
          </Text>
        </View>
      </View>
      <View
        className="flex flex-row w-full justify-between items-center px-5 border-b-2 py-3"
        style={{ borderColor: appTheme.borderLineColor }}
      >
        <Text className="font-bold" style={{ color: appTheme.fontMainColor }}>
          {t("Offers")}
        </Text>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <TouchableOpacity onPress={() => router.push("/offers" as any)}>
          <Text className="font-semibold text-[#0EA5E9]">{t("Manage")}</Text>
        </TouchableOpacity>
      </View>
      <View>
        <Text
          className="font-bold m-3"
          style={{
            color: appTheme.fontMainColor,
          }}
        >
          {t("otherDetails")}
        </Text>
        <View
          className="flex flex-row gap-3 items-center justify-between px-5 w-full border-b-2 py-3"
          style={{ borderColor: appTheme.borderLineColor }}
        >
          <Text
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("Address")}
          </Text>
          {dataProfile?.address ? (
            <Text style={{ color: appTheme.fontSecondColor }}>
              {dataProfile?.address}
            </Text>
          ) : (
            <Ionicons name="sad-outline" color={appTheme.iconPink} size={20} />
          )}
        </View>
        <View
          className="flex flex-row gap-3 items-center justify-between px-5 w-full border-b-2 py-3"
          style={{ borderColor: appTheme.borderLineColor }}
        >
          <Text
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("Phone")}
          </Text>
          {dataProfile?.phone ? (
            <Text style={{ color: appTheme.fontSecondColor }}>
              {dataProfile?.phone}
            </Text>
          ) : (
            <Ionicons name="sad-outline" color={appTheme.iconPink} size={20} />
          )}
        </View>
        <View
          className="flex flex-row gap-3 items-center justify-between px-5 w-full border-b-2 py-3"
          style={{ borderColor: appTheme.borderLineColor }}
        >
          <Text
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("Username")}
          </Text>
          {dataProfile?.username ? (
            <Text style={{ color: appTheme.fontSecondColor }}>
              {dataProfile?.username}
            </Text>
          ) : (
            <Ionicons name="sad-outline" color={appTheme.iconPink} size={20} />
          )}
        </View>
        <View
          className="flex flex-row gap-3 items-center justify-between px-5 w-full border-b-2 py-3"
          style={{ borderColor: appTheme.borderLineColor }}
        >
          <Text
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("Password")}
          </Text>
          {dataProfile?.password ? (
            <Text style={{ color: appTheme.fontSecondColor }}>
              {dataProfile?.password}
            </Text>
          ) : (
            <Ionicons name="sad-outline" color={appTheme.iconPink} size={20} />
          )}
        </View>
        <View
          className="flex flex-row gap-3 items-center justify-between px-5 w-full border-b-2 py-3"
          style={{ borderColor: appTheme.borderLineColor }}
        >
          <Text
            style={{
              color: appTheme.fontMainColor,
            }}
          >
            {t("walletAmount")}
          </Text>
          {dataProfile?.currentWalletAmount ? (
            <Text style={{ color: appTheme.fontSecondColor }}>
              ${dataProfile?.currentWalletAmount?.toFixed(2)}
            </Text>
          ) : (
            <Ionicons name="sad-outline" color={appTheme.iconPink} size={20} />
          )}
        </View>
      </View>
      <View className="flex flex-row items-center justify-between w-full my-5 px-5">
        <Text
          className="text-xl font-bold"
          style={{
            color: appTheme.fontMainColor,
          }}
        >
          {t("Theme")}
        </Text>
        <View className="flex flex-row  items-center justify-center">
          <Switch
            containerStyle={{ width: "20%" }}
            switchWidthMultiplier={3}
            activeText={"Dark"}
            inActiveText={"Light"}
            renderInsideCircle={() => {
              return (
                <Ionicons
                  name={
                    currentTheme === "dark"
                      ? "moon"
                      : currentTheme === "light"
                        ? "sunny"
                        : "phone-portrait"
                  }
                  size={22}
                />
              );
            }}
            circleActiveColor={appTheme.primary}
            backgroundActive={appTheme.primary}
            activeTextStyle={{ color: appTheme.black }}
            value={currentTheme === "dark"}
            onValueChange={() => toggleTheme(currentTheme as app_theme)}
          />
        </View>
      </View>
    </View>
  );
}
