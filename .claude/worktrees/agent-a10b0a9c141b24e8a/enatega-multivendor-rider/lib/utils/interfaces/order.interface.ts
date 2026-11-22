import { ReactNode } from "react";
import { ORDER_TYPE } from "../types";
import { IGlobalComponentProps } from "./global.interface";
import { IRestaurantProfile } from "./resturant.interface";
import { IRiderProfile } from "./user.interface";

export interface IOrderComponentProps extends IGlobalComponentProps {
  tab: ORDER_TYPE;
  _id: string;
  orderId: string;
  orderStatus: string;
  restaurant: IOrder["restaurant"];
  deliveryAddress: IOrder["deliveryAddress"];
  paymentMethod?: string;
  orderAmount: number;
  paymentStatus: string;
  acceptedAt: string;
  user: IOrder["user"];
  isLast?: boolean;
  isExpress?: boolean;
  scheduledFor?: string;
}

export interface IOrder {
  _id: string;
  orderId: string;
  paymentMethod?: string;
  items: Array<{
    variation: {
      price: number;
      title: string;
    };
    addons?: Array<{
      _id: string;
      options: Array<{
        _id: string;
        price: number;
        title: string;
      }>;
    }>;
    description: ReactNode;
    image: string;
    title: string;
    quantity: number;
  }>;
  user: {
    _id: string;
    name: string;
    phone: string;
  };
  paymentStatus: string;
  createdAt: string;
  acceptedAt: string;
  deliveryAddress: {
    deliveryAddress: string;
    location: {
      coordinates: Array<number>;
    };
  };
  orderAmount: number;
  orderStatus: string;
  deliveryCharges?: number;
  riderCommission?: number;
  deliveryBonus?: number;
  tipping?: number;
  riderEarnings?: number;
  riderDeliveredAt?: string;
  customerDeliveredAt?: string;
  arrivedAt?: string;
  preparationTime: string;
  completionTime: string;
  isPickedUp: boolean;
  isRiderRinged: boolean;
  rider: IRiderProfile;
  restaurant: IRestaurantProfile;
  isExpress?: boolean;
  scheduledFor?: string;
}
