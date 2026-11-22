import { useUserContext } from "@/lib/context/global/user.context";
import { useTranslation } from "react-i18next";
import { useApptheme } from "@/lib/context/theme.context";
import { Image, ImageBackground, Text, TouchableOpacity, View, Alert, ActivityIndicator } from "react-native";
import { useMutation } from "@apollo/client";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CREATE_CLOUDINARY_UPLOAD_SIGNATURE } from "@/lib/api/graphql/mutation/upload";
import { STOR_EDIT_RESTAURANT_PROFILE } from "@/lib/api/graphql/mutation/restaurant";
import { STORE_PROFILE } from "@/lib/apollo/queries";
import {
  pickCompressedImageUpload,
  uploadPreparedImageToCloudinary,
} from "@/lib/utils/methods/prepare-image-upload";

async function pickAndUpload(
  createUploadSignature: () => Promise<{
    data?: { createCloudinaryUploadSignature?: Parameters<typeof uploadPreparedImageToCloudinary>[1] };
  }>,
  setLoading: (v: boolean) => void,
  onUrl: (url: string) => void
) {
  setLoading(true);
  try {
    const image = await pickCompressedImageUpload();
    if (!image) return;

    const signatureResult = await createUploadSignature();
    const signature = signatureResult.data?.createCloudinaryUploadSignature;
    if (!signature) throw new Error("Missing upload signature");

    onUrl(await uploadPreparedImageToCloudinary(image, signature));
  } catch (e: unknown) {
    Alert.alert("Erreur", (e instanceof Error ? e.message : String(e)) || "Upload failed");
  } finally {
    setLoading(false);
  }
}

export default function ProfileHeader() {
  const { appTheme } = useApptheme();
  const { t } = useTranslation();
  const { dataProfile } = useUserContext();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);

  const [createUploadSignature] = useMutation(CREATE_CLOUDINARY_UPLOAD_SIGNATURE);
  const [editProfile] = useMutation(STOR_EDIT_RESTAURANT_PROFILE, {
    refetchQueries: [STORE_PROFILE],
    onError: (e) => Alert.alert("Erreur", e.message),
  });

  const handleLogoUpload = () =>
    pickAndUpload(createUploadSignature, setUploadingLogo, (url) =>
      editProfile({ variables: { restaurant: { _id: dataProfile!._id, logo: url } } })
    );

  const handleBgUpload = () =>
    pickAndUpload(createUploadSignature, setUploadingBg, (url) =>
      editProfile({ variables: { restaurant: { _id: dataProfile!._id, image: url } } })
    );

  return (
    <ImageBackground
      source={{ uri: dataProfile?.image as string }}
      resizeMode="cover"
      className="backdrop-blur-3xl"
    >
      <View className={`justify-between flex-row h-[130px] w-[50%] items-center p-4 shadow-xl`}>
        {/* Logo with upload overlay */}
        <TouchableOpacity onPress={handleLogoUpload} disabled={uploadingLogo} accessibilityLabel={t("uploadLogo") || "Upload logo"} accessibilityRole="button">
          <View className="p-1 rounded-[100px]" style={{ backgroundColor: appTheme.themeBackground }}>
            <View className="w-[54px] h-[54px] rounded-full items-center justify-center overflow-hidden" style={{ backgroundColor: appTheme.white }}>
              {uploadingLogo ? (
                <ActivityIndicator color={appTheme.primary} />
              ) : dataProfile?.logo ? (
                <Image source={{ uri: dataProfile.logo }} width={54} height={54} resizeMode="cover" />
              ) : (
                <Text className="text-[16px] font-semibold" style={{ color: appTheme.primary }}>
                  {(() => { const parts = (dataProfile?.name ?? "JS").split(" "); return (parts[0]?.[0] ?? "J").toUpperCase() + (parts[1]?.[0] ?? "S").toUpperCase(); })()}
                </Text>
              )}
            </View>
            {/* Camera badge */}
            <View style={{ position: "absolute", bottom: 0, right: 0, backgroundColor: appTheme.primary, borderRadius: 10, padding: 2 }}>
              <Ionicons name="camera" size={12} color="white" />
            </View>
          </View>
        </TouchableOpacity>

        <View className="left-1 flex-1 ml-2">
          <Text className="font-semibold" style={{ color: appTheme.fontMainColor, padding: 3, borderRadius: 70, backgroundColor: appTheme.themeBackground }}>
            {dataProfile?.name ?? t("storeName")}
          </Text>
          <Text className="font-medium my-1" style={{ color: appTheme.fontMainColor, padding: 3, borderRadius: 70, backgroundColor: appTheme.themeBackground }}>
            {dataProfile?._id.substring(0, 9).toUpperCase() ?? t("store id")}
          </Text>
        </View>

        {/* Background image upload button */}
        <TouchableOpacity onPress={handleBgUpload} disabled={uploadingBg} style={{ position: "absolute", right: 8, top: 8 }} accessibilityLabel={t("uploadCover") || "Upload cover"} accessibilityRole="button">
          {uploadingBg ? (
            <ActivityIndicator color={appTheme.primary} size="small" />
          ) : (
            <View style={{ backgroundColor: appTheme.themeBackground + "CC", borderRadius: 16, padding: 4 }}>
              <Ionicons name="image-outline" size={18} color={appTheme.primary} />
            </View>
          )}
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}
