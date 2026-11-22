export interface ICoordinates {
  coordinates?: [string, string];
  __typename?: string;
}

export interface ITimings {
  // Canonical API shape is an "HH:MM" string (TimeValue scalar); legacy
  // documents may still carry the ["HH", "MM"] array shape.
  startTime: string | [string, string];
  endTime: string | [string, string];
  __typename: string;
}

export interface IOpeningTime {
  day: string;
  times: ITimings[];
  __typename: string;
}

export interface IRestaurantInfo {
  _id: string;
  name?: string;
  username?: string;
  phone?: string;
  address?: string;
  location?: ICoordinates;
  isAvailable?: boolean;
  openingTimes: IOpeningTime[];
  description: string;
  deliveryTime: String;
  deliveryTax: String;
  MinimumOrder: String;
}

export interface IInfoModalProps {
  visible: boolean;
  onHide: () => void;
  restaurantInfo: IRestaurantInfo;
}
