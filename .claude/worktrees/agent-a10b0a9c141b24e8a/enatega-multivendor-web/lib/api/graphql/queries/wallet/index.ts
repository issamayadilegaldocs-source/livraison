import { gql } from "@apollo/client";

export const MY_WALLET = gql`
  query MyWallet {
    myWallet {
      userId
      balance
    }
  }
`;
