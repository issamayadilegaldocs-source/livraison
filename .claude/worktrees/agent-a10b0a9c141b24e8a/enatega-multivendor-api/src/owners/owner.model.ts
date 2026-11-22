import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('OwnerVendorRestaurantLocation')
export class OwnerVendorRestaurantLocation {
  @Field(() => [Float], { nullable: true }) coordinates?: number[];
}

@ObjectType('OwnerVendorRestaurant')
export class OwnerVendorRestaurant {
  @Field(() => ID) _id: string;
  @Field(() => Int, { nullable: true }) orderId?: number;
  @Field({ nullable: true }) orderPrefix?: string;
  @Field({ nullable: true }) slug?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) address?: string;
  @Field(() => OwnerVendorRestaurantLocation, { nullable: true })
  location?: OwnerVendorRestaurantLocation;
  @Field({ nullable: true }) shopType?: string;
}

@ObjectType()
export class OwnerRestaurant {
  @Field(() => ID) _id: string;
  @Field({ nullable: true }) orderId?: string;
  @Field() name: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) address?: string;
}

@ObjectType()
export class OwnerProfile {
  @Field(() => ID) _id: string;
  @Field() email: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) image?: string;
  @Field() userType: string;
  @Field(() => [String], { nullable: true }) permissions?: string[];
  @Field({ nullable: true }) userTypeId?: string;
  @Field(() => [OwnerRestaurant], { nullable: true }) restaurants?: OwnerRestaurant[];
}

@ObjectType('Owner')
export class OwnerModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) unique_id?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) userType?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field(() => [OwnerVendorRestaurant], { nullable: true })
  restaurants?: OwnerVendorRestaurant[];
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) firstName?: string;
  @Field({ nullable: true }) lastName?: string;
  @Field({ nullable: true }) phoneNumber?: string;
  // password (hashed) and plainPassword are never exposed over GraphQL — they are
  // credentials and must not leak to any client. Stored on the document only.
  password?: string;
  plainPassword?: string;
  @Field({ nullable: true }) invitationStatus?: string;
  @Field({ nullable: true }) invitedAt?: string;
  @Field({ nullable: true }) acceptedAt?: string;
  @Field({ nullable: true }) clerkInvitationId?: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}
