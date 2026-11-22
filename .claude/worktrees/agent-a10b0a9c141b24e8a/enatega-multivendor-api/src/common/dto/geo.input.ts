import { Field, Float, InputType } from '@nestjs/graphql';
import { IsArray, IsNumber } from 'class-validator';

@InputType('CoordinatesInput')
export class CoordinatesInput {
  @Field(() => [Float])
  @IsArray()
  coordinates!: number[];
}

@InputType('PolygonInput')
export class PolygonInput {
  @Field(() => [[[Float]]])
  @IsArray()
  coordinates!: number[][][];
}

@InputType('CircleBoundsInput')
export class CircleBoundsInput {
  @Field(() => Float)
  @IsNumber()
  radius!: number;
}
