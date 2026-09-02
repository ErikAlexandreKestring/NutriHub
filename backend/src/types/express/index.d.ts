import { UserRole } from '../../shared/utils/jwt';

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        tenantId: string;
        role: UserRole;
      };
    }
  }
}

export {};
