import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import depthLimit from 'graphql-depth-limit';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ActivityModule } from './activity/activity.module';
import { AuditModule } from './audit/audit.module';
import { GqlThrottlerGuard } from './auth/gql-throttler.guard';
import { AuthModule } from './auth/auth.module';
import { CountriesModule } from './countries/countries.module';
import { BannersModule } from './banners/banners.module';
import { ChatModule } from './chat/chat.module';
import { ConfigurationModule } from './configuration/configuration.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CouponsModule } from './coupons/coupons.module';
import { OffersModule } from './offers/offers.module';
import { CuisinesModule } from './cuisines/cuisines.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PubSubModule } from './pubsub/pubsub.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { ShopTypesModule } from './shop-types/shop-types.module';
import { SubCategoriesModule } from './sub-categories/sub-categories.module';
import { StaffModule } from './staff/staff.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { TaxationsModule } from './taxations/taxations.module';
import { TippingsModule } from './tippings/tippings.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { UploadsModule } from './uploads/uploads.module';
import { WalletModule } from './wallet/wallet.module';
import { ZonesModule } from './zones/zones.module';
import { TrackingModule } from './tracking/tracking.module';
import { DeliveryEstimationModule } from './delivery-estimation/delivery-estimation.module';
import { UserNotificationsModule } from './user-notifications/user-notifications.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { CustomerWalletModule } from './customer-wallet/customer-wallet.module';
import { PaymentsModule } from './payments/payments.module';
import { idFallbackMiddleware } from './common/graphql/id-fallback.middleware';

const getSubscriptionConnectionParams = ({ connectionParams, connection, extra }: any) =>
  connectionParams ??
  connection?.context ??
  connection?.connectionParams ??
  extra?.connectionParams ??
  extra?.connection?.context ??
  extra?.connection?.connectionParams;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Fail fast in production instead of silently falling back to a
        // localhost URI that doesn't exist inside the container — a missing
        // MONGO_URI env var should surface as an immediate boot crash, not a
        // confusing ECONNREFUSED loop against 127.0.0.1. The default stays
        // for local dev convenience against the Docker Mongo in CLAUDE.md.
        uri:
          config.get<string>('NODE_ENV') === 'production'
            ? config.getOrThrow<string>('MONGO_URI')
            : config.get<string>('MONGO_URI', 'mongodb://127.0.0.1:27017/enatega'),
      }),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: 'src/schema.gql',
      sortSchema: true,
      // Playground/introspection expose the full schema (including admin/
      // payment/wallet mutations) to anyone who can reach the endpoint.
      // Keep it for local development only; a real deployment should not
      // ship an interactive GraphQL IDE at its public API.
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      // No query depth/complexity limit otherwise — a deeply nested query
      // (e.g. restaurant -> categories -> foods -> addons -> options,
      // repeated via aliases/fragments) is a cheap DoS vector even with
      // introspection off, since the schema shape is still knowable from
      // the frontend source. 10 comfortably covers every real query in
      // this schema's catalog/review/order nesting.
      validationRules: [depthLimit(10)],
      buildSchemaOptions: {
        // `id` must always mirror `_id` when models expose both — see the
        // middleware's doc comment for the client cache-normalization bug a
        // null `id` causes.
        fieldMiddleware: [idFallbackMiddleware],
      },
      subscriptions: {
        'graphql-ws': true,
      },
      context: (context: any) => ({
        req: context.req,
        connectionParams: getSubscriptionConnectionParams(context),
      }),
    }),
    PubSubModule,
    HealthModule,
    ConfigurationModule,
    DeliveryEstimationModule,
    AuthModule,
    ZonesModule,
    CountriesModule,
    ShopTypesModule,
    CuisinesModule,
    BannersModule,
    RestaurantsModule,
    SubCategoriesModule,
    OrdersModule,
    CouponsModule,
    OffersModule,
    NotificationsModule,
    WalletModule,
    SubscriptionsModule,
    ChatModule,
    StaffModule,
    ActivityModule,
    AuditModule,
    DashboardModule,
    TaxationsModule,
    TippingsModule,
    SupportTicketsModule,
    UploadsModule,
    TrackingModule,
    UserNotificationsModule,
    LoyaltyModule,
    CustomerWalletModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: GqlThrottlerGuard }],
})
export class AppModule {}
