import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TippingsService } from './tippings.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('TippingsService', () => {
  describe('findFirst', () => {
    it('returns the singleton tipping config document', async () => {
      const tippingModel = { findOne: jest.fn().mockReturnValue(query({ _id: 't1', tipVariations: [1, 2, 3] })) };
      const service = new TippingsService(tippingModel as never);
      await expect(service.findFirst()).resolves.toEqual({ _id: 't1', tipVariations: [1, 2, 3] });
    });

    it('returns null when no tipping config has been created yet', async () => {
      const tippingModel = { findOne: jest.fn().mockReturnValue(query(null)) };
      const service = new TippingsService(tippingModel as never);
      await expect(service.findFirst()).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('defaults tipVariations to an empty array and enabled to true when omitted', async () => {
      const tippingModel = { create: jest.fn().mockResolvedValue({ _id: 't1' }) };
      const service = new TippingsService(tippingModel as never);

      await service.create({} as never);

      expect(tippingModel.create).toHaveBeenCalledWith({ tipVariations: [], enabled: true });
    });

    it('persists explicit tip variations', async () => {
      const tippingModel = { create: jest.fn().mockResolvedValue({ _id: 't1' }) };
      const service = new TippingsService(tippingModel as never);

      await service.create({ tipVariations: [2, 5, 10], enabled: true } as never);

      expect(tippingModel.create).toHaveBeenCalledWith({ tipVariations: [2, 5, 10], enabled: true });
    });
  });

  describe('edit', () => {
    it('rejects when no _id is provided', async () => {
      const tippingModel = { findByIdAndUpdate: jest.fn() };
      const service = new TippingsService(tippingModel as never);
      await expect(service.edit({ tipVariations: [1] } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException when the tipping record does not exist', async () => {
      const tippingModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query(null)) };
      const service = new TippingsService(tippingModel as never);
      await expect(service.edit({ _id: 'missing', enabled: false } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('only patches fields explicitly provided (partial update)', async () => {
      const tippingModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 't1', tipVariations: [3, 6] })),
      };
      const service = new TippingsService(tippingModel as never);

      await service.edit({ _id: 't1', tipVariations: [3, 6] } as never);

      expect(tippingModel.findByIdAndUpdate).toHaveBeenCalledWith(
        't1',
        { $set: { tipVariations: [3, 6] } },
        { new: true },
      );
    });
  });
});
