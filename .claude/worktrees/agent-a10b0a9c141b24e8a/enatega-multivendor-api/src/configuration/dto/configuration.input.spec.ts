import { ValidationPipe } from '@nestjs/common';
import {
  DeliveryCostConfigurationInput,
  ExpressConfigurationInput,
  RiderCommissionConfigurationInput,
  RiderBonusConfigurationInput,
  ServiceFeeConfigurationInput,
} from './configuration.input';

// The admin configuration forms (delivery rate, express surcharge, rider
// commission) now enter money/rates as decimals via the shared `isCurrency`
// preset. The rider commission rate is stored as a 0–1 fraction, so the backend
// must accept values like 0.155 without rounding.
describe('Configuration money/rate inputs (decimal round-trip)', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('keeps decimal delivery rate and base fee intact', async () => {
    const input = (await pipe.transform(
      { deliveryRate: 1.25, costType: 'tiered', baseDeliveryFee: 0.5 },
      { type: 'body', metatype: DeliveryCostConfigurationInput },
    )) as DeliveryCostConfigurationInput;

    expect(input.deliveryRate).toBe(1.25);
    expect(input.baseDeliveryFee).toBe(0.5);
  });

  it('keeps linear delivery shaping values intact', async () => {
    const input = (await pipe.transform(
      {
        deliveryRate: 0.326,
        costType: 'linear',
        baseDeliveryFee: 1.75,
        deliveryFeeMinimum: 2,
        deliveryFeeMaximum: 6,
        deliveryRoundToNearest: 0.5,
      },
      { type: 'body', metatype: DeliveryCostConfigurationInput },
    )) as DeliveryCostConfigurationInput;

    expect(input).toEqual(expect.objectContaining({
      costType: 'linear',
      deliveryRate: 0.326,
      baseDeliveryFee: 1.75,
      deliveryFeeMinimum: 2,
      deliveryFeeMaximum: 6,
      deliveryRoundToNearest: 0.5,
    }));
  });

  it('keeps service-fee fractions and rider-bonus distances intact', async () => {
    const serviceFee = (await pipe.transform(
      { serviceFeeEnabled: true, serviceFeeRate: 0.07, serviceFeeMinimum: 0.7, serviceFeeMaximum: 5 },
      { type: 'body', metatype: ServiceFeeConfigurationInput },
    )) as ServiceFeeConfigurationInput;
    const riderBonus = (await pipe.transform(
      { deliveryBonusEnabled: true, deliveryBonusPerKm: 0.2, deliveryBonusFreeDistance: 2, deliveryBonusMax: 3.5 },
      { type: 'body', metatype: RiderBonusConfigurationInput },
    )) as RiderBonusConfigurationInput;

    expect(serviceFee.serviceFeeRate).toBe(0.07);
    expect(serviceFee.serviceFeeMinimum).toBe(0.7);
    expect(serviceFee.serviceFeeMaximum).toBe(5);
    expect(riderBonus).toEqual(expect.objectContaining({
      deliveryBonusEnabled: true,
      deliveryBonusPerKm: 0.2,
      deliveryBonusFreeDistance: 2,
      deliveryBonusMax: 3.5,
    }));
  });

  it('keeps a fractional rider commission rate intact', async () => {
    const input = (await pipe.transform(
      { riderCommissionRate: 0.155, deliveryAutoConfirmHours: 24 },
      { type: 'body', metatype: RiderCommissionConfigurationInput },
    )) as RiderCommissionConfigurationInput;

    expect(input.riderCommissionRate).toBe(0.155);
  });

  it('keeps a decimal express surcharge intact', async () => {
    const input = (await pipe.transform(
      { expressEnabled: true, expressSurcharge: 2.99 },
      { type: 'body', metatype: ExpressConfigurationInput },
    )) as ExpressConfigurationInput;

    expect(input.expressSurcharge).toBe(2.99);
  });
});
