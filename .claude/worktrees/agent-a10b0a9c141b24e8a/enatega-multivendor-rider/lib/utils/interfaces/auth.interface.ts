import { IGlobalProviderProps } from "./global.interface";

export interface IAuthContext {
  isSignedIn: boolean | undefined;
  getToken: () => Promise<string | null>;
  logout: () => Promise<void>;
}

export interface IAuthProviderProps extends IGlobalProviderProps {}
