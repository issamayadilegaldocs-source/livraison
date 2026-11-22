import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Banner')
export class BannerModel {
  @Field(() => ID)
  _id!: string;

  @Field()
  title!: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  action?: string;

  @Field({ nullable: true })
  file?: string;

  @Field({ nullable: true })
  badgeText?: string;

  @Field({ nullable: true })
  buttonText?: string;

  @Field({ nullable: true })
  promoCode?: string;

  @Field({ nullable: true })
  backgroundColor?: string;

  @Field({ nullable: true })
  textColor?: string;

  @Field({ nullable: true })
  accentColor?: string;

  @Field({ nullable: true })
  buttonBackgroundColor?: string;

  @Field({ nullable: true })
  buttonTextColor?: string;

  @Field({ nullable: true })
  sortOrder?: number;

  @Field({ nullable: true })
  isActive?: boolean;

  @Field({ nullable: true })
  screen?: string;

  @Field({ nullable: true })
  parameters?: string;
}
