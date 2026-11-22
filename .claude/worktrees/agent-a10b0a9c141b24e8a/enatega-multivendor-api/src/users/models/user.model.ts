import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GeoPointModel } from '../../common/models/geo.model';

@ObjectType('Address')
export class AddressModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) label?: string;
  @Field({ nullable: true }) deliveryAddress?: string;
  @Field({ nullable: true }) details?: string;
  @Field(() => GeoPointModel, { nullable: true }) location?: GeoPointModel;
  @Field({ nullable: true }) selected?: boolean;
}

@ObjectType('User')
export class UserModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) phoneIsVerified?: boolean;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) emailIsVerified?: boolean;
  @Field({ nullable: true }) notificationToken?: string;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) isOrderNotification?: boolean;
  @Field({ nullable: true }) isOfferNotification?: boolean;
  @Field(() => [AddressModel], { nullable: true }) addresses?: AddressModel[];
  @Field(() => [String], { nullable: true }) favourite?: string[];
  @Field({ nullable: true }) userType?: string;
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) lastLogin?: string;
  @Field({ nullable: true }) notes?: string;
  @Field({ nullable: true }) preferredLanguage?: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
}
