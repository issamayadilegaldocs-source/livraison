import { gql } from "@apollo/client";

export const UPDATE_AVAILABILITY = gql`
  mutation ToggleStore($pauseMinutes: Int) {
    toggleStoreAvailability(pauseMinutes: $pauseMinutes) {
      _id
      isAvailable
      unavailableUntil
    }
  }
`;

export const UPDATE_BUSINESS_DETAILS = gql`
  mutation UpdateRestaurantBussinessDetails(
    $updateRestaurantBussinessDetailsId: String!
    $bussinessDetails: BussinessDetailsInput
  ) {
    updateRestaurantBussinessDetails(
      id: $updateRestaurantBussinessDetailsId
      bussinessDetails: $bussinessDetails
    ) {
      success
      message
      data {
        _id
      }
    }
  }
`;
