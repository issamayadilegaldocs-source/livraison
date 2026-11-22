import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { BadRequestException, NotFoundException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClerkClient } from '@clerk/backend';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { assertClerkRolePromotable } from '../auth/clerk-role-conflict.util';
import { RiderModel } from './rider.model';
import { RiderInput } from './dto/rider.input';
import { RidersService } from './riders.service';

@Resolver(() => RiderModel)
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class RidersAdminResolver {
  constructor(
    private readonly ridersService: RidersService,
    private readonly config: ConfigService,
  ) {}

  @Query(() => [RiderModel], { name: 'riders' })
  findAll() {
    return this.ridersService.findAll();
  }

  @Roles(Role.ADMIN, Role.RIDER, Role.CUSTOMER, Role.STORE, Role.VENDOR)
  @Query(() => RiderModel, { name: 'rider', nullable: true })
  async findOne(
    @CurrentUser() jwt: JwtUser,
    @Args('id', { type: () => String, nullable: true }) id?: string,
  ) {
    if (!id && jwt.role === Role.RIDER) {
      return this.ridersService.findByClerkId(jwt.userId);
    }
    return id ? this.ridersService.findById(id) : null;
  }

  @Query(() => [RiderModel], { name: 'availableRiders' })
  availableRiders() {
    return this.ridersService.findAvailable();
  }

  @Query(() => [RiderModel], { name: 'ridersByZone' })
  ridersByZone(@Args('id', { type: () => String }) id: string) {
    return this.ridersService.findByZone(id);
  }

  @Mutation(() => RiderModel, { name: 'createRider', nullable: true })
  async createRider(
    @Args('riderInput', { type: () => RiderInput }) riderInput: RiderInput,
  ) {
    const email = riderInput.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException('Email is required');
    if (!riderInput.password) throw new BadRequestException('Password is required');

    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const clerk = createClerkClient({ secretKey });

    // 1. Create the Clerk account first so the rider can sign in with email/password
    //    on the mobile app. If the email already exists in Clerk (e.g. the user
    //    registered before being added as a rider), reuse that account.
    let clerkUserId: string;
    let reusingExistingClerkAccount = false;
    try {
      const parts = (riderInput.name ?? '').trim().split(/\s+/).filter(Boolean);
      const clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        password: riderInput.password,
        firstName: parts[0] || undefined,
        lastName: parts.slice(1).join(' ') || undefined,
        skipPasswordChecks: true,
        publicMetadata: { role: 'RIDER' },
      });
      clerkUserId = clerkUser.id;
    } catch (err: unknown) {
      const e = err as {
        errors?: { code?: string; message?: string; longMessage?: string }[];
        message?: string;
      };
      const isEmailTaken = e?.errors?.some(
        (x) => x.code === 'form_identifier_exists' || /email.*taken|already.*exist/i.test(x.message ?? ''),
      );

      if (!isEmailTaken) {
        const message =
          e?.errors?.[0]?.longMessage ??
          e?.errors?.[0]?.message ??
          e?.message ??
          'Failed to create Clerk account';
        throw new BadRequestException(`Clerk: ${message}`);
      }

      // Email already registered in Clerk — find that user and reuse the account.
      const list = await clerk.users.getUserList({ emailAddress: [email] });
      const existing = list.data?.[0];
      if (!existing) throw new BadRequestException('Email is already taken');

      // If this Clerk account is already linked to a rider, reject the duplicate.
      const linked = await this.ridersService.findByClerkId(existing.id);
      if (linked) throw new BadRequestException('A rider with this email already exists');

      // This Clerk account might be an unrelated ADMIN/VENDOR identity that
      // merely shares an email — never silently overwrite its role.
      assertClerkRolePromotable(
        (existing.publicMetadata as { role?: string } | undefined)?.role,
        Role.RIDER,
        'account',
      );

      // Promote the existing Clerk account to RIDER role and set the admin-supplied
      // password so the rider can sign in with email+password on the mobile app.
      await Promise.all([
        clerk.users.updateUserMetadata(existing.id, {
          publicMetadata: { role: 'RIDER' },
        }),
        clerk.users.updateUser(existing.id, {
          password: riderInput.password,
          skipPasswordChecks: true,
        }),
      ]);

      clerkUserId = existing.id;
      reusingExistingClerkAccount = true;
    }

    // 2. Create the Mongo rider and link it to the Clerk account.
    try {
      const rider = await this.ridersService.create({ ...riderInput, email });
      return await this.ridersService.setClerkId(String(rider._id), clerkUserId);
    } catch (err) {
      // Only delete the Clerk user on rollback if we created it — never delete a
      // pre-existing account that was registered independently.
      if (!reusingExistingClerkAccount) {
        await clerk.users.deleteUser(clerkUserId).catch(() => undefined);
      }
      throw err;
    }
  }

  @Roles(Role.ADMIN, Role.RIDER)
  @Mutation(() => RiderModel, { name: 'editRider', nullable: true })
  async editRider(
    @CurrentUser() jwt: JwtUser,
    @Args('riderInput', { type: () => RiderInput }) riderInput: RiderInput,
  ) {
    // Rider editing their own profile from the mobile app — no Clerk admin sync
    // here (riders manage their own Clerk credentials).
    if (jwt.role === Role.RIDER) {
      const self = await this.ridersService.findByClerkId(jwt.userId);
      if (!self) throw new Error('Rider not found');
      return this.ridersService.edit({ ...riderInput, _id: String(self._id) });
    }

    // Admin edit: keep the linked Clerk account in sync with email / password.
    if (!riderInput._id) throw new BadRequestException('_id is required');
    const existing = await this.ridersService.findById(riderInput._id);
    if (!existing) throw new NotFoundException('Rider not found');

    const newEmail = riderInput.email?.toLowerCase().trim();

    // Sync Clerk first so a Clerk failure doesn't leave Mongo ahead of Clerk.
    if (existing.clerkId) {
      await this.syncRiderClerkAccount(existing.clerkId, {
        email: newEmail,
        currentEmail: existing.email?.toLowerCase().trim(),
        password: riderInput.password,
      });
    }

    return this.ridersService.edit({
      ...riderInput,
      ...(newEmail ? { email: newEmail } : {}),
    });
  }

  /**
   * Pushes email / password changes from an admin edit onto the rider's linked
   * Clerk account so they can keep signing in to the mobile app.
   */
  private async syncRiderClerkAccount(
    clerkId: string,
    {
      email,
      currentEmail,
      password,
    }: { email?: string; currentEmail?: string; password?: string },
  ): Promise<void> {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const clerk = createClerkClient({ secretKey });

    try {
      if (password) {
        await clerk.users.updateUser(clerkId, {
          password,
          skipPasswordChecks: true,
        });
      }

      if (email && email !== currentEmail) {
        const created = await clerk.emailAddresses.createEmailAddress({
          userId: clerkId,
          emailAddress: email,
          primary: true,
          verified: true,
        });
        await clerk.users.updateUser(clerkId, {
          primaryEmailAddressID: created.id,
        });
        // Remove any stale email addresses so only the new one remains.
        const user = await clerk.users.getUser(clerkId);
        await Promise.all(
          user.emailAddresses
            .filter((e) => e.id !== created.id)
            .map((e) =>
              clerk.emailAddresses
                .deleteEmailAddress(e.id)
                .catch(() => undefined),
            ),
        );
      }
    } catch (err: unknown) {
      const e = err as {
        errors?: { message?: string; longMessage?: string }[];
        message?: string;
      };
      const message =
        e?.errors?.[0]?.longMessage ??
        e?.errors?.[0]?.message ??
        e?.message ??
        'Failed to sync Clerk account';
      throw new BadRequestException(`Clerk: ${message}`);
    }
  }

  @Mutation(() => RiderModel, { name: 'deleteRider', nullable: true })
  deleteRider(@Args('id', { type: () => String }) id: string) {
    return this.ridersService.deleteRider(id);
  }

  /** Note: typo in name is intentional to match client contract */
  @Mutation(() => RiderModel, { name: 'toggleAvailablity', nullable: true })
  toggleAvailablity(@Args('id', { type: () => String }) id: string) {
    return this.ridersService.toggleAvailablity(id);
  }
}
