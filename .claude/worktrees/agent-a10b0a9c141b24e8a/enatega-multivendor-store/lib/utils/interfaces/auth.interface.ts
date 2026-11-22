/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Dispatch, SetStateAction } from "react";
import { IGlobalProviderProps } from "./global.interface";

export interface ILoginInitialValues {
  email: string;
  password: string;
}

export interface IAuthContext {
  isSignedIn: boolean | undefined;
  getToken: () => Promise<string | null>;
  logout: () => Promise<void>;
  isSelected: string;
  setIsSelected: Dispatch<SetStateAction<string>>;
}

export interface IAuthProviderProps extends IGlobalProviderProps {}
