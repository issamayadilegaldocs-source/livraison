import { NotFoundException } from '@nestjs/common';
import { ZonesService } from './zones.service';

const query = (resolved: unknown) => ({
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue(resolved),
});

describe('ZonesService', () => {
  describe('findByPoint', () => {
    it('queries active zones whose polygon geo-intersects the given point', async () => {
      const zoneModel = {
        findOne: jest.fn().mockReturnValue(query({ _id: 'zone_1', title: 'Sfax Centre' })),
      };
      const service = new ZonesService(zoneModel as never, {} as never);

      const result = await service.findByPoint(10.76, 34.74);

      expect(zoneModel.findOne).toHaveBeenCalledWith({
        isActive: true,
        location: {
          $geoIntersects: {
            $geometry: { type: 'Point', coordinates: [10.76, 34.74] },
          },
        },
      });
      expect(result).toEqual({ _id: 'zone_1', title: 'Sfax Centre' });
    });

    it('returns null when no active zone contains the point', async () => {
      const zoneModel = { findOne: jest.fn().mockReturnValue(query(null)) };
      const service = new ZonesService(zoneModel as never, {} as never);
      await expect(service.findByPoint(0, 0)).resolves.toBeNull();
    });
  });

  describe('create', () => {
    it('stores the polygon location as GeoJSON and defaults isActive to true', async () => {
      const save = jest.fn().mockResolvedValue({ _id: 'zone_new' });
      const zoneModelCtor = jest.fn().mockImplementation((doc: unknown) => ({ ...(doc as object), save }));
      const service = new ZonesService(zoneModelCtor as never, {} as never);

      await service.create({
        title: 'Sfax',
        description: 'Zone Sfax',
        location: { coordinates: [[[10, 34], [11, 34], [11, 35], [10, 34]]] },
      } as never);

      expect(zoneModelCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sfax',
          isActive: true,
          location: { type: 'Polygon', coordinates: [[[10, 34], [11, 34], [11, 35], [10, 34]]] },
        }),
      );
      expect(save).toHaveBeenCalled();
    });

    it('respects an explicit isActive: false', async () => {
      const save = jest.fn().mockResolvedValue({ _id: 'zone_new' });
      const zoneModelCtor = jest.fn().mockImplementation((doc: unknown) => ({ ...(doc as object), save }));
      const service = new ZonesService(zoneModelCtor as never, {} as never);

      await service.create({ title: 'Draft zone', isActive: false } as never);

      expect(zoneModelCtor).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('edit', () => {
    it('throws NotFoundException when the zone does not exist', async () => {
      const zoneModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query(null)) };
      const service = new ZonesService(zoneModel as never, {} as never);
      await expect(service.edit({ _id: 'missing', title: 'x' } as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('only patches fields that are explicitly provided', async () => {
      const zoneModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'zone_1', title: 'New title' })),
      };
      const service = new ZonesService(zoneModel as never, {} as never);

      await service.edit({ _id: 'zone_1', title: 'New title' } as never);

      expect(zoneModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'zone_1',
        { $set: { title: 'New title' } },
        { new: true },
      );
    });

    it('converts a provided location into GeoJSON Polygon on edit', async () => {
      const zoneModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 'zone_1' })) };
      const service = new ZonesService(zoneModel as never, {} as never);

      await service.edit({
        _id: 'zone_1',
        location: { coordinates: [[[1, 1], [2, 2], [3, 3], [1, 1]]] },
      } as never);

      expect(zoneModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'zone_1',
        { $set: { location: { type: 'Polygon', coordinates: [[[1, 1], [2, 2], [3, 3], [1, 1]]] } } },
        { new: true },
      );
    });
  });

  describe('delete', () => {
    it('blocks deletion when riders are still assigned to the zone', async () => {
      const zoneModel = { findByIdAndDelete: jest.fn() };
      const riderModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(3) }) };
      const service = new ZonesService(zoneModel as never, riderModel as never);

      await expect(
        service.delete('60fbc5c0f6d1a80015b6f1a1'),
      ).rejects.toThrow(/riders/i);
      expect(zoneModel.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('deletes a zone with no assigned riders', async () => {
      const zoneModel = { findByIdAndDelete: jest.fn().mockReturnValue(query({ _id: 'zone_1' })) };
      const riderModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }) };
      const service = new ZonesService(zoneModel as never, riderModel as never);

      await expect(service.delete('60fbc5c0f6d1a80015b6f1a1')).resolves.toEqual({ _id: 'zone_1' });
    });

    it('throws NotFoundException when the zone id does not resolve to a document', async () => {
      const zoneModel = { findByIdAndDelete: jest.fn().mockReturnValue(query(null)) };
      const riderModel = { countDocuments: jest.fn().mockReturnValue({ exec: () => Promise.resolve(0) }) };
      const service = new ZonesService(zoneModel as never, riderModel as never);

      await expect(service.delete('60fbc5c0f6d1a80015b6f1a1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
