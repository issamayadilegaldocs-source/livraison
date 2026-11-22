import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaxationsService } from './taxations.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('TaxationsService', () => {
  describe('create', () => {
    it('defaults taxationCharges to 0 and enabled to true when omitted', async () => {
      const taxationModel = { create: jest.fn().mockResolvedValue({ _id: 'tax_1' }) };
      const service = new TaxationsService(taxationModel as never);

      await service.create({} as never);

      expect(taxationModel.create).toHaveBeenCalledWith({ taxationCharges: 0, enabled: true });
    });

    it('persists explicit taxationCharges and enabled values', async () => {
      const taxationModel = { create: jest.fn().mockResolvedValue({ _id: 'tax_1' }) };
      const service = new TaxationsService(taxationModel as never);

      await service.create({ taxationCharges: 7.5, enabled: false } as never);

      expect(taxationModel.create).toHaveBeenCalledWith({ taxationCharges: 7.5, enabled: false });
    });
  });

  describe('edit', () => {
    it('rejects when no _id is provided', async () => {
      const taxationModel = { findByIdAndUpdate: jest.fn() };
      const service = new TaxationsService(taxationModel as never);
      await expect(service.edit({ taxationCharges: 5 } as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(taxationModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the taxation record does not exist', async () => {
      const taxationModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query(null)) };
      const service = new TaxationsService(taxationModel as never);
      await expect(service.edit({ _id: 'missing', taxationCharges: 5 } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('only patches fields explicitly provided (partial update)', async () => {
      const taxationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'tax_1', taxationCharges: 9 })),
      };
      const service = new TaxationsService(taxationModel as never);

      await service.edit({ _id: 'tax_1', taxationCharges: 9 } as never);

      expect(taxationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tax_1',
        { $set: { taxationCharges: 9 } },
        { new: true },
      );
    });

    it('allows disabling taxation without touching the rate', async () => {
      const taxationModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'tax_1', enabled: false })),
      };
      const service = new TaxationsService(taxationModel as never);

      await service.edit({ _id: 'tax_1', enabled: false } as never);

      expect(taxationModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'tax_1',
        { $set: { enabled: false } },
        { new: true },
      );
    });
  });
});
