import { gql } from "@apollo/client";

export const MY_OFFERS = gql`
  query MyOffers {
    myOffers {
      _id
      title
      type
      value
      startsAt
      endsAt
      scope
      minOrderAmount
      maxDiscount
      enabled
      active
    }
  }
`;
