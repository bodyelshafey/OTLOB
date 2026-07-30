import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';

// Global so any module (orders, notifications, drivers) can inject the
// gateway to push live events without importing this module everywhere.
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [RealtimeGateway],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
