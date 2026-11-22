import { gql } from "@apollo/client";

export const INITIATE_WALLET_TOPUP = gql`
  mutation InitiateWalletTopUp($amount: Float!) {
    initiateWalletTopUp(amount: $amount)
  }
`;
