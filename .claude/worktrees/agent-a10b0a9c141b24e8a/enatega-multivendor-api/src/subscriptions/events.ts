export const Events = {
  ORDER_PLACED: 'ORDER_PLACED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  RIDER_ASSIGNED: 'RIDER_ASSIGNED',
  RIDER_UPDATED: 'RIDER_UPDATED',
  NEW_MESSAGE: 'NEW_MESSAGE',
  FOOD_STOCK_CHANGED: 'FOOD_STOCK_CHANGED',
  // Fleet-wide rider presence stream for the admin Operations Control Center
  // (`fleetRiderLocationUpdated` subscription). Published by
  // TrackingService.writePresence — throttled there (distance/time) so the
  // in-memory PubSub isn't flooded at fleet scale. Owned by the tracking
  // module, which owns the underlying Redis presence keys.
  RIDER_LOCATION_UPDATED: 'RIDER_LOCATION_UPDATED',
  // Live order-timeline feed for the admin Operations Control Center
  // (`operationsFeed` subscription). Published by OrdersService whenever a
  // statusHistory entry is appended (see orders.service.ts's
  // pushStatusHistory) — the append-only audit trail is the single source of
  // truth, this is not a second logging mechanism.
  OPERATIONS_FEED_ITEM: 'OPERATIONS_FEED_ITEM',
} as const;
