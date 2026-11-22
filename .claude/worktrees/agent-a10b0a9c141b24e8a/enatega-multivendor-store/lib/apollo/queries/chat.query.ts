import { gql } from "@apollo/client";

export const CHAT = gql`
  query Chat($order: String!) {
    chat(order: $order) {
      id
      message
      user {
        id
        name
      }
      createdAt
    }
  }
`;
