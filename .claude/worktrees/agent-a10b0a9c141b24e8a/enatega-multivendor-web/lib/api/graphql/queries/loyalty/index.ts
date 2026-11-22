import { gql } from "@apollo/client";

export const MY_LOYALTY_ACCOUNT = gql`
  query MyLoyaltyAccount {
    myLoyaltyAccount {
      _id
      points
      lifetimePoints
    }
  }
`;
