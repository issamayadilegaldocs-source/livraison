import { gql } from "@apollo/client";

export const PUSH_TOKEN = gql`
  mutation PushToken($token: String) {
    pushToken(token: $token) {
      _id
      notificationToken
    }
  }
`;

export const UNREGISTER_PUSH_TOKEN = gql`
  mutation UnregisterPushToken($token: String!) {
    unregisterPushToken(token: $token)
  }
`;
