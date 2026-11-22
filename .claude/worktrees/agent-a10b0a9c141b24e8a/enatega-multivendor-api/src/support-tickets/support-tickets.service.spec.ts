import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SupportTicketsService } from './support-tickets.service';

const query = (resolved: unknown) => {
  const q: any = {};
  q.populate = jest.fn(() => q);
  q.lean = jest.fn(() => q);
  q.exec = jest.fn().mockResolvedValue(resolved);
  return q;
};

describe('SupportTicketsService', () => {
  describe('createTicket', () => {
    it('creates the ticket in "open" status scoped to the requesting user', async () => {
      const userId = new Types.ObjectId().toString();
      const created = { _id: new Types.ObjectId() };
      const ticketModel = {
        create: jest.fn().mockResolvedValue(created),
        findById: jest.fn().mockReturnValue(query({ _id: created._id, status: 'open' })),
      };
      const service = new SupportTicketsService(ticketModel as never, {} as never);

      const result = await service.createTicket(userId, { title: 'Order missing item' } as never);

      expect(ticketModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Order missing item', status: 'open' }),
      );
      expect((result as any).status).toBe('open');
    });
  });

  describe('createMessage', () => {
    it('throws NotFoundException when the ticket does not exist', async () => {
      const ticketModel = { findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) };
      const messageModel = { create: jest.fn() };
      const service = new SupportTicketsService(ticketModel as never, messageModel as never);

      await expect(
        service.createMessage({ ticketId: new Types.ObjectId().toString(), content: 'hi' } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageModel.create).not.toHaveBeenCalled();
    });

    it('defaults senderType to the caller-provided default when the input omits it', async () => {
      const ticketId = new Types.ObjectId();
      const ticketModel = {
        findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: ticketId }) }),
      };
      const created = { _id: new Types.ObjectId() };
      const messageModel = {
        create: jest.fn().mockResolvedValue(created),
        findById: jest.fn().mockReturnValue(query({ _id: created._id, senderType: 'admin', content: 'we are on it' })),
      };
      const service = new SupportTicketsService(ticketModel as never, messageModel as never);

      await service.createMessage(
        { ticketId: ticketId.toString(), content: 'we are on it' } as never,
        'admin',
      );

      expect(messageModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'we are on it', senderType: 'admin', isRead: false }),
      );
    });

    it('prefers an explicit senderType on the input over the default', async () => {
      const ticketId = new Types.ObjectId();
      const ticketModel = {
        findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: ticketId }) }),
      };
      const created = { _id: new Types.ObjectId() };
      const messageModel = {
        create: jest.fn().mockResolvedValue(created),
        findById: jest.fn().mockReturnValue(query(created)),
      };
      const service = new SupportTicketsService(ticketModel as never, messageModel as never);

      await service.createMessage(
        { ticketId: ticketId.toString(), content: 'hi', senderType: 'user' } as never,
        'admin',
      );

      expect(messageModel.create).toHaveBeenCalledWith(expect.objectContaining({ senderType: 'user' }));
    });
  });

  describe('updateTicketStatus', () => {
    it('throws NotFoundException when the ticket does not exist', async () => {
      const ticketModel = { findByIdAndUpdate: jest.fn().mockReturnValue(query(null)) };
      const service = new SupportTicketsService(ticketModel as never, {} as never);
      await expect(
        service.updateTicketStatus(new Types.ObjectId().toString(), 'resolved'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('updates the ticket status and returns the populated document', async () => {
      const ticketModel = {
        findByIdAndUpdate: jest.fn().mockReturnValue(query({ _id: 't1', status: 'resolved' })),
      };
      const service = new SupportTicketsService(ticketModel as never, {} as never);

      const result = await service.updateTicketStatus('t1', 'resolved');

      expect(ticketModel.findByIdAndUpdate).toHaveBeenCalledWith(
        't1',
        { $set: { status: 'resolved' } },
        { new: true },
      );
      expect((result as any).status).toBe('resolved');
    });
  });

  describe('getSingleSupportTicket', () => {
    it('throws NotFoundException for an unknown ticket id', async () => {
      const ticketModel = { findById: jest.fn().mockReturnValue(query(null)) };
      const service = new SupportTicketsService(ticketModel as never, {} as never);
      await expect(service.getSingleSupportTicket(new Types.ObjectId().toString())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
