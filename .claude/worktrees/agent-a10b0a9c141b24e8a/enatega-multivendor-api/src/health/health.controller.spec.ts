import { HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';

function mockResponse() {
  const res: { status: jest.Mock; json: jest.Mock } = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as import('express').Response & typeof res;
}

describe('HealthController', () => {
  it('getHealth reports ok without checking dependencies', () => {
    const controller = new HealthController(
      { status: 'end' } as never,
      { readyState: 0 } as never,
    );

    expect(controller.getHealth().status).toBe('ok');
  });

  it('getReadiness returns 200 when mongo and redis are both up', () => {
    const controller = new HealthController(
      { status: 'ready' } as never,
      { readyState: 1 } as never,
    );
    const res = mockResponse();

    controller.getReadiness(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', mongo: 'ok', tracking: 'ok' }),
    );
  });

  it('getReadiness returns 503 when mongo is disconnected', () => {
    const controller = new HealthController(
      { status: 'ready' } as never,
      { readyState: 0 } as never,
    );
    const res = mockResponse();

    controller.getReadiness(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded', mongo: 'down' }),
    );
  });

  it('getReadiness returns 503 when redis is not ready', () => {
    const controller = new HealthController(
      { status: 'connecting' } as never,
      { readyState: 1 } as never,
    );
    const res = mockResponse();

    controller.getReadiness(res);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'degraded', tracking: 'degraded' }),
    );
  });
});
