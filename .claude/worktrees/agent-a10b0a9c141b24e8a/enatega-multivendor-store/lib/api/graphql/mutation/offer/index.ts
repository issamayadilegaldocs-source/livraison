import { gql } from "@apollo/client";

export const CREATE_OFFER = gql`
  mutation CreateOffer($offerInput: OfferInput!) {
    createOffer(offerInput: $offerInput) {
      _id
      type
      value
      startsAt
      endsAt
      active
    }
  }
`;

export const EDIT_OFFER = gql`
  mutation EditOffer($offerInput: OfferInput!) {
    editOffer(offerInput: $offerInput) {
      _id
      type
      value
      startsAt
      endsAt
      active
    }
  }
`;

export const CANCEL_OFFER = gql`
  mutation CancelOffer($id: ID!) {
    cancelOffer(id: $id)
  }
`;
