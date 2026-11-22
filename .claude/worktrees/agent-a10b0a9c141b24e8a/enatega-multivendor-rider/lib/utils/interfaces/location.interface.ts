/* eslint-disable @typescript-eslint/no-empty-object-type */
import { Dispatch } from "react";
import { SetStateAction } from "react";
import {
  IGlobalComponentProps,
  IGlobalProviderProps,
} from "./global.interface";

export interface ICoodinates {
  latitude: string;
  longitude: string;
}

/**
 * Full GPS sample surfaced from the foreground watcher. Unlike `ICoodinates`
 * (lat/lng strings kept for existing map consumers), this preserves the
 * accuracy/heading/speed/timestamp that adaptive cadence and stationary
 * detection in the tracking provider depend on.
 */
export interface IRiderCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface ILocationContextProps {
  location: ICoodinates;
  coords: IRiderCoordinates | null;
  locationPermission: boolean;
  setLocationPermission: Dispatch<SetStateAction<boolean>>;
}

export interface ILocationProviderProps extends IGlobalProviderProps {}

export interface ILocationPermissionComponentProps
  extends IGlobalComponentProps {}
