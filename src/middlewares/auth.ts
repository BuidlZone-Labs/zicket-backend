import { UserAuthenticatedReq } from '../utils/types';
import {
  extractToken,
  handleAuthError,
  validateAndGetUser,
} from '../utils/helper';

/**
 * Authenticates JWT and requires verified email for local accounts (issue #122).
 */
const authGuard = async (req: UserAuthenticatedReq, res: any, next: any) => {
  return authenticateRequest(req, res, next, { requireVerifiedEmail: true });
};

/**
 * Authenticates JWT without requiring verified email.
 * Used for right-to-erasure flows (issue #127).
 */
const authGuardIdentity = async (
  req: UserAuthenticatedReq,
  res: any,
  next: any,
) => {
  return authenticateRequest(req, res, next, { requireVerifiedEmail: false });
};

/**
 * Shared JWT authentication path; optionally enforces verified email for local users.
 */
async function authenticateRequest(
  req: UserAuthenticatedReq,
  res: any,
  next: any,
  options: { requireVerifiedEmail: boolean },
) {
  try {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: No token provided',
      });
    }

    const user = await validateAndGetUser(token);

    if (
      options.requireVerifiedEmail &&
      user.provider === 'local' &&
      !user.emailVerifiedAt
    ) {
      return res.status(403).json({
        error:
          'Forbidden: Please verify your email before accessing this resource',
      });
    }

    req.user = user;
    return next();
  } catch (err) {
    const { error, code } = handleAuthError(err);
    return res.status(code).json({ error });
  }
}

/**
 * Requires the authenticated user to have the 'admin' role.
 * Must be used after authGuard (which sets req.user).
 */
const adminGuard = (req: UserAuthenticatedReq, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  return next();
};

export { authGuard, authGuardIdentity, adminGuard };
