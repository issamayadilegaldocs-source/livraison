import { AuditService } from './audit.service';

describe('AuditService', () => {
  describe('create', () => {
    it('records the admin identity, action, target, and change payload with a timestamp', async () => {
      const auditModel = { create: jest.fn().mockResolvedValue(undefined) };
      const service = new AuditService(auditModel as never);
      const before = Date.now();

      await service.create(
        'admin_1',
        'admin@example.com',
        'UPDATE_CONFIGURATION',
        'Configuration',
        'config_1',
        JSON.stringify({ currency: { from: 'USD', to: 'TND' } }),
      );

      expect(auditModel.create).toHaveBeenCalledTimes(1);
      const payload = auditModel.create.mock.calls[0][0];
      expect(payload.admin).toEqual({ _id: 'admin_1', email: 'admin@example.com' });
      expect(payload.action).toBe('UPDATE_CONFIGURATION');
      expect(payload.targetType).toBe('Configuration');
      expect(payload.targetId).toBe('config_1');
      expect(payload.changes).toContain('TND');
      expect(payload.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('allows omitting the changes payload (e.g. for delete actions)', async () => {
      const auditModel = { create: jest.fn().mockResolvedValue(undefined) };
      const service = new AuditService(auditModel as never);

      await service.create('admin_1', 'admin@example.com', 'DELETE_ZONE', 'Zone', 'zone_1');

      expect(auditModel.create.mock.calls[0][0].changes).toBeUndefined();
    });
  });

  describe('findPaginated', () => {
    it('applies skip/limit derived from page and returns pagination metadata', async () => {
      const execFind = jest.fn().mockResolvedValue([{ _id: 'log_1' }]);
      const sort = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: execFind }) }) });
      const auditModel = {
        find: jest.fn().mockReturnValue({ sort }),
        countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(45) }),
      };
      const service = new AuditService(auditModel as never);

      const result = await service.findPaginated(2, 20);

      expect(result).toEqual({
        auditLogs: [{ _id: 'log_1' }],
        totalCount: 45,
        currentPage: 2,
        totalPages: 3,
      });
    });

    it('defaults to page 1 with a limit of 20', async () => {
      const execFind = jest.fn().mockResolvedValue([]);
      const limit = jest.fn().mockReturnValue({ exec: execFind });
      const skip = jest.fn().mockReturnValue({ limit });
      const sort = jest.fn().mockReturnValue({ skip });
      const auditModel = {
        find: jest.fn().mockReturnValue({ sort }),
        countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      };
      const service = new AuditService(auditModel as never);

      const result = await service.findPaginated();

      expect(skip).toHaveBeenCalledWith(0);
      expect(limit).toHaveBeenCalledWith(20);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(0);
    });
  });
});
