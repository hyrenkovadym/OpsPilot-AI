import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { AuthenticatedUser } from '../common/types/jwt-payload.type';
import { UsersService } from '../users/users.service';

@Injectable()
export class SocketAuthGuard {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async authenticateClient(client: Socket): Promise<AuthenticatedUser> {
    const token = this.extractToken(client);
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const secret = this.configService.get<string>('jwt.accessSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let payload: AuthenticatedUser;
    try {
      payload = await this.jwtService.verifyAsync<AuthenticatedUser>(token, {
        secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid token subject');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private extractToken(client: Socket): string | null {
    const authData = client.handshake.auth as
      | Record<string, unknown>
      | undefined;
    const authToken = authData?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken.trim();
    }

    const header = client.handshake.headers.authorization;
    if (typeof header !== 'string') {
      return null;
    }

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token.trim();
  }
}
