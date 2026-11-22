import { registerEnumType } from '@nestjs/graphql';

export enum DeliveryTimeEstimationMode {
  STATIC = 'static',
  DYNAMIC = 'dynamic',
}

registerEnumType(DeliveryTimeEstimationMode, {
  name: 'DeliveryTimeEstimationMode',
});
