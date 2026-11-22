export const updateUser = `#graphql
      mutation UpdateUser($name:String!,$phone:String,$phoneIsVerified:Boolean,$emailIsVerified:Boolean){
          updateUser(updateUserInput:{name:$name,phone:$phone,phoneIsVerified:$phoneIsVerified,emailIsVerified:$emailIsVerified}){
            _id
            name
            phone
            phoneIsVerified
            emailIsVerified
          }
        }`;
