import { UserNotificationsService } from './user-notifications.service';

describe('UserNotificationsService', () => {
  describe('create', () => {
    it('defaults type to SYSTEM and isRead to false', async () => {
      const model = { create: jest.fn().mockResolvedValue({ _id: 'n1' }) };
      const service = new UserNotificationsService(model as never);

      await service.create('user_1', 'Order delivered', 'Enjoy your meal!');

      expect(model.create).toHaveBeenCalledWith({
        userId: 'user_1',
        title: 'Order delivered',
        body: 'Enjoy your meal!',
        type: 'SYSTEM',
        data: undefined,
        isRead: false,
      });
    });

    it('persists an explicit type and structured data payload', async () => {
      const model = { create: jest.fn().mockResolvedValue({ _id: 'n1' }) };
      const service = new UserNotificationsService(model as never);

      await service.create('user_1', 'Promo', 'Half off today', 'PROMOTION', { code: 'HALF50' });

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PROMOTION', data: { code: 'HALF50' } }),
      );
    });
  });

  describe('findForUser', () => {
    it('scopes to the given userId, sorts newest first, and serializes data to JSON', async () => {
      const docs = [
        { _id: 'n1', userId: 'user_1', data: { code: 'X' } },
        { _id: 'n2', userId: 'user_1' },
      ];
      const find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(docs),
      });
      const model = { find };
      const service = new UserNotificationsService(model as never);

      const result = await service.findForUser('user_1');

      expect(find).toHaveBeenCalledWith({ userId: 'user_1' });
      expect(result[0].dataJson).toBe(JSON.stringify({ code: 'X' }));
      expect(result[1].dataJson).toBeUndefined();
      expect(typeof result[0]._id).toBe('string');
    });

    it('defaults the page size to 30', async () => {
      const limit = jest.fn().mockReturnThis();
      const find = jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit,
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });
      const service = new UserNotificationsService({ find } as never);

      await service.findForUser('user_1');

      expect(limit).toHaveBeenCalledWith(30);
    });
  });

  describe('countUnread', () => {
    it('counts only unread notifications for the given user', async () => {
      const countDocuments = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(4) });
      const service = new UserNotificationsService({ countDocuments } as never);

      await expect(service.countUnread('user_1')).resolves.toBe(4);
      expect(countDocuments).toHaveBeenCalledWith({ userId: 'user_1', isRead: false });
    });
  });

  describe('markRead / markAllRead — per-user scoping (cannot mark another user\'s notifications)', () => {
    it('markRead scopes the update to both the given ids AND the given userId', async () => {
      const updateMany = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }) });
      const service = new UserNotificationsService({ updateMany } as never);

      const count = await service.markRead('user_1', ['n1', 'n2']);

      expect(updateMany).toHaveBeenCalledWith(
        { _id: { $in: ['n1', 'n2'] }, userId: 'user_1' },
        { $set: { isRead: true } },
      );
      expect(count).toBe(2);
    });

    it('markAllRead only touches currently-unread notifications for that user', async () => {
      const updateMany = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ modifiedCount: 5 }) });
      const service = new UserNotificationsService({ updateMany } as never);

      const count = await service.markAllRead('user_1');

      expect(updateMany).toHaveBeenCalledWith(
        { userId: 'user_1', isRead: false },
        { $set: { isRead: true } },
      );
      expect(count).toBe(5);
    });
  });
});
