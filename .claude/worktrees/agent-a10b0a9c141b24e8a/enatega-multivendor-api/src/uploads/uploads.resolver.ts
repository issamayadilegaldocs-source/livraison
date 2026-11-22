import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtUser } from '../auth/roles.enum';
import { UploadService } from './upload.service';
import { CloudinaryUploadSignature, UploadImageResponse } from './upload.model';
import { PushTokenService } from '../notifications/push-token.service';
import { PushTokenModel } from '../notifications/models/push-token.model';

// Any authenticated actor (customer, vendor, rider, admin) may upload images
// or register a push token for themselves — these are not role-restricted,
// but every mutation here previously had NO guard at all, letting an
// unauthenticated caller mint signed upload credentials (storage-cost /
// content-hosting abuse) or, for uploadToken, register a push token against
// an arbitrary client-supplied `id` with no ownership check (notification
// hijack). uploadToken is superseded by the properly-authenticated
// `pushToken`/`saveNotificationTokenWeb` mutations elsewhere and unused by
// any current frontend; it is kept for API compatibility but now scoped to
// the caller's own identity like its replacements.
@UseGuards(ClerkAuthGuard)
@Resolver()
export class UploadsResolver {
  constructor(
    private readonly uploadService: UploadService,
    private readonly pushTokenService: PushTokenService,
  ) {}

  @Mutation(() => UploadImageResponse, { name: 'uploadImageToS3' })
  async uploadImageToS3(
    @Args('image', { type: () => String }) image: string,
  ): Promise<UploadImageResponse> {
    return this.uploadService.uploadImage(image);
  }

  @Mutation(() => CloudinaryUploadSignature, { name: 'createCloudinaryUploadSignature' })
  createCloudinaryUploadSignature(): CloudinaryUploadSignature {
    return this.uploadService.createCloudinaryUploadSignature();
  }

  @Mutation(() => PushTokenModel, { name: 'uploadToken' })
  async uploadToken(
    @CurrentUser() jwtUser: JwtUser,
    @Args('pushToken', { type: () => String }) pushToken: string,
  ): Promise<PushTokenModel> {
    const token = await this.pushTokenService.registerToken(
      pushToken,
      'web',
      jwtUser.userId,
      'CUSTOMER',
    );
    return {
      _id: token._id.toString(),
      token: token.token,
      pushToken: token.token,
      platform: token.platform,
      userType: token.userType,
      userId: token.userId,
      active: token.active,
      lastUsedAt: token.lastUsedAt,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}
