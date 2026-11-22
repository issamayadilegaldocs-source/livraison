/* eslint-disable @typescript-eslint/no-empty-object-type */
import { IGlobalProps, IGlobalProviderProps } from "./global.interface";

export interface IConfigurationContextProps extends IGlobalProps {}

export interface IConfiguration {
  _id: string;
  currency: string;
  currencySymbol: string;
  riderCommissionRate?: number;
}

export interface IConfigurationProviderProps extends IGlobalProviderProps {}
