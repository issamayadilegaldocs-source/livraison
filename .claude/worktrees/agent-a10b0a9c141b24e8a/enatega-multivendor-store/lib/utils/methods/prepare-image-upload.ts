import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

const MAX_UPLOAD_IMAGE_DIMENSION = 1280;
const UPLOAD_IMAGE_QUALITY = 0.72;

export interface PreparedImageUpload {
  uri: string;
  name: string;
  type: "image/jpeg";
}

export interface CloudinaryUploadSignature {
  uploadUrl: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
}

const getResizeAction = (
  width?: number,
  height?: number
): { resize: { width?: number; height?: number } } => {
  if (!width || !height) {
    return { resize: { width: MAX_UPLOAD_IMAGE_DIMENSION } };
  }

  if (width <= MAX_UPLOAD_IMAGE_DIMENSION && height <= MAX_UPLOAD_IMAGE_DIMENSION) {
    return { resize: { width } };
  }

  return width >= height
    ? { resize: { width: MAX_UPLOAD_IMAGE_DIMENSION } }
    : { resize: { height: MAX_UPLOAD_IMAGE_DIMENSION } };
};

export async function pickCompressedImageDataUri(options?: {
  aspect?: [number, number];
}): Promise<string | null> {
  const prepared = await pickCompressedImageUpload(options);
  if (!prepared) return null;

  const result = await ImageManipulator.manipulateAsync(prepared.uri, [], {
    compress: UPLOAD_IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });

  if (!result.base64) {
    throw new Error("Image compression failed");
  }

  return `data:image/jpeg;base64,${result.base64}`;
}

export async function pickCompressedImageUpload(options?: {
  aspect?: [number, number];
}): Promise<PreparedImageUpload | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: options?.aspect,
    quality: 1,
    base64: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const prepared = await ImageManipulator.manipulateAsync(
    asset.uri,
    [getResizeAction(asset.width, asset.height)],
    {
      compress: UPLOAD_IMAGE_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: false,
    }
  );

  return {
    uri: prepared.uri,
    name: "upload.jpg",
    type: "image/jpeg",
  };
}

export async function uploadPreparedImageToCloudinary(
  image: PreparedImageUpload,
  signature: CloudinaryUploadSignature
): Promise<string> {
  const formData = new FormData();
  formData.append("file", image as unknown as Blob);
  formData.append("api_key", signature.apiKey);
  formData.append("timestamp", signature.timestamp);
  formData.append("signature", signature.signature);
  formData.append("folder", signature.folder);

  const response = await fetch(signature.uploadUrl, {
    method: "POST",
    body: formData,
  });

  const data = (await response.json()) as { secure_url?: string; url?: string; error?: unknown };
  const imageUrl = data.secure_url ?? data.url;
  if (!response.ok || !imageUrl) {
    throw new Error("Cloudinary upload failed");
  }

  return imageUrl;
}
