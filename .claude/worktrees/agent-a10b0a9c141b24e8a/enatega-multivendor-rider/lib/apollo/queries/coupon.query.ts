export const getCoupon = `#graphql
mutation Coupon($coupon:String!){
    coupon(coupon:$coupon){
      success
      message
      coupon {
        _id
        title
        discount
        enabled
      }
    }
  }`;
