import { gql } from "@apollo/client";

export const TOGGLE_AVAILIBILITY = gql`
  mutation ToggleAvailability {
    toggleStoreAvailability {
      _id
      isAvailable
    }
  }
`;

export const STOR_EDIT_RESTAURANT_PROFILE = gql`
  mutation StorEditRestaurantProfile($restaurant: RestaurantProfileInput!) {
    storEditRestaurantProfile(restaurant: $restaurant) {
      _id
      name
      image
      logo
      cuisines
      phone
    }
  }
`;
