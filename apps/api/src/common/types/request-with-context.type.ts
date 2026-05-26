import { Request } from 'express';
import { AuthenticatedUser } from './jwt-payload.type';

export type RequestWithContext = Request & {
  requestId?: string;
  user?: AuthenticatedUser;
};
