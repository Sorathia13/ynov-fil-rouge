import type { AuthenticatedActor } from '../../application/dto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by the authenticate middleware from a verified access token. */
      actor?: AuthenticatedActor;
      /** Correlation id for logs. */
      requestId?: string;
    }
  }
}

export {};
