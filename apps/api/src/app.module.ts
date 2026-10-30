import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { StoreTypesModule } from './modules/store-types/store-types.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { StoresModule } from './modules/stores/stores.module';
import { ProductsModule } from './modules/products/products.module';
import { CartModule } from './modules/cart/cart.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { OffersModule } from './modules/offers/offers.module';
import { AdsModule } from './modules/ads/ads.module';
import { NotificationCampaignsModule } from './modules/notification-campaigns/notification-campaigns.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { UploadModule } from './modules/upload/upload.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { CouponsModule } from './modules/coupons/coupons.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ReportsModule } from './modules/reports/reports.module';
import { LocationsModule } from './modules/locations/locations.module';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        // Generous default for browsing (products, stores, search).
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    RealtimeModule,
    AuthModule,
    UsersModule,
    StoreTypesModule,
    CategoriesModule,
    StoresModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    AddressesModule,
    FavoritesModule,
    ReviewsModule,
    OffersModule,
    AdsModule,
    NotificationCampaignsModule,
    AuditLogModule,
    UploadModule,
    DriversModule,
    EmployeesModule,
    CouponsModule,
    NotificationsModule,
    PaymentsModule,
    ReportsModule,
    LocationsModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }, HealthService],
})
export class AppModule {}
