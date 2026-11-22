import { gql } from "@apollo/client";

export const OWNER_PROFILE = gql`
  query OwnerProfile {
    ownerProfile {
      _id
      email
      name
      userType
      restaurants {
        _id
        name
        image
        address
      }
    }
  }
`;

// Per-restaurant login: maps the active Clerk identity straight to the one
// restaurant it owns. Used as the primary resolution at finalizeSession, with
// OWNER_PROFILE as the fallback for owner/vendor-level accounts.
export const STORE_PROFILE = gql`
  query StoreProfile {
    storeProfile {
      _id
      name
      image
      address
    }
  }
`;
