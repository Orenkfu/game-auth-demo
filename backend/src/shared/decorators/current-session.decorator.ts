import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Session } from '../../modules/auth/services/session.service';

export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session => {
    const req = ctx.switchToHttp().getRequest<Request & { session: Session }>();
    return req.session;
  },
);
