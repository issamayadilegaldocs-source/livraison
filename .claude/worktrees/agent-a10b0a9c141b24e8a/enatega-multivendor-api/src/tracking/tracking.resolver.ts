import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { SkipThrottle } from '@nestjs/throttler';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Role, JwtUser } from '../auth/roles.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Events } from '../subscriptions/events';
import { RiderLocationInput } from './dto/rider-location.input';
import { TrailPointInput } from './dto/trail-point.input';
import { FleetRiderLocationModel, RiderLocationModel, TrackingSessionModel } from './tracking.model';
import { OrderTrailModel } from './order-trail.model';
import { RiderDayTrailModel } from './rider-day-trail.model';
import { TrackingService } from './tracking.service';
import { TrackingToken } from './tracking-token.decorator';

@Resolver()
export class TrackingResolver {
  constructor(private readonly tracking: TrackingService) {}

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.RIDER)
  @Mutation(() => TrackingSessionModel, { name: 'createTrackingSession' })
  createTrackingSession(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => ID }) orderId: string,
  ) {
    return this.tracking.createSession(jwt.userId, orderId);
  }

  // Token-authed, high-frequency tracking ingest. Skip the global IP-keyed
  // throttler: over the WS transport there is no per-request IP, so every rider's
  // socket publish would collapse into one shared 'graphql-ws' bucket (and riders
  // behind a shared NAT collide over HTTP too). The correct per-session limiter
  // (enforceRateLimit, 30/60s) is enforced in the service on both transports.
  @SkipThrottle()
  @Mutation(() => RiderLocationModel, { name: 'updateOrderRiderLocation' })
  updateOrderRiderLocation(
    @TrackingToken() token: string | undefined,
    @Args('orderId', { type: () => ID }) orderId: string,
    @Args('location') location: RiderLocationInput,
    @Args('bufferedPoints', { type: () => [TrailPointInput], nullable: true })
    bufferedPoints?: TrailPointInput[],
  ) {
    return this.tracking.updateLocation(token, orderId, location, bufferedPoints);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.RIDER)
  @Mutation(() => Boolean, { name: 'updateRiderDispatchPresence' })
  updateRiderDispatchPresence(
    @CurrentUser() jwt: JwtUser,
    @Args('location') location: RiderLocationInput,
  ) {
    return this.tracking.updatePresence(jwt.userId, location);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.RIDER)
  @Mutation(() => TrackingSessionModel, { name: 'createDispatchPresenceSession' })
  createDispatchPresenceSession(@CurrentUser() jwt: JwtUser) {
    return this.tracking.createPresenceSession(jwt.userId);
  }

  // Same rationale as updateOrderRiderLocation: token-authed, per-session limited
  // in the service. The global IP throttle is redundant and harmful here.
  @SkipThrottle()
  @Mutation(() => Boolean, { name: 'updateRiderDispatchPresenceByToken' })
  updateRiderDispatchPresenceByToken(
    @TrackingToken() token: string | undefined,
    @Args('location') location: RiderLocationInput,
  ) {
    return this.tracking.updatePresenceByToken(token, location);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => OrderTrailModel, { name: 'orderRouteTrail', nullable: true })
  orderRouteTrail(@Args('orderId', { type: () => ID }) orderId: string) {
    return this.tracking.getOrderTrail(orderId);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Query(() => RiderDayTrailModel, { name: 'riderDayTrail' })
  riderDayTrail(
    @Args('riderId', { type: () => ID }) riderId: string,
    @Args('date') date: string,
  ) {
    return this.tracking.getRiderDayTrail(riderId, date);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @Query(() => RiderLocationModel, { name: 'orderRiderLocation', nullable: true })
  orderRiderLocation(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => ID }) orderId: string,
  ) {
    return this.tracking.getCustomerLocation(jwt.userId, orderId);
  }

  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @Subscription(() => RiderLocationModel, {
    name: 'orderRiderLocationUpdated',
    resolve: (payload: { orderRiderLocationUpdated: RiderLocationModel }) =>
      payload.orderRiderLocationUpdated,
  })
  orderRiderLocationUpdated(
    @CurrentUser() jwt: JwtUser,
    @Args('orderId', { type: () => ID }) orderId: string,
  ) {
    return this.tracking.customerIterator(jwt.userId, orderId);
  }

  // Fleet-wide (not per-order) live rider presence for the admin ops map.
  // Throttled at the publish site (TrackingService.writePresence) so the
  // in-memory, single-instance PubSub isn't flooded at fleet scale.
  @UseGuards(ClerkAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Subscription(() => FleetRiderLocationModel, {
    name: 'fleetRiderLocationUpdated',
    resolve: (payload: any) => payload[Events.RIDER_LOCATION_UPDATED],
  })
  fleetRiderLocationUpdated() {
    return this.tracking.fleetLocationIterator();
  }
}
