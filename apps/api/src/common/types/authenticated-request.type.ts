import { Request } from 'express';
import { AuthenticatedUser } from './jwt-payload.type';

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};
