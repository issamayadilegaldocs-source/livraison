import * as crypto from 'crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface CloudinaryUploadResponse {
  public_id: string;
  url: string;
  secure_url: string;
  version: number;
  width: number;
  height: number;
  format: string;
  created_at: string;
  tags: string[];
}

export interface CloudinaryUploadSignatureData {
  uploadUrl: string;
  apiKey: string;
  timestamp: string;
  signature: string;
  folder: string;
}

@Injectable()
export class CloudinaryProvider {
  private readonly logger = new Logger(CloudinaryProvider.name);
  private uploadUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private uploadPreset: string;
  private enabled: boolean;
  private client: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.loadConfig();
  }

  private loadConfig() {
    this.uploadUrl = this.configService.get<string>('CLOUDINARY_UPLOAD_URL') || '';
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY') || '';
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET') || '';
    this.uploadPreset = this.configService.get<string>('CLOUDINARY_UPLOAD_PRESET') || 'enatega';
    this.enabled = !!(this.uploadUrl && this.apiKey && this.apiSecret);

    if (!this.enabled) {
      this.logger.warn('Cloudinary is not configured. File uploads will be disabled.');
    }

    this.client = axios.create({
      timeout: 30000,
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Upload a base64/data URL image to Cloudinary.
   */
  async uploadImage(
    base64OrDataUrl: string,
    publicId?: string,
    folder: string = 'enatega',
  ): Promise<CloudinaryUploadResponse> {
    if (!this.enabled) {
      throw new BadRequestException('Upload service is not available');
    }

    try {
      const timestamp = Math.round(Date.now() / 1000);

      // Build the string to sign (params sorted alphabetically)
      const paramsToSign: Record<string, string> = { timestamp: String(timestamp) };
      if (folder) paramsToSign.folder = folder;
      if (publicId) paramsToSign.public_id = publicId;

      const signatureBase =
        Object.keys(paramsToSign)
          .sort()
          .map((k) => `${k}=${paramsToSign[k]}`)
          .join('&') + this.apiSecret;

      const signature = crypto.createHash('sha1').update(signatureBase).digest('hex');

      const formData = new FormData();
      formData.append('file', base64OrDataUrl);
      formData.append('api_key', this.apiKey);
      formData.append('timestamp', String(timestamp));
      formData.append('signature', signature);
      if (folder) formData.append('folder', folder);
      if (publicId) formData.append('public_id', publicId);

      const response = await this.client.post(this.uploadUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      this.logger.debug(`Image uploaded to Cloudinary: ${response.data.public_id}`);
      return response.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to upload image to Cloudinary: ${err.message}`);
      throw new BadRequestException('Failed to upload image');
    }
  }

  createUploadSignature(folder: string = 'enatega'): CloudinaryUploadSignatureData {
    if (!this.enabled) {
      throw new BadRequestException('Upload service is not available');
    }

    const timestamp = String(Math.round(Date.now() / 1000));
    const paramsToSign: Record<string, string> = { folder, timestamp };
    const signatureBase =
      Object.keys(paramsToSign)
        .sort()
        .map((key) => `${key}=${paramsToSign[key]}`)
        .join('&') + this.apiSecret;

    return {
      uploadUrl: this.uploadUrl,
      apiKey: this.apiKey,
      timestamp,
      signature: crypto.createHash('sha1').update(signatureBase).digest('hex'),
      folder,
    };
  }

  async deleteImage(publicId: string): Promise<boolean> {
    if (!this.enabled) {
      this.logger.warn('Cloudinary is not enabled. Delete not performed.');
      return false;
    }

    try {
      const timestamp = Math.round(Date.now() / 1000);
      const toSign = `public_id=${publicId}&timestamp=${timestamp}${this.apiSecret}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');

      const formData = new URLSearchParams({
        public_id: publicId,
        api_key: this.apiKey,
        timestamp: String(timestamp),
        signature,
      });

      const destroyUrl = this.uploadUrl.replace(/\/upload$/, '/destroy');
      await this.client.post(destroyUrl, formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      this.logger.debug(`Image deleted from Cloudinary: ${publicId}`);
      return true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to delete image from Cloudinary: ${err.message}`);
      return false;
    }
  }
}
