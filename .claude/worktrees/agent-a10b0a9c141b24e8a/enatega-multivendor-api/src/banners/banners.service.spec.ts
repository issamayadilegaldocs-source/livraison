import { NotFoundException } from '@nestjs/common';
import { BannersService } from './banners.service';

const query = (resolved: unknown) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('BannersService', () => {
  describe('findAll', () => {
    it('excludes explicitly-inactive banners and sorts by sortOrder then recency', async () => {
      const bannerModel = { find: jest.fn().mockReturnValue(query([{ _id: 'b1' }])) };
      const service = new BannersService(bannerModel as never);

      await service.findAll();

      expect(bannerModel.find).toHaveBeenCalledWith({ isActive: { $ne: false } });
    });
  });

  describe('create', () => {
    it('defaults sortOrder to 0 and isActive to true', async () => {
      const save = jest.fn().mockResolvedValue({ _id: 'banner_1' });
      const bannerModelCtor = jest.fn().mockImplementation((doc: unknown) => ({ ...(doc as object), save }));
      const service = new BannersService(bannerModelCtor as never);

      await service.create({ title: 'Summer sale' } as never);

      expect(bannerModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Summer sale', sortOrder: 0, isActive: true }),
      );
    });

    it('carries through explicit styling and deep-link fields', async () => {
      const save = jest.fn().mockResolvedValue({ _id: 'banner_1' });
      const bannerModelCtor = jest.fn().mockImplementation((doc: unknown) => ({ ...(doc as object), save }));
      const service = new BannersService(bannerModelCtor as never);

      await service.create({
        title: 'Promo',
        promoCode: 'SAVE10',
        screen: 'Restaurant',
        parameters: { restaurantId: 'r1' },
        sortOrder: 5,
        isActive: false,
      } as never);

      expect(bannerModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          promoCode: 'SAVE10',
          screen: 'Restaurant',
          parameters: { restaurantId: 'r1' },
          sortOrder: 5,
          isActive: false,
        }),
      );
    });
  });

  describe('edit', () => {
    it('throws NotFoundException when the banner does not exist', async () => {
      const bannerModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query(null)) };
      const service = new BannersService(bannerModel as never);
      await expect(service.edit({ _id: 'missing', title: 'x' } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('strips undefined fields from the patch so unrelated columns are untouched', async () => {
      const bannerModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'banner_1', title: 'New title' })),
      };
      const service = new BannersService(bannerModel as never);

      await service.edit({ _id: 'banner_1', title: 'New title' } as never);

      expect(bannerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'banner_1',
        { $set: { title: 'New title' } },
        { new: true },
      );
    });

    it('allows explicitly clearing isActive to false', async () => {
      const bannerModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'banner_1', isActive: false })),
      };
      const service = new BannersService(bannerModel as never);

      await service.edit({ _id: 'banner_1', isActive: false } as never);

      expect(bannerModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'banner_1',
        { $set: { isActive: false } },
        { new: true },
      );
    });
  });

  describe('delete', () => {
    it('returns true when a banner was deleted', async () => {
      const bannerModel = { findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: 'b1' }) }) };
      const service = new BannersService(bannerModel as never);
      await expect(service.delete('b1')).resolves.toBe(true);
    });

    it('returns false when the banner id does not exist', async () => {
      const bannerModel = { findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) };
      const service = new BannersService(bannerModel as never);
      await expect(service.delete('missing')).resolves.toBe(false);
    });
  });
});
