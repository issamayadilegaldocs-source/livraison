import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SupportTicket, SupportTicketDocument } from './support-ticket.schema';
import { TicketMessage, TicketMessageDocument } from './ticket-message.schema';
import { SupportTicketInput, MessageInput, FiltersInput, SingleUserSupportTicketsInput, TicketMessagesInput } from './dto/support-ticket.input';

const POPULATE_USER = { path: 'user', select: '_id name email phone isActive userType' };
const POPULATE_TICKET = { path: 'ticket', select: '_id title status user', populate: POPULATE_USER };

@Injectable()
export class SupportTicketsService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
    @InjectModel(TicketMessage.name) private readonly messageModel: Model<TicketMessageDocument>,
  ) {}

  async createTicket(userId: string, input: SupportTicketInput): Promise<SupportTicketDocument> {
    const doc = await this.ticketModel.create({
      ...input,
      user: new Types.ObjectId(userId),
      status: 'open',
    });
    return (await this.ticketModel.findById(doc._id).populate(POPULATE_USER).lean().exec()) as SupportTicketDocument;
  }

  async createMessage(input: MessageInput, senderType = 'user'): Promise<TicketMessageDocument> {
    const ticket = await this.ticketModel.findById(input.ticketId).exec();
    if (!ticket) throw new NotFoundException('Ticket not found');
    const doc = await this.messageModel.create({
      content: input.content,
      senderType: input.senderType ?? senderType,
      ticket: new Types.ObjectId(input.ticketId),
      isRead: false,
    });
    return (await this.messageModel.findById(doc._id).lean().exec()) as TicketMessageDocument;
  }

  async updateTicketStatus(ticketId: string, status: string): Promise<SupportTicketDocument> {
    const updated = await this.ticketModel
      .findByIdAndUpdate(ticketId, { $set: { status } }, { new: true })
      .populate(POPULATE_USER)
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Ticket not found');
    return updated as SupportTicketDocument;
  }

  async getTicketUsersWithLatest(input: FiltersInput): Promise<{
    users: any[];
    docsCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      { $group: { _id: '$user', latestTicketId: { $last: '$_id' }, latestTicket: { $last: '$$ROOT' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDoc' } },
      { $unwind: '$userDoc' },
    ];

    if (input.search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userDoc.name': { $regex: input.search, $options: 'i' } },
            { 'userDoc.email': { $regex: input.search, $options: 'i' } },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [
      ...pipeline,
      { $sort: { 'latestTicket.createdAt': -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const [countResult, data] = await Promise.all([
      this.ticketModel.aggregate(countPipeline).exec(),
      this.ticketModel.aggregate(dataPipeline).exec(),
    ]);

    const docsCount = countResult[0]?.total ?? 0;
    const users = data.map((d: any) => ({
      _id: d.userDoc._id,
      name: d.userDoc.name,
      email: d.userDoc.email,
      phone: d.userDoc.phone,
      isActive: d.userDoc.isActive,
      userType: d.userDoc.userType,
      latestTicket: d.latestTicket,
    }));

    return { users, docsCount, totalPages: Math.ceil(docsCount / limit), currentPage: page };
  }

  async getTicketUsers(input: FiltersInput): Promise<{
    users: any[];
    docsCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const skip = (page - 1) * limit;

    const pipeline: any[] = [
      { $group: { _id: '$user' } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'userDoc' } },
      { $unwind: '$userDoc' },
    ];

    if (input.search) {
      pipeline.push({
        $match: {
          $or: [
            { 'userDoc.name': { $regex: input.search, $options: 'i' } },
            { 'userDoc.email': { $regex: input.search, $options: 'i' } },
          ],
        },
      });
    }

    const countPipeline = [...pipeline, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.ticketModel.aggregate(countPipeline).exec(),
      this.ticketModel.aggregate(dataPipeline).exec(),
    ]);

    const docsCount = countResult[0]?.total ?? 0;
    const users = data.map((d: any) => ({
      _id: d.userDoc._id,
      name: d.userDoc.name,
      email: d.userDoc.email,
      phone: d.userDoc.phone,
      isActive: d.userDoc.isActive,
      userType: d.userDoc.userType,
    }));

    return { users, docsCount, totalPages: Math.ceil(docsCount / limit), currentPage: page };
  }

  async getSingleUserSupportTickets(input: SingleUserSupportTicketsInput): Promise<{
    tickets: SupportTicketDocument[];
    docsCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 10;
    const skip = (page - 1) * limit;
    const query = { user: new Types.ObjectId(input.userId) };

    const [tickets, docsCount] = await Promise.all([
      this.ticketModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(POPULATE_USER)
        .lean()
        .exec(),
      this.ticketModel.countDocuments(query).exec(),
    ]);

    return { tickets: tickets as SupportTicketDocument[], docsCount, totalPages: Math.ceil(docsCount / limit), currentPage: page };
  }

  async getSingleSupportTicket(ticketId: string): Promise<SupportTicketDocument> {
    const ticket = await this.ticketModel.findById(ticketId).populate(POPULATE_USER).lean().exec();
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket as SupportTicketDocument;
  }

  async getTicketMessages(input: TicketMessagesInput): Promise<{
    messages: TicketMessageDocument[];
    ticket: any;
    page: number;
    totalPages: number;
    docsCount: number;
  }> {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const skip = (page - 1) * limit;
    const ticketOid = new Types.ObjectId(input.ticketId);

    const [ticket, messages, docsCount] = await Promise.all([
      this.ticketModel.findById(ticketOid).populate(POPULATE_USER).lean().exec(),
      this.messageModel
        .find({ ticket: ticketOid })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.messageModel.countDocuments({ ticket: ticketOid }).exec(),
    ]);

    if (!ticket) throw new NotFoundException('Ticket not found');

    return { messages: messages as TicketMessageDocument[], ticket, page, totalPages: Math.ceil(docsCount / limit), docsCount };
  }
}
