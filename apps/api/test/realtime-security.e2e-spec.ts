import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { Socket } from 'socket.io';
import { SocketAuthGuard } from '../src/realtime/socket-auth.guard';
import { UsersService } from '../src/users/users.service';

const jwtSecret = 'test_access_secret';

describe('Realtime socket auth security', () => {
  const configService = {
    get: (key: string) => {
      if (key === 'jwt.accessSecret') {
        return jwtSecret;
      }
      return undefined;
    },
  } as ConfigService;

  const usersService = {
    findById: jest.fn(async (id: string) => {
      if (id === 'known-user-id') {
        return {
          id: 'known-user-id',
          email: 'known.user@company.com',
          role: Role.USER,
        };
      }
      return null;
    }),
  };

  const jwtService = new JwtService();
  const guard = new SocketAuthGuard(
    jwtService,
    configService,
    usersService as Pick<UsersService, 'findById'>,
  );

  beforeEach(() => {
    usersService.findById.mockClear();
  });

  it('rejects socket client without token', async () => {
    const client = {
      handshake: {
        auth: {},
        headers: {},
      },
    } as unknown as Socket;

    await expect(guard.authenticateClient(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects socket client with invalid token', async () => {
    const client = {
      handshake: {
        auth: {
          token: 'invalid-token',
        },
        headers: {},
      },
    } as unknown as Socket;

    await expect(guard.authenticateClient(client)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('authenticates socket client with valid token', async () => {
    const token = await jwtService.signAsync(
      {
        sub: 'known-user-id',
        email: 'known.user@company.com',
        role: Role.USER,
      },
      {
        secret: jwtSecret,
      },
    );

    const client = {
      handshake: {
        auth: {
          token,
        },
        headers: {},
      },
    } as unknown as Socket;

    const authUser = await guard.authenticateClient(client);
    expect(authUser.sub).toBe('known-user-id');
    expect(authUser.role).toBe(Role.USER);
  });
});
