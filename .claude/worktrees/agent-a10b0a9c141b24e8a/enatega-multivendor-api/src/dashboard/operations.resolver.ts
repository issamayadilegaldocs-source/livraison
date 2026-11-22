import { Inject, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver, Subscription } from '@nestjs/graphql';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { AppPubSub, PUB_SUB } from '../pubsub/pubsub.module';
import { Events } from '../subscriptions/events';
import {
  CrisisSnapshotModel,
  DispatchHotspotModel,
  LiveMapDataModel,
  OperationalAlertModel,
  OperationsFeedItemModel,
  OperationsOverviewModel,
  RiderOperationalProfileModel,
  ZoneOperationalStatsModel,
} from './operations.model';
import { OperationsService } from './operations.service';

@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Resolver()
export class OperationsResolver {
  constructor(
    private readonly operationsService: OperationsService,
    @Inject(PUB_SUB) private readonly pubSub: AppPubSub,
  ) {}

  @Query(() => OperationsOverviewModel, { name: 'operationsOverview' })
  operationsOverview() {
    return this.operationsService.getOperationsOverview();
  }

  @Query(() => LiveMapDataModel, { name: 'liveMapData' })
  liveMapData() {
    return this.operationsService.getLiveMapData();
  }

  @Query(() => [OperationalAlertModel], { name: 'operationalAlerts' })
  operationalAlerts(@Args('limit', { type: () => Int, nullable: true }) limit?: number) {
    return this.operationsService.getOperationalAlerts(limit ?? 100);
  }

  @Query(() => RiderOperationalProfileModel, { name: 'riderOperationalProfile' })
  riderOperationalProfile(@Args('riderId', { type: () => ID }) riderId: string) {
    return this.operationsService.getRiderOperationalProfile(riderId);
  }

  @Query(() => [ZoneOperationalStatsModel], { name: 'zoneOperationalStats' })
  zoneOperationalStats() {
    return this.operationsService.getZoneOperationalStats();
  }

  @Query(() => [DispatchHotspotModel], { name: 'dispatchHotspots' })
  dispatchHotspots() {
    return this.operationsService.getDispatchHotspots();
  }

  @Query(() => CrisisSnapshotModel, { name: 'crisisSnapshot' })
  crisisSnapshot() {
    return this.operationsService.getCrisisSnapshot();
  }

  // Live order-timeline feed — published from orders.service.ts's
  // pushStatusHistory every time a statusHistory entry is appended. The
  // append-only Order.statusHistory field remains the durable source of
  // truth; this subscription is only a live-push projection of it.
  @Subscription(() => OperationsFeedItemModel, {
    name: 'operationsFeed',
    resolve: (payload: any) => payload[Events.OPERATIONS_FEED_ITEM],
  })
  operationsFeed() {
    return this.pubSub.asyncIterableIterator(Events.OPERATIONS_FEED_ITEM);
  }
}
