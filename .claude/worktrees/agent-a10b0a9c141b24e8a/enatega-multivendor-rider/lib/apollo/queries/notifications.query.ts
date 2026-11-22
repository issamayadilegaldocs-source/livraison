import { gql } from "@apollo/client";

export const MY_NOTIFICATIONS = gql`
  query MyNotifications($limit: Int) {
    myNotifications(limit: $limit) {
      _id
      title
      body
      type
      isRead
      createdAt
    }
  }
`;

export const MY_UNREAD_COUNT = gql`
  query MyUnreadNotificationsCount {
    myUnreadNotificationsCount
  }
`;
