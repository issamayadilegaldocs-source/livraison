import { gql } from "@apollo/client";

export const GET_CONFIG = gql`
  query Configuration {
    configuration {
      _id
      currency
      currencySymbol
      deliveryRate
      baseDeliveryFee
      baseDeliveryDistance
      deliveryFeeMinimum
      deliveryFeeMaximum
      deliveryRoundToNearest
      skipEmailVerification
      skipMobileVerification
      costType
      testOtp
      loyaltyEnabled
      loyaltyPointsPerUnit
      loyaltyPointsRedemptionRate
      expressEnabled
      expressSurcharge
      serviceFeeEnabled
      serviceFeeRate
      serviceFeeMinimum
      serviceFeeMaximum
    }
  }
`;
