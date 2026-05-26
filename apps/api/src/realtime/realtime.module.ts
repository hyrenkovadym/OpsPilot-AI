import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { SocketAuthGuard } from './socket-auth.guard';

@Global()
@Module({
  imports: [
    PrismaModule,
    UsersModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwt.accessSecret'),
      }),
    }),
  ],
  providers: [RealtimeService, RealtimeGateway, SocketAuthGuard],
  exports: [RealtimeService],
})
export class RealtimeModule {}
