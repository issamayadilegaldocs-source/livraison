import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('WithdrawBussinessDetails')
export class WithdrawBussinessDetailsModel {
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) accountName?: string;
  @Field({ nullable: true }) accountCode?: string;
  @Field({ nullable: true }) accountNumber?: string;
  @Field({ nullable: true }) bussinessRegNo?: string;
  @Field({ nullable: true }) companyRegNo?: string;
  @Field({ nullable: true }) taxRate?: string;
}

@ObjectType('WithdrawRider')
export class WithdrawRiderModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) name?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) username?: string;
  /** Never populated — kept nullable for legacy admin selections. */
  @Field({ nullable: true }) password?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) available?: boolean;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) accountNumber?: string;
  @Field(() => Float, { nullable: true }) currentWalletAmount?: number;
  @Field(() => Float, { nullable: true }) totalWalletAmount?: number;
  @Field(() => Float, { nullable: true }) withdrawnWalletAmount?: number;
  @Field({ nullable: true }) createdAt?: string;
  @Field({ nullable: true }) updatedAt?: string;
  @Field(() => WithdrawBussinessDetailsModel, { nullable: true }) bussinessDetails?: WithdrawBussinessDetailsModel;
}

@ObjectType('WithdrawStore')
export class WithdrawStoreModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field({ nullable: true }) unique_restaurant_id?: string;
  @Field({ nullable: true }) name?: string;
  @Field(() => Float, { nullable: true }) rating?: number;
  @Field(() => Float, { nullable: true }) reviewAverage?: number;
  @Field({ nullable: true }) isActive?: boolean;
  @Field({ nullable: true }) isAvailable?: boolean;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) postCode?: string;
  @Field({ nullable: true }) image?: string;
  @Field({ nullable: true }) logo?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) username?: string;
  @Field({ nullable: true }) password?: string;
  @Field({ nullable: true }) slug?: string;
  @Field({ nullable: true }) stripeDetailsSubmitted?: boolean;
  @Field(() => Float, { nullable: true }) commissionRate?: number;
  @Field(() => WithdrawBussinessDetailsModel, { nullable: true }) bussinessDetails?: WithdrawBussinessDetailsModel;
}

@ObjectType()
export class WithdrawPaginationMeta {
  @Field(() => Int) total!: number;
}

@ObjectType()
export class WithdrawRequestModel {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) requestId?: string;
  @Field(() => Float) requestAmount!: number;
  @Field({ nullable: true }) requestTime?: string;
  @Field() status!: string;
  @Field({ nullable: true }) createdAt?: string;
  @Field(() => Float, { nullable: true }) currentWalletAmount?: number;
  @Field(() => Float, { nullable: true }) totalWalletAmount?: number;
  @Field(() => Float, { nullable: true }) withdrawnWalletAmount?: number;
  @Field(() => Float, { nullable: true }) approvedAmount?: number;
  @Field({ nullable: true }) reason?: string;
  @Field(() => WithdrawRiderModel, { nullable: true }) rider?: WithdrawRiderModel;
  @Field(() => WithdrawStoreModel, { nullable: true }) store?: WithdrawStoreModel;
}

@ObjectType()
export class WithdrawRequestsResult {
  @Field() success!: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => WithdrawPaginationMeta, { nullable: true }) pagination?: WithdrawPaginationMeta;
  @Field(() => [WithdrawRequestModel]) data!: WithdrawRequestModel[];
}

@ObjectType('RiderAndWithdrawRequest')
export class RiderAndWithdrawRequestModel {
  @Field() success!: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => WithdrawRequestModel, { nullable: true }) data?: WithdrawRequestModel;
}

@ObjectType()
export class WithdrawRequestResponse {
  @Field() status!: string;
}

@ObjectType()
export class TransactionHistoryRow {
  @Field(() => ID) _id!: string;
  @Field({ nullable: true }) amountCurrency?: string;
  @Field() status!: string;
  @Field({ nullable: true }) transactionId?: string;
  @Field({ nullable: true }) userType?: string;
  @Field({ nullable: true }) userId?: string;
  @Field(() => Float, { nullable: true }) amountTransferred?: number;
  @Field(() => Float, { nullable: true }) requestAmount?: number;
  @Field({ nullable: true }) createdAt?: string;
  @Field(() => WithdrawBussinessDetailsModel, { nullable: true }) toBank?: WithdrawBussinessDetailsModel;
  @Field(() => WithdrawRiderModel, { nullable: true }) rider?: WithdrawRiderModel;
  @Field(() => WithdrawStoreModel, { nullable: true }) store?: WithdrawStoreModel;
}

@ObjectType()
export class TransactionHistoryResult {
  @Field({ nullable: true }) success?: boolean;
  @Field({ nullable: true }) message?: string;
  @Field(() => [TransactionHistoryRow]) data!: TransactionHistoryRow[];
  @Field(() => [TransactionHistoryRow], { nullable: true }) transactions?: TransactionHistoryRow[];
  @Field(() => WithdrawPaginationMeta, { nullable: true }) pagination?: WithdrawPaginationMeta;
}

@ObjectType()
export class StoreCurrentWithdrawRequestModel {
  @Field(() => ID, { nullable: true }) _id?: string;
  @Field(() => Float, { nullable: true }) requestAmount?: number;
  @Field({ nullable: true }) status?: string;
  @Field({ nullable: true }) createdAt?: string;
}

@ObjectType()
export class StoreTransactionEntry {
  @Field({ nullable: true }) status?: string;
  @Field(() => Float, { nullable: true }) amountTransferred?: number;
  @Field({ nullable: true }) createdAt?: string;
}

@ObjectType()
export class StoreTransactionHistoryResponse {
  @Field(() => [StoreTransactionEntry]) data!: StoreTransactionEntry[];
}
