import { ValidationPipe } from '@nestjs/common';
import { RiderInput } from './rider.input';

describe('RiderInput', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });

  it('accepts and transforms the admin create-rider payload', async () => {
    const input = await pipe.transform(
      {
        _id: '',
        name: 'German Man',
        username: 'germena',
        email: 'imen.hajji@sesame.com.tn',
        password: '3asba_3D_max',
        phone: '+61342424234',
        zone: '6a380e0b5d646553da32760b',
        vehicleType: 'bicycle',
        available: true,
      },
      { type: 'body', metatype: RiderInput },
    );

    expect(input).toBeInstanceOf(RiderInput);
    expect(input._id).toBeUndefined();
  });

  it('rejects invalid rider identifiers', async () => {
    await expect(
      pipe.transform(
        { zone: 'not-an-object-id' },
        { type: 'body', metatype: RiderInput },
      ),
    ).rejects.toThrow();
  });
});
