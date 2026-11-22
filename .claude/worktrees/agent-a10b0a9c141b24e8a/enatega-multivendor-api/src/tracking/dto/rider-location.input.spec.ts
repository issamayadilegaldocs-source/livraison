import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RiderLocationInput } from './rider-location.input';

describe('RiderLocationInput', () => {
  it('accepts a valid location point', async () => {
    const input = plainToInstance(RiderLocationInput, {
      latitude: 52.52,
      longitude: 13.405,
      accuracyMeters: 8,
      capturedAt: new Date().toISOString(),
      updateId: '694c4e52-72f1-4b0c-b6f2-88ac61732cf3',
    });

    await expect(validate(input)).resolves.toHaveLength(0);
  });

  it('rejects invalid coordinates and update identifiers', async () => {
    const input = plainToInstance(RiderLocationInput, {
      latitude: 91,
      longitude: -181,
      capturedAt: new Date().toISOString(),
      updateId: 'not-a-uuid',
    });

    const errors = await validate(input);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['latitude', 'longitude', 'updateId']),
    );
  });
});
