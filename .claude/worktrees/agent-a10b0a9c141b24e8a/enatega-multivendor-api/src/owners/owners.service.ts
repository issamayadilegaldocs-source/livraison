import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createClerkClient } from '@clerk/backend';
import { ConfigService } from '@nestjs/config';
import { Restaurant, RestaurantDocument } from '../restaurants/restaurant.schema';
import { Owner, OwnerDocument } from './owner.schema';
import { InviteVendorInput, VendorInput } from './dto/vendor.input';
import { assertNoDependents } from '../common/referential-integrity.util';
import { Role } from '../auth/roles.enum';
import { assertClerkRolePromotable } from '../auth/clerk-role-conflict.util';

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    @InjectModel(Owner.name)
    private readonly ownerModel: Model<OwnerDocument>,
    @InjectModel(Restaurant.name)
    private readonly restaurantModel: Model<RestaurantDocument>,
    private readonly config: ConfigService,
  ) {}

  async findById(id: string): Promise<OwnerDocument | null> {
    const owner = await this.ownerModel.findById(id).lean().exec();
    if (!owner) return null;
    // Vendors created before firstName/lastName were stored only have `name`.
    // Derive the pair on read so the admin edit form prefills for them too.
    if (!owner.firstName && !owner.lastName) {
      const { firstName, lastName } = this.splitName(owner.name);
      owner.firstName = firstName;
      owner.lastName = lastName;
    }
    const [withRestaurants] = await this.attachVendorRestaurants([owner]);
    return withRestaurants as OwnerDocument;
  }

  /**
   * `Owner.restaurants[]` is only ever pruned (on restaurant delete), never
   * appended on create — restaurant creation sets `Restaurant.owner` instead.
   * A plain `.populate('restaurants')` therefore misses restaurants created
   * the normal way, which made `ownerProfile` (used by the store app's login
   * fallback) return an empty list for a vendor with a real, linked
   * restaurant. Resolve through `attachVendorRestaurants`, which already
   * checks both sides of the relationship, same as `findById`/`findAll`.
   */
  async findByClerkId(clerkId: string): Promise<OwnerDocument | null> {
    const owner = await this.ownerModel.findOne({ clerkId }).lean().exec();
    if (!owner) return null;
    const [withRestaurants] = await this.attachVendorRestaurants([owner]);
    return withRestaurants as OwnerDocument;
  }

  /** Looks up an active owner by email with their restaurants populated for login. */
  findByEmail(email: string): Promise<OwnerDocument | null> {
    return this.ownerModel
      .findOne({ email: email.toLowerCase().trim(), isActive: true })
      .populate('restaurants')
      .exec();
  }

  async findOrCreateByClerkId(
    clerkId: string,
    data: Partial<Pick<Owner, 'email' | 'name' | 'userType'>>,
  ): Promise<OwnerDocument> {
    return this.ownerModel.findOneAndUpdate(
      { clerkId },
      { $setOnInsert: { clerkId, ...data } },
      { upsert: true, new: true },
    );
  }

  async deactivateByClerkId(clerkId: string): Promise<void> {
    await this.ownerModel.updateOne({ clerkId }, { $set: { isActive: false } }).exec();
  }

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  async findAll(): Promise<OwnerDocument[]> {
    const owners = await this.ownerModel.find().lean().exec();
    return this.attachVendorRestaurants(owners) as Promise<OwnerDocument[]>;
  }

  async createVendor(input: VendorInput): Promise<OwnerDocument> {
    if (!input.email) throw new NotFoundException('email is required');
    const email = input.email.toLowerCase().trim();
    // The password lives only in Clerk (the identity source of truth) — it is
    // never persisted to Mongo. A random secret is used when the admin omits one.
    const plain = input.password ?? Math.random().toString(36).slice(-10);

    const provisioned = await this.provisionClerkVendor({
      email,
      password: plain,
      name: input.name,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    // Reusing an existing Clerk account: refuse to create a second Owner
    // record pointing at the same identity (data corruption — two Mongo
    // vendor docs sharing one clerkId).
    if (provisioned?.reused) {
      const linked = await this.ownerModel.findOne({ clerkId: provisioned.clerkId }).lean().exec();
      if (linked) throw new ConflictException('A vendor with this email already exists');
    }

    const { firstName, lastName } = this.splitName(
      input.name,
      input.firstName,
      input.lastName,
    );

    try {
      return await this.ownerModel.create({
        email,
        name: input.name,
        firstName,
        lastName,
        phoneNumber: input.phoneNumber,
        userType: input.userType ?? 'VENDOR',
        isActive: input.isActive ?? true,
        image: input.image,
        ...(provisioned
          ? { clerkId: provisioned.clerkId, invitationStatus: 'ACCEPTED', acceptedAt: new Date() }
          : {}),
      });
    } catch (err) {
      // Only delete the Clerk user on rollback if we created it just now —
      // never delete/leave-promoted a pre-existing account we merely reused.
      if (provisioned && !provisioned.reused) {
        await this.clerk().users.deleteUser(provisioned.clerkId).catch(() => undefined);
      }
      throw err;
    }
  }

  async editVendor(input: VendorInput): Promise<OwnerDocument> {
    if (!input._id) throw new NotFoundException('_id is required');
    const existing = await this.ownerModel.findById(input._id).exec();
    if (!existing) throw new NotFoundException('Vendor not found');

    const patch: Record<string, unknown> = {};
    if (input.email !== undefined) patch.email = input.email.toLowerCase().trim();
    if (input.name !== undefined) patch.name = input.name;
    if (input.firstName !== undefined) patch.firstName = input.firstName;
    if (input.lastName !== undefined) patch.lastName = input.lastName;
    if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber;
    if (input.userType !== undefined) patch.userType = input.userType;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (input.image !== undefined) patch.image = input.image;
    // Password is intentionally not written to Mongo — syncClerkVendor pushes it
    // to Clerk, where it is stored.

    // Mirror credential changes into Clerk so the vendor's store login keeps
    // working after an admin edit. Returns a clerkId when this edit had to
    // provision a Clerk user for a vendor that predated Clerk identity.
    const linkedClerkId = await this.syncClerkVendor(existing, input);
    if (linkedClerkId) {
      patch.clerkId = linkedClerkId;
      patch.invitationStatus = 'ACCEPTED';
      patch.acceptedAt = new Date();
    }

    const updated = await this.ownerModel
      .findByIdAndUpdate(input._id, { $set: patch }, { new: true })
      .lean()
      .exec();
    if (!updated) throw new NotFoundException('Vendor not found');
    return updated as OwnerDocument;
  }

  // ── Clerk vendor provisioning ──────────────────────────────────────────────

  private clerk() {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    return createClerkClient({ secretKey });
  }

  /** Resolves a first/last name pair from the explicit fields or the full name. */
  private splitName(
    name?: string,
    firstName?: string,
    lastName?: string,
  ): { firstName?: string; lastName?: string } {
    if (firstName || lastName) return { firstName, lastName };
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return {};
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') || undefined };
  }

  /**
   * Creates a Clerk user (role=VENDOR) for the given credentials and returns its
   * id. If the email already has a Clerk account, promotes that account's role
   * and reuses its id — but only when that account has no role yet or is
   * already CUSTOMER; an ADMIN/RIDER/STORE account sharing the email is left
   * untouched and the mutation fails loudly instead of silently stripping that
   * account's role (`assertClerkRolePromotable`). Genuine Clerk-outage failures
   * still degrade to a Mongo-only record (returns undefined).
   */
  private async provisionClerkVendor(args: {
    email: string;
    password: string;
    name?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<{ clerkId: string; reused: boolean } | undefined> {
    const clerk = this.clerk();
    const { firstName, lastName } = this.splitName(args.name, args.firstName, args.lastName);
    try {
      const user = await clerk.users.createUser({
        emailAddress: [args.email],
        password: args.password,
        firstName,
        lastName,
        publicMetadata: { role: 'VENDOR' },
        skipPasswordChecks: true,
      });
      return { clerkId: user.id, reused: false };
    } catch (err: any) {
      // Email already registered in Clerk — promote role and reuse the account,
      // once we've confirmed doing so won't clobber an unrelated role.
      if (err?.status === 422 || err?.clerkError) {
        try {
          const [existing] = (await clerk.users.getUserList({ emailAddress: [args.email] })).data;
          if (existing) {
            assertClerkRolePromotable(
              (existing.publicMetadata as { role?: string } | undefined)?.role,
              Role.VENDOR,
              'account',
            );
            await clerk.users.updateUserMetadata(existing.id, { publicMetadata: { role: 'VENDOR' } });
            return { clerkId: existing.id, reused: true };
          }
        } catch (inner) {
          // A deliberate role-conflict rejection must fail the mutation loudly,
          // not degrade to a Mongo-only record.
          if (inner instanceof BadRequestException) throw inner;
          this.logger.warn(`[provisionClerkVendor] existing-user lookup failed: ${inner}`);
        }
      }
      this.logger.warn(`[provisionClerkVendor] Clerk createUser failed: ${err?.message ?? err}`);
      return undefined;
    }
  }

  /**
   * Pushes an admin's email/password edit into Clerk. If the vendor has no
   * Clerk account yet and a password was supplied, provisions one and returns
   * its id so the caller can persist the link. Otherwise returns undefined.
   */
  private async syncClerkVendor(
    owner: OwnerDocument,
    input: VendorInput,
  ): Promise<string | undefined> {
    const newEmail = input.email?.toLowerCase().trim();
    const emailChanged = !!newEmail && newEmail !== owner.email;
    if (!input.password && !emailChanged) return undefined;

    const clerkId = owner.clerkId;

    // Vendor predates Clerk identity. We can only create a Clerk account when a
    // password is provided (Clerk needs one); an email-only edit is left to the
    // invite flow.
    if (!clerkId) {
      if (!input.password) return undefined;
      const provisioned = await this.provisionClerkVendor({
        email: newEmail ?? owner.email,
        password: input.password,
        name: input.name ?? owner.name,
        firstName: input.firstName,
        lastName: input.lastName,
      });
      return provisioned?.clerkId;
    }

    const clerk = this.clerk();

    if (input.password) {
      try {
        await clerk.users.updateUser(clerkId, {
          password: input.password,
          skipPasswordChecks: true,
        });
      } catch (err: any) {
        // A password change that doesn't reach Clerk would silently lock the
        // vendor out of their store login — fail loudly instead.
        throw new BadRequestException(
          `Could not update the vendor's password in Clerk: ${this.clerkErrorMessage(err)}`,
        );
      }
    }

    if (emailChanged && newEmail) {
      // The new address must be free in Clerk: an email can belong to only one
      // Clerk user. If another account already holds it, surface a clear
      // conflict and abort so Mongo is not updated to an email the vendor can
      // never actually sign in with (the bug this guards against: Mongo and
      // Clerk silently diverging on a "successful" edit).
      const [conflicting] = (
        await clerk.users.getUserList({ emailAddress: [newEmail] })
      ).data;
      if (conflicting && conflicting.id !== clerkId) {
        throw new ConflictException(
          `The email ${newEmail} is already in use by another Clerk account and cannot be assigned to this vendor.`,
        );
      }

      try {
        // Clerk emails are immutable objects. Reuse the address if it is already
        // on this user (e.g. a retry); otherwise add it as a verified primary,
        // then drop the old ones so the sign-in identifier matches.
        const user = await clerk.users.getUser(clerkId);
        const existingEmail = user.emailAddresses.find(
          (e) => e.emailAddress.toLowerCase() === newEmail,
        );
        const keepId =
          existingEmail?.id ??
          (
            await clerk.emailAddresses.createEmailAddress({
              userId: clerkId,
              emailAddress: newEmail,
              primary: true,
              verified: true,
            })
          ).id;
        if (existingEmail) {
          await clerk.users.updateUser(clerkId, { primaryEmailAddressID: keepId });
        }
        await Promise.all(
          user.emailAddresses
            .filter((e) => e.id !== keepId)
            .map((e) =>
              clerk.emailAddresses.deleteEmailAddress(e.id).catch(() => undefined),
            ),
        );
      } catch (err: any) {
        throw new BadRequestException(
          `Could not update the vendor's email in Clerk: ${this.clerkErrorMessage(err)}`,
        );
      }
    }
    return undefined;
  }

  /** Extracts a human-readable message from a Clerk API error. */
  private clerkErrorMessage(err: any): string {
    const detail = err?.errors?.[0]?.longMessage ?? err?.errors?.[0]?.message;
    return detail ?? err?.message ?? 'unknown Clerk error';
  }

  async deleteVendor(id: string): Promise<boolean> {
    // Referential integrity: check both directions of the bidirectional ref.
    // Restaurant.owner may be unset on legacy/seeded docs that are still listed
    // in Owner.restaurants[], so we must check both sides.
    const byOwnerField = await this.restaurantModel
      .countDocuments({ owner: new Types.ObjectId(id) })
      .exec();

    const ownerDoc = await this.ownerModel
      .findById(id)
      .select('restaurants')
      .lean()
      .exec();
    const byRefArray = ownerDoc?.restaurants?.length ?? 0;

    assertNoDependents('vendor', {
      count: Math.max(byOwnerField, byRefArray),
      label: 'restaurants',
    });

    const deleted = await this.ownerModel.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Vendor not found');
    return true;
  }

  // ── Clerk invitation flow ─────────────────────────────────────────────────

  async inviteVendor(input: InviteVendorInput): Promise<OwnerDocument> {
    const email = input.email.toLowerCase().trim();
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const redirectUrl = this.config.get<string>('STORE_INVITE_REDIRECT_URL', 'https://store.enatega.com/link-account');
    const clerk = createClerkClient({ secretKey });

    // Upsert Owner (idempotent)
    let owner = await this.ownerModel.findOne({ email }).exec();
    if (!owner) {
      owner = await this.ownerModel.create({
        email,
        name: input.name,
        userType: 'VENDOR',
        isActive: true,
        invitationStatus: 'PENDING',
        invitedAt: new Date(),
      });
    }

    // Send Clerk invitation
    let clerkInvitationId: string | undefined;
    try {
      const invite = await clerk.invitations.createInvitation({
        emailAddress: email,
        publicMetadata: { role: 'VENDOR' },
        redirectUrl,
        notify: true,
      });
      clerkInvitationId = invite.id;
    } catch (err: any) {
      // If user already has a Clerk account, promote their role directly
      if (err?.status === 422 || err?.clerkError) {
        this.logger.warn(`[inviteVendor] ${email} already has Clerk account — promoting role directly`);
        try {
          const [clerkUser] = (await clerk.users.getUserList({ emailAddress: [email] })).data;
          if (clerkUser) {
            assertClerkRolePromotable(
              (clerkUser.publicMetadata as { role?: string } | undefined)?.role,
              Role.VENDOR,
              'invitation',
            );
            await clerk.users.updateUserMetadata(clerkUser.id, { publicMetadata: { role: 'VENDOR' } });
            await this.ownerModel.findByIdAndUpdate(owner._id, {
              $set: { clerkId: clerkUser.id, invitationStatus: 'ACCEPTED', acceptedAt: new Date() },
            });
          }
        } catch (innerErr) {
          if (innerErr instanceof BadRequestException) throw innerErr;
          this.logger.warn(`[inviteVendor] failed to promote existing user: ${innerErr}`);
        }
      } else {
        this.logger.warn(`[inviteVendor] Clerk invitation failed: ${err?.message ?? err}`);
      }
    }

    if (clerkInvitationId) {
      await this.ownerModel.findByIdAndUpdate(owner._id, {
        $set: { invitationStatus: 'PENDING', invitedAt: new Date(), clerkInvitationId },
      });
    }

    return this.ownerModel.findById(owner._id).lean().exec() as Promise<OwnerDocument>;
  }

  async resendVendorInvitation(id: string): Promise<OwnerDocument> {
    const owner = await this.ownerModel.findById(id).lean().exec();
    if (!owner) throw new NotFoundException('Vendor not found');
    return this.inviteVendor({ email: (owner as any).email, name: (owner as any).name });
  }

  async revokeVendorInvitation(id: string): Promise<OwnerDocument> {
    const owner = await this.ownerModel.findById(id).lean().exec();
    if (!owner) throw new NotFoundException('Vendor not found');

    const clerkInvitationId = (owner as any).clerkInvitationId;
    if (clerkInvitationId) {
      try {
        const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
        const clerk = createClerkClient({ secretKey });
        await clerk.invitations.revokeInvitation(clerkInvitationId);
      } catch (err) {
        this.logger.warn(`[revokeVendorInvitation] Clerk revoke failed: ${err}`);
      }
    }

    const updated = await this.ownerModel
      .findByIdAndUpdate(id, { $set: { invitationStatus: 'REVOKED' } }, { new: true })
      .lean()
      .exec();
    return updated as OwnerDocument;
  }

  async linkVendorAccount(clerkId: string): Promise<OwnerDocument> {
    const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
    const clerk = createClerkClient({ secretKey });

    const clerkUser = await clerk.users.getUser(clerkId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) throw new ForbiddenException('Clerk account has no email address');

    const existing = await this.ownerModel.findOne({ clerkId }).lean().exec();
    if (existing) return existing as OwnerDocument;

    const owner = await this.ownerModel.findOne({ email: email.toLowerCase().trim(), isActive: true }).exec();
    if (!owner) throw new ForbiddenException('No vendor invitation found for this email');

    // This Clerk account might be an unrelated ADMIN/RIDER identity that
    // merely shares an email with a pending vendor invitation — never
    // silently overwrite its role in that case.
    assertClerkRolePromotable(
      (clerkUser.publicMetadata as { role?: string } | undefined)?.role,
      Role.VENDOR,
      'invitation',
    );

    await this.ownerModel.findByIdAndUpdate(owner._id, {
      $set: { clerkId, invitationStatus: 'ACCEPTED', acceptedAt: new Date() },
    });

    await this.restaurantModel.updateMany(
      { owner: owner._id },
      { $set: { clerkId } },
    );

    await clerk.users.updateUserMetadata(clerkId, { publicMetadata: { role: 'VENDOR' } });

    return this.ownerModel.findById(owner._id).lean().exec() as Promise<OwnerDocument>;
  }

  private async attachVendorRestaurants<T extends { _id: unknown; restaurants?: unknown[] }>(
    owners: T[],
  ): Promise<T[]> {
    if (!owners.length) return owners;

    const ownerIds = owners.map((owner) => new Types.ObjectId(String(owner._id)));
    const refsByOwner = new Map<string, string[]>();
    const restaurantRefIds: Types.ObjectId[] = [];

    for (const owner of owners) {
      const refs = (owner.restaurants ?? []).map((id) => String(id));
      refsByOwner.set(String(owner._id), refs);
      restaurantRefIds.push(
        ...refs
          .filter((id) => Types.ObjectId.isValid(id))
          .map((id) => new Types.ObjectId(id)),
      );
    }

    const restaurants = await this.restaurantModel
      .find({
        $or: [
          { owner: { $in: ownerIds } },
          ...(restaurantRefIds.length ? [{ _id: { $in: restaurantRefIds } }] : []),
        ],
      })
      .select('_id owner isActive orderId orderPrefix slug name image address location shopType')
      .lean()
      .exec();

    return owners.map((owner) => {
      const ownerId = String(owner._id);
      const refIds = new Set(refsByOwner.get(ownerId) ?? []);
      const vendorRestaurants = restaurants
        .filter((restaurant) => {
          const restaurantOwnerId = restaurant.owner ? String(restaurant.owner) : null;
          return restaurantOwnerId === ownerId || refIds.has(String(restaurant._id));
        })
        // Active restaurants first so `restaurants[0]` (used by the store
        // app's owner-level login fallback) never lands on a disabled shop
        // for a vendor who manages more than one restaurant.
        .sort((a, b) => Number(b.isActive !== false) - Number(a.isActive !== false));

      return {
        ...owner,
        unique_id: ownerId,
        restaurants: vendorRestaurants,
      };
    });
  }
}
