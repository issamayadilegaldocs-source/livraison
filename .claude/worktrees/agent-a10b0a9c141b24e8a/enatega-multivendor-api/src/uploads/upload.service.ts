import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { CloudinaryProvider } from '../providers/cloudinary.provider';
import { CloudinaryUploadSignature } from './upload.model';

const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export interface UploadResponse {
  imageUrl: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly cloudinaryProvider: CloudinaryProvider) {}

  /**
   * Upload a base64 or data URL image.
   * Input can be:
   * - Base64 string (without data: prefix)
   * - Data URL (data:image/jpeg;base64,...)
   * - Direct image file content
   */
  async uploadImage(imageData: string): Promise<UploadResponse> {
    if (!imageData) {
      throw new BadRequestException('Image data is required');
    }
    if (getBase64ByteLength(imageData) > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException('Image data exceeds the 10 MB upload limit');
    }

    try {
      const response = await this.cloudinaryProvider.uploadImage(imageData);
      return {
        imageUrl: response.secure_url || response.url,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Upload failed: ${err.message}`);
      throw error;
    }
  }

  /**
   * Upload image with a specific public ID (for updates).
   */
  async uploadImageWithId(
    imageData: string,
    publicId: string,
  ): Promise<UploadResponse> {
    if (!imageData || !publicId) {
      throw new BadRequestException('Image data and ID are required');
    }
    if (getBase64ByteLength(imageData) > MAX_IMAGE_UPLOAD_BYTES) {
      throw new BadRequestException('Image data exceeds the 10 MB upload limit');
    }

    try {
      const response = await this.cloudinaryProvider.uploadImage(
        imageData,
        publicId,
      );
      return {
        imageUrl: response.secure_url || response.url,
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Upload with ID failed: ${err.message}`);
      throw error;
    }
  }

  createCloudinaryUploadSignature(): CloudinaryUploadSignature {
    return this.cloudinaryProvider.createUploadSignature();
  }

  /**
   * Delete an uploaded image.
   */
  async deleteImage(publicId: string): Promise<boolean> {
    if (!publicId) {
      throw new BadRequestException('Public ID is required');
    }

    return this.cloudinaryProvider.deleteImage(publicId);
  }
}

function getBase64ByteLength(value: string): number {
  const base64 = value.includes(',') ? value.split(',').pop() ?? '' : value;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}
