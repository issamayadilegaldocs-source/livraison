"use client";

import getEnv from "@/environment";
// GQL
import { GET_CONFIG } from "@/lib/api/graphql/queries";
import { ENV } from "@/lib/utils/constants";

// Interfaces
import { IConfigProps } from "@/lib/utils/interfaces";

// Apollo
import { useQuery } from "@apollo/client";
import { Libraries } from "@react-google-maps/api";

// i18n
import { useLocale } from "next-intl";

// Methods
import { localizedCurrencySymbol } from "@/lib/utils/methods";

// Core
import React, { ReactNode, useContext } from "react";

const ConfigurationContext = React.createContext({} as IConfigProps);

// Must be module-level: a new array on every render causes useJsApiLoader / LoadScript
// to detect a "changed" libraries prop and reload Google Maps on every render cycle.
const LIBRARIES: Libraries = ["places", "drawing", "geometry"];

export const ConfigurationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { loading, data, error } = useQuery(GET_CONFIG);
  const locale = useLocale();


  const configuration =
    loading || error || !data?.configuration ?
      {
        currency: "",
        currencySymbol: "",
        deliveryRate: 0,
        costType: "perKM",
        baseDeliveryFee: 0,
        baseDeliveryDistance: 0,
      }
    : data.configuration;

  
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
  const STRIPE_PUBLIC_KEY =
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const PAYPAL_KEY = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
  const AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || "";
  const COLORS = {
    GOOGLE: process.env.NEXT_PUBLIC_GOOGLE_COLOR || "",
  };
  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
  const SKIP_EMAIL_VERIFICATION = configuration.skipEmailVerification;
  const SKIP_MOBILE_VERIFICATION = configuration.skipMobileVerification;
  const CURRENCY = configuration.currency;
  const CURRENCY_SYMBOL = localizedCurrencySymbol(
    configuration.currency,
    configuration.currencySymbol,
    locale
  );
  const DELIVERY_RATE = configuration.deliveryRate;
  const COST_TYPE = configuration.costType;
  const BASE_DELIVERY_FEE = configuration.baseDeliveryFee ?? 0;
  const BASE_DELIVERY_DISTANCE = configuration.baseDeliveryDistance ?? 0;
  const DELIVERY_FEE_MINIMUM = configuration.deliveryFeeMinimum ?? 0;
  const DELIVERY_FEE_MAXIMUM = configuration.deliveryFeeMaximum ?? 0;
  const DELIVERY_ROUND_TO_NEAREST = configuration.deliveryRoundToNearest ?? 0;
  const TEST_OTP = configuration.testOtp;
  const LOYALTY_ENABLED = configuration.loyaltyEnabled ?? false;
  const LOYALTY_POINTS_PER_UNIT = configuration.loyaltyPointsPerUnit ?? 1;
  const LOYALTY_POINTS_REDEMPTION_RATE = configuration.loyaltyPointsRedemptionRate ?? 0;
  const EXPRESS_ENABLED = configuration.expressEnabled ?? false;
  const EXPRESS_SURCHARGE = configuration.expressSurcharge ?? 0;
  const SERVICE_FEE_ENABLED = configuration.serviceFeeEnabled ?? false;
  const SERVICE_FEE_RATE = configuration.serviceFeeRate ?? 0;
  const SERVICE_FEE_MINIMUM = configuration.serviceFeeMinimum ?? 0;
  const SERVICE_FEE_MAXIMUM = configuration.serviceFeeMaximum ?? 0;
  const CURRENCY_DECIMAL_DIGITS = configuration.currencyDecimalDigits ?? 2;

  const FIREBASE_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";
  const FIREBASE_PROJECT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  const FIREBASE_STORAGE_BUCKET =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
  const FIREBASE_MSG_SENDER_ID =
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "";
  const FIREBASE_APP_ID = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "";
  const FIREBASE_MEASUREMENT_ID =
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "";
  const FIREBASE_VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
  const FIREBASE_AUTH_DOMAIN =
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "";

  const { SERVER_URL } = getEnv(ENV);

  return (
    <ConfigurationContext.Provider
      value={{
        GOOGLE_CLIENT_ID,
        STRIPE_PUBLIC_KEY,
        PAYPAL_KEY,
        GOOGLE_MAPS_KEY,
        AMPLITUDE_API_KEY,
        LIBRARIES,
        COLORS,
        SENTRY_DSN,
        SKIP_EMAIL_VERIFICATION,
        SKIP_MOBILE_VERIFICATION,
        CURRENCY,
        CURRENCY_SYMBOL,
        DELIVERY_RATE,
        COST_TYPE,
        BASE_DELIVERY_FEE,
        BASE_DELIVERY_DISTANCE,
        DELIVERY_FEE_MINIMUM,
        DELIVERY_FEE_MAXIMUM,
        DELIVERY_ROUND_TO_NEAREST,
        TEST_OTP,
        SERVER_URL,
        FIREBASE_KEY,
        FIREBASE_APP_ID,
        FIREBASE_VAPID_KEY,
        FIREBASE_MEASUREMENT_ID,
        FIREBASE_MSG_SENDER_ID,
        FIREBASE_PROJECT_ID,
        FIREBASE_STORAGE_BUCKET,
        FIREBASE_AUTH_DOMAIN,
        LOYALTY_ENABLED,
        LOYALTY_POINTS_PER_UNIT,
        LOYALTY_POINTS_REDEMPTION_RATE,
        EXPRESS_ENABLED,
        EXPRESS_SURCHARGE,
        SERVICE_FEE_ENABLED,
        SERVICE_FEE_RATE,
        SERVICE_FEE_MINIMUM,
        SERVICE_FEE_MAXIMUM,
        CURRENCY_DECIMAL_DIGITS,
      }}
    >
      {children}
    </ConfigurationContext.Provider>
  );
};
export const ConfigurationConsumer = ConfigurationContext.Consumer;
export const useConfig = () => useContext(ConfigurationContext);
