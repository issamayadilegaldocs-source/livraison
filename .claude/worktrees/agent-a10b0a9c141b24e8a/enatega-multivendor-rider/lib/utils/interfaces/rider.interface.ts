import { IRiderProfile } from './user.interface'

export interface IRiderEarningsResponse {
  earnings: {
    data: {
      grandTotalEarnings: {
        riderTotal: number
      }
      earnings: {
        riderEarnings: {
          deliveryFee: number
          tip: number
          totalEarnings: number
        }
      }
    }
  }
}

export interface IRiderTransaction {
  status: string
  amountTransferred: number
  createdAt: string
}

export interface IRiderTransactionHistoryResponse {
  transactionHistory: {
    transactions: IRiderTransaction[]
  }
}

export interface IRiderByIdResponse {
  riderProfile: IRiderProfile;
}

export interface IRiderCurrentWithdrawRequestResponse {
  riderCurrentWithdrawRequest: {
    _id: string
    requestAmount: number
    status: string
    createdAt: string
  }
}

export interface IRiderCurrentWithdrawRequest {
  _id: string
  requestAmount: number
  status: string
  createdAt: string
}
