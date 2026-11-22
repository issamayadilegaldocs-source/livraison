import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

describe('UploadService', () => {
  it('uploads valid data URLs through the Cloudinary provider', async () => {
    const cloudinaryProvider = {
      uploadImage: jest.fn().mockResolvedValue({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
      }),
    };
    const service = new UploadService(cloudinaryProvider as never);

    await expect(service.uploadImage('data:image/jpeg;base64,aGVsbG8=')).resolves.toEqual({
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/test.jpg',
    });
    expect(cloudinaryProvider.uploadImage).toHaveBeenCalledWith(
      'data:image/jpeg;base64,aGVsbG8=',
    );
  });

  it('rejects base64 image payloads over the decoded upload limit', async () => {
    const cloudinaryProvider = {
      uploadImage: jest.fn(),
    };
    const service = new UploadService(cloudinaryProvider as never);
    const oversizedImage = `data:image/jpeg;base64,${'a'.repeat(14 * 1024 * 1024)}`;

    await expect(service.uploadImage(oversizedImage)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(cloudinaryProvider.uploadImage).not.toHaveBeenCalled();
  });

  it('creates Cloudinary direct-upload signatures through the provider', () => {
    const signature = {
      uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
      apiKey: 'key',
      timestamp: '1780000000',
      signature: 'signature',
      folder: 'enatega',
    };
    const cloudinaryProvider = {
      createUploadSignature: jest.fn().mockReturnValue(signature),
    };
    const service = new UploadService(cloudinaryProvider as never);

    expect(service.createCloudinaryUploadSignature()).toEqual(signature);
    expect(cloudinaryProvider.createUploadSignature).toHaveBeenCalledWith();
  });
});
