import { ArgsType, Field, ID } from '@nestjs/graphql';
import { IsBoolean, IsLatitude, IsLongitude, IsMongoId } from 'class-validator';

@ArgsType()
export class DeliveryTimeEstimateArgs {
  @Field(() => ID)
  @IsMongoId()
  restaurantId!: string;

  @Field()
  @IsLatitude()
  latitude!: number;

  @Field()
  @IsLongitude()
  longitude!: number;

  @Field()
  @IsBoolean()
  isPickedUp!: boolean;
}
