import { IStoreProfile } from "./user.interface";

export interface IStoreEarningsResponse {
  storeGrandTotalEarnings: {
    earnings: {
      grandTotalEarnings: {
        storeTotal: number;
      };
    };
  };
}

export interface IStoreTransaction {
  status: string;
  amountTransferred: number;
  createdAt: string;
}

export interface IStoreTransactionHistoryResponse {
  storeTransactionHistory: {
    data: IStoreTransaction[];
  };
}

export interface IStoreByIdResponse {
  restaurant: IStoreProfile;
}

export interface IStoreCurrentWithdrawRequestResponse {
  storeCurrentWithdrawRequest: {
    _id: string;
    requestAmount: number;
    status: string;
    createdAt: string;
  };
}

export interface IStoreCurrentWithdrawRequest {
  _id: string;
  requestAmount: number;
  status: string;
  createdAt: string;
}
