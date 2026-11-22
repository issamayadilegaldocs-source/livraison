import { gql } from "@apollo/client";

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead($ids: [String!]!) {
    markNotificationsRead(ids: $ids)
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead
  }
`;
