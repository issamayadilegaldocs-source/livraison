import { Dispatch, SetStateAction } from "react";

export interface IAppBarProps {
  handleModalToggle: () => void;
}
export interface IAuthModalProps {
  isAuthModalVisible: boolean;
  handleModalToggle: () => void;
}

export interface IAuthFormData {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
  type?: "default" | "google";
  isPhoneExists?: boolean;
}

// Slim context — Clerk owns identity; this context owns modal state.
export interface IAuthContextProps {
  /** Truthy when signed in (actual Clerk JWT). Use getToken() for fresh tokens in requests. */
  authToken: string;
  /** Legacy setter — pass "" to sign out, otherwise no-op. */
  setAuthToken: Dispatch<SetStateAction<string>>;
  /** Obtain a fresh Clerk session JWT for authenticated requests. */
  getToken: () => Promise<string | null>;
  isAuthModalVisible: boolean;
  setIsAuthModalVisible: Dispatch<SetStateAction<boolean>>;
  /** 0 = sign-in panel, 1 = sign-up panel */
  activePanel: number;
  setActivePanel: Dispatch<SetStateAction<number>>;
}

export interface ILoginWithEmailProps {
  handleChangePanel: (index: number) => void;
  handleFormChange: (name: string, value: string) => void;
  formData: IAuthFormData;
  setFormData: Dispatch<SetStateAction<IAuthFormData>>;
}

export interface ISaveEmailAddressProps {
  handleChangePanel: (index: number) => void;
}

export interface IEmailVerificationProps {
  emailOtp: string;
  setEmailOtp: Dispatch<SetStateAction<string>>;
  handleChangePanel: (index: number) => void;
  formData: IAuthFormData;
  setFormData: Dispatch<SetStateAction<IAuthFormData>>;
}

export interface IPhoneVerificationProps {
  phoneOtp: string;
  setPhoneOtp: Dispatch<SetStateAction<string>>;
  handleChangePanel: (index: number) => void;
  formData: IAuthFormData;
}

export interface IUserLoginArguments {
  appleId?: string;
  email?: string;
  password?: string;
  phone?: string;
  type?: string;
  name?: string;
  notificationToken?: string;
  isActive?: boolean;
}

export interface ILoginProfile {
  userId?: string;
  token?: string;
  tokenExpiration?: string;
  name?: string;
  phone?: string;
  phoneIsVerified?: boolean;
  email?: string;
  emailIsVerified?: boolean;
  picture?: string;
  addresses?: {
    location?: {
      coordinates?: string[];
    };
    deliveryAddress?: string;
  };
  isNewUser?: boolean;
  userTypeId?: string;
  isActive?: boolean;
}
export interface ILoginProfileResponse {
  login: ILoginProfile;
}

export interface IPhoneExistsResponse {
  phoneExist: { _id: string };
}

export interface IEmailExists {
  _id: string;
  userType: string;
}
export interface IEmailExistsResponse {
  emailExist: IEmailExists;
}

export interface ISendOtpToPhoneResponse {
  sendOtpToPhoneNumber: { _id: string; destination: string; verified: boolean };
}

export interface ISendOtpToEmailResponse {
  sendOtpToEmail: { _id: string; destination: string; verified: boolean };
}

export interface IUpdateUserResponse {
  updateUser: {
    name: string;
    phone?: string;
    phoneIsVerified: boolean;
    emailIsVerified: boolean;
  };
}
export interface Point {
  coordinates: [number, number];
}

export interface IUserAddress {
  _id: string;
  location?: Point;
  deliveryAddress: string;
  details?: string;
  label: string;
  selected?: boolean;
}
export interface IUserAddressProps {
  userAddress: IUserAddress | null;
  setUserAddress: (address: IUserAddress | null) => void;
}

export interface IEnterPasswordProps {
  handleChangePanel: (index: number) => void;
  handleFormChange: (name: string, value: string) => void;
  setFormData: Dispatch<SetStateAction<IAuthFormData>>;
  formData: IAuthFormData;
}

export interface IUserAddressComponentProps {
  confirmYourAddress?: boolean;
  editAddress?: IUserAddress | null;
  visible: boolean;
  onHide: () => void;
}

export interface ICreateUserData {
  userId: string;
  token: string;
  tokenExpiration: number;
  name: string;
  phone: string;
  phoneIsVerified: boolean;
  email: string;
  emailIsVerified: boolean;
  picture: string;
  isNewUser: boolean;
  userTypeId: string;
}
export interface ICreateUserResponse {
  createUser: ICreateUserData;
}

export interface ICreateUserArguments {
  phone?: string;
  email?: string;
  password?: string;
  name?: string;
  notificationToken?: string;
  appleId?: string;
  emailIsVerified?: boolean;
  isPhoneExists?: boolean;
}
export interface IVerificationEmailForChangePasswordProps {
  handleSubmitAfterVerification: () => void;
  handleResendEmailOtp: () => void;
  emailOtp: string;
  setEmailOtp: (otp: string) => void;
  formData: { email?: string; password?: string; name?: string; phone?: string };
}

export interface VerifyOtpResponse {
  verifyOtp: {
    _id: string;
    destination: string;
    verified: boolean;
  };
}

export interface VerifyOtpVariables {
  verifyOtpInput: {
    code: string;
    destination: string;
  };
}
