import { gql } from "@apollo/client";

export const saveNotificationTokenWeb = gql`mutation SaveNotificationTokenWeb($token:String!){
    saveNotificationTokenWeb(token:$token)
  }`;
  export const updateNotificationStatus = gql` mutation updateNotificationStatus($orderNotification: Boolean!, $offerNotification: Boolean! ) {
   updateNotificationStatus(offerNotification:$offerNotification,orderNotification:$orderNotification){
    _id
    isOrderNotification
    isOfferNotification
   }
  }
`;
