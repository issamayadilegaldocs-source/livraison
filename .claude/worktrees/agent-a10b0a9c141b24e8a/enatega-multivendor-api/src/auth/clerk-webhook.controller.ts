import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import { Request } from 'express';
import { OwnersService } from '../owners/owners.service';
import { UsersService } from '../users/users.service';

interface ClerkUserEventData {
  id: string;
  email_addresses: Array<{ email_address: string }>;
  phone_numbers: Array<{ phone_number: string }>;
  first_name?: string;
  last_name?: string;
  public_metadata?: Record<string, unknown>;
}

@Controller('webhooks')
export class ClerkWebhookController {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly ownersService: OwnersService,
  ) {}

  @Post('clerk')
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ): Promise<{ received: boolean }> {
    const secret = this.config.getOrThrow<string>('CLERK_WEBHOOK_SECRET');
    const wh = new Webhook(secret);
    let event: { type: string; data: ClerkUserEventData };

    try {
      event = wh.verify(req.rawBody as Buffer, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event;
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { id: clerkId, email_addresses, phone_numbers, first_name, last_name, public_metadata } =
      event.data;
    const email = email_addresses?.[0]?.email_address;
    const phone = phone_numbers?.[0]?.phone_number;
    const name = [first_name, last_name].filter(Boolean).join(' ') || undefined;
    const role = public_metadata?.role as string | undefined;

    if (event.type === 'user.created' || event.type === 'user.updated') {
      if (!role || role === 'CUSTOMER') {
        await this.usersService.findOrCreateByClerkId(clerkId, { email, phone, name });
      } else if (role === 'ADMIN' || role === 'VENDOR') {
        await this.ownersService.findOrCreateByClerkId(clerkId, {
          email: email!,
          name,
          userType: role,
        });
      }
      // STORE and RIDER records are pre-created by admin; a separate
      // linkClerkId mutation or admin action connects them.
    }

    if (event.type === 'user.deleted') {
      await Promise.allSettled([
        this.usersService.deactivateByClerkId(clerkId),
        this.ownersService.deactivateByClerkId(clerkId),
      ]);
    }

    return { received: true };
  }
}
