import { gql } from "@apollo/client";

export const LINK_RIDER_ACCOUNT = gql`
  mutation LinkRiderAccount {
    linkRiderAccount {
      _id
      name
      email
      phone
      zone {
        _id
      }
    }
  }
`;

export const EDIT_RIDER = gql`
  mutation EditRider($riderInput: RiderInput!) {
    editRider(riderInput: $riderInput) {
      _id
      name
      username
      phone
      password
      vehicleType
      zone {
        _id
      }
    }
  }
`;

export const CREATE_TRACKING_SESSION = gql`
  mutation CreateTrackingSession($orderId: ID!) {
    createTrackingSession(orderId: $orderId) {
      token
      expiresAt
    }
  }
`;

export const UPDATE_ORDER_RIDER_LOCATION = gql`
  mutation UpdateOrderRiderLocation(
    $orderId: ID!
    $location: RiderLocationInput!
    $bufferedPoints: [TrailPointInput!]
  ) {
    updateOrderRiderLocation(
      orderId: $orderId
      location: $location
      bufferedPoints: $bufferedPoints
    ) {
      orderId
      receivedAt
      updateId
    }
  }
`;

export const UPDATE_RIDER_DISPATCH_PRESENCE = gql`
  mutation UpdateRiderDispatchPresence($location: RiderLocationInput!) {
    updateRiderDispatchPresence(location: $location)
  }
`;

export const CREATE_DISPATCH_PRESENCE_SESSION = gql`
  mutation CreateDispatchPresenceSession {
    createDispatchPresenceSession {
      token
      expiresAt
    }
  }
`;

export const UPDATE_RIDER_DISPATCH_PRESENCE_BY_TOKEN = gql`
  mutation UpdateRiderDispatchPresenceByToken($location: RiderLocationInput!) {
    updateRiderDispatchPresenceByToken(location: $location)
  }
`;

export const UPDATE_AVAILABILITY = gql`
  mutation ToggleRider($available: Boolean!) {
    toggleRider(available: $available)
  }
`;

export const UPDATE_LICENSE = gql`
  mutation UpdateRiderLicenseDetails(
    $updateRiderLicenseDetailsId: String!
    $licenseDetails: LicenseDetailsInput
  ) {
    updateRiderLicenseDetails(
      id: $updateRiderLicenseDetailsId
      licenseDetails: $licenseDetails
    ) {
      _id
    }
  }
`;
export const UPDATE_VEHICLE = gql`
  mutation UpdateRiderVehicleDetails(
    $updateRiderVehicleDetailsId: String!
    $vehicleDetails: VehicleDetailsInput
  ) {
    updateRiderVehicleDetails(
      id: $updateRiderVehicleDetailsId
      vehicleDetails: $vehicleDetails
    ) {
      _id
    }
  }
`;
export const UPDATE_BUSINESS_DETAILS = gql`
  mutation UpdateRiderBussinessDetails(
    $bussinessDetails: BussinessDetailsInput
    $updateRiderBussinessDetailsId: String!
  ) {
    updateRiderBussinessDetails(
      bussinessDetails: $bussinessDetails
      id: $updateRiderBussinessDetailsId
    ) {
      _id
    }
  }
`;

export const UPDATE_WORK_SCHEDULE = gql`
  mutation UpdateWorkSchedule(
    $workSchedule: [DayScheduleInput!]!
    $timeZone: String!
  ) {
    updateWorkSchedule(
      workSchedule: $workSchedule
      timeZone: $timeZone
    ) {
      _id
      timeZone
      workSchedule {
        day
        enabled
        slots {
          startTime
          endTime
        }
      }
    }
  }
`;

export const UPLOAD_IMAGE_TO_S3 = gql`
  mutation UploadImageToS3($image: String!) {
    uploadImageToS3(image: $image) {
      imageUrl
    }
  }
`;
