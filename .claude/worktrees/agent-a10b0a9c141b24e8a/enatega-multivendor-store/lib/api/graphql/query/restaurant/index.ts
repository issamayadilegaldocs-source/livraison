import { gql } from "@apollo/client";

export const GET_RESTAURANT_BY_ID = gql`
  query Restaurant($id: String) {
    restaurant(id: $id) {
      _id
      orderId
      orderPrefix
      name
      image
      address
      location {
        coordinates
      }
      deliveryTime
      username
      isAvailable
      notificationToken
      enableNotification
      openingTimes {
        day
        times {
          startTime
          endTime
        }
      }
    }
  }
`;

export const GET_RESTAURANT_MENU = gql`
  query RestaurantMenu($id: String) {
    restaurant(id: $id) {
      _id
      name
      categories {
        _id
        title
        description
        foods {
          _id
          title
          description
          image
          isOutOfStock
          variations {
            _id
            title
            price
            discounted
          }
        }
      }
      options {
        _id
        title
        description
        price
      }
      addons {
        _id
        title
        description
        quantityMinimum
        quantityMaximum
        options
      }
    }
  }
`;
