import { UploadsResolver } from './uploads.resolver';
import { Role } from '../auth/roles.enum';

// Security regression coverage: uploadImageToS3, createCloudinaryUploadSignature,
// and uploadToken previously had NO @UseGuards at all — any unauthenticated
// caller could mint signed upload credentials or hijack another user's push
// notifications by registering a token against an arbitrary client-supplied
// id. The resolver class now carries @UseGuards(ClerkAuthGuard) (verified via
// reflected metadata below) and uploadToken derives the target user from the
// authenticated actor instead of a client-supplied id.
describe('UploadsResolver', () => {
  const buildResolver = () => {
    const uploadService = {
      uploadImage: jest.fn().mockResolvedValue({ url: 'https://cdn/x.jpg' }),
      createCloudinaryUploadSignature: jest.fn().mockReturnValue({ signature: 'sig', timestamp: 1 }),
    };
    const pushTokenService = {
      registerToken: jest.fn().mockResolvedValue({
        _id: 'token_1',
        token: 'expo-token',
        platform: 'web',
        userType: 'CUSTOMER',
        userId: 'user_authenticated',
        active: true,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };
    const resolver = new UploadsResolver(uploadService as never, pushTokenService as never);
    return { resolver, uploadService, pushTokenService };
  };

  it('requires authentication on every mutation (ClerkAuthGuard applied at class level)', () => {
    const guards = Reflect.getMetadata('__guards__', UploadsResolver) ?? [];
    expect(guards.length).toBeGreaterThan(0);
  });

  it('uploadImageToS3 delegates to the upload service', async () => {
    const { resolver, uploadService } = buildResolver();
    const result = await resolver.uploadImageToS3('data:image/png;base64,AAA');
    expect(uploadService.uploadImage).toHaveBeenCalledWith('data:image/png;base64,AAA');
    expect(result).toEqual({ url: 'https://cdn/x.jpg' });
  });

  it('createCloudinaryUploadSignature delegates to the upload service', () => {
    const { resolver, uploadService } = buildResolver();
    const result = resolver.createCloudinaryUploadSignature();
    expect(uploadService.createCloudinaryUploadSignature).toHaveBeenCalled();
    expect(result).toEqual({ signature: 'sig', timestamp: 1 });
  });

  it('uploadToken registers the push token against the AUTHENTICATED caller, not a client-supplied id', async () => {
    const { resolver, pushTokenService } = buildResolver();
    const jwtUser = { userId: 'user_authenticated', role: Role.CUSTOMER };

    await resolver.uploadToken(jwtUser, 'expo-push-token-xyz');

    expect(pushTokenService.registerToken).toHaveBeenCalledWith(
      'expo-push-token-xyz',
      'web',
      'user_authenticated',
      'CUSTOMER',
    );
  });
});
