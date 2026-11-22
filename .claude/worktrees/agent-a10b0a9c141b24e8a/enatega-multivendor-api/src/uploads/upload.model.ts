import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UploadImageResponse {
  @Field()
  imageUrl: string;
}

@ObjectType()
export class CloudinaryUploadSignature {
  @Field()
  uploadUrl: string;

  @Field()
  apiKey: string;

  @Field()
  timestamp: string;

  @Field()
  signature: string;

  @Field()
  folder: string;
}
