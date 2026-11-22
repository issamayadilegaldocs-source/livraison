import { gql } from "@apollo/client";

// NOTE: Email/password login, signup, and password reset are now handled by
// Clerk (<SignIn>/<SignUp> in AuthModal). The former `login`, `emailExist`,
// `createUser`, and `resetPassword` mutations were removed from the API; their
// documents were deleted here to keep the client in sync with the schema.

export const PHONE_EXISTS = gql`
  mutation PhoneExist($phone: String!) {
    phoneExist(phone: $phone) {
      _id
    }
  }
`;

export const SENT_OTP_TO_EMAIL = gql`
  mutation SendOtpToEmail($email: String!) {
    sendOtpToEmail(email: $email) {
      _id
      destination
      verified
    }
  }
`;
export const SENT_OTP_TO_PHONE = gql`
  mutation SendOtpToPhoneNumber($phone: String!) {
    sendOtpToPhoneNumber(phone: $phone) {
      _id
      destination
      verified
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($name: String!, $phone: String) {
    updateUser(updateUserInput: { name: $name, phone: $phone }) {
      _id
      name
      phone
      phoneIsVerified
      emailIsVerified
    }
  }
`;

export const DEACTIVATE_USER = gql`
  mutation DeactivateUser($isActive: Boolean!, $email: String!) {
    Deactivate(isActive: $isActive, email: $email) {
      _id
      name
      email
      isActive
    }
  }
`;

export const VERIFY_OTP = gql`
  mutation VerifyOtp($verifyOtpInput: VerifyOtpInput!) {
    verifyOtp(verifyOtpInput: $verifyOtpInput) {
      _id
      destination
      verified
    }
  }
`;
