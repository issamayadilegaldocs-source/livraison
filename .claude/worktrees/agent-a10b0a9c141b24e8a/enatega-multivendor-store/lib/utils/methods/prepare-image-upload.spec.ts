/// <reference types="jest" />

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import {
  pickCompressedImageUpload,
  uploadPreparedImageToCloudinary,
} from "./prepare-image-upload";

jest.mock("expo-image-picker", () => ({
  MediaTypeOptions: { Images: "Images" },
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  manipulateAsync: jest.fn(),
}));

describe("pickCompressedImageDataUri", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when media permission is denied", async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ status: "denied" } as never);

    await expect(pickCompressedImageUpload()).resolves.toBeNull();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("resizes and compresses the selected image before returning a local upload file", async () => {
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ status: "granted" } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file:///photo.jpg", width: 3024, height: 4032 }],
    } as never);
    jest.mocked(ImageManipulator.manipulateAsync).mockResolvedValue({
      uri: "file:///prepared.jpg",
      width: 960,
      height: 1280,
    });

    await expect(pickCompressedImageUpload()).resolves.toEqual({
      uri: "file:///prepared.jpg",
      name: "upload.jpg",
      type: "image/jpeg",
    });
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        base64: false,
        quality: 1,
      })
    );
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      "file:///photo.jpg",
      [{ resize: { height: 1280 } }],
      expect.objectContaining({
        base64: false,
        compress: 0.72,
        format: "jpeg",
      })
    );
  });

  it("uploads prepared image files directly to Cloudinary", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        secure_url: "https://res.cloudinary.com/demo/image/upload/test.jpg",
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      uploadPreparedImageToCloudinary(
        { uri: "file:///prepared.jpg", name: "upload.jpg", type: "image/jpeg" },
        {
          uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
          apiKey: "key",
          timestamp: "1780000000",
          signature: "signature",
          folder: "enatega",
        }
      )
    ).resolves.toBe("https://res.cloudinary.com/demo/image/upload/test.jpg");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.cloudinary.com/v1_1/demo/image/upload",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );
  });
});
