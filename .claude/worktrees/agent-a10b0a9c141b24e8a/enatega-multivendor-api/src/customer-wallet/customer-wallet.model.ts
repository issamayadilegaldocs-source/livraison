import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { MoneyModel } from '../common/money/money.model';

@ObjectType('CustomerWalletTransaction')
export class CustomerWalletTransactionModel {
  @Field(() => ID) _id!: string;
  @Field() type!: string;
  @Field(() => Float) amount!: number;
  @Field(() => Float, { nullable: true }) balanceAfter?: number;
  @Field(() => MoneyModel, { nullable: true }) amountMoney?: MoneyModel;
  @Field(() => MoneyModel, { nullable: true }) balanceAfterMoney?: MoneyModel;
  @Field(() => ID, { nullable: true }) order?: string;
  @Field({ nullable: true }) reason?: string;
  @Field({ nullable: true }) createdAt?: string;
}

@ObjectType('CustomerWallet')
export class CustomerWalletModel {
  @Field(() => Float) balance!: number;
  @Field({ nullable: true }) currency?: string;
  @Field(() => MoneyModel, { nullable: true }) balanceMoney?: MoneyModel;
  @Field(() => [CustomerWalletTransactionModel], { nullable: true })
  transactions?: CustomerWalletTransactionModel[];
}
