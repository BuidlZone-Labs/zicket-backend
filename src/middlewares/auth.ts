import { UserAuthenticatedReq } from '../utils/types';
import {
  extractToken,
  handleAuthError,
  validateAndGetUser,
} from '../utils/helper';

const authGuard = async (req: UserAuthenticatedReq, res: any, next: any) => {
  try {
    // Handle JWT guard (local & oauth)
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: No token provided',
      });
    }

    const user = await validateAndGetUser(token);

    // Defense in depth: a valid JWT is not enough. Local accounts must have a
    // verified email before reaching any protected route (see issue #122).
    // Google accounts are verified by the provider and carry emailVerifiedAt.
    if (user.provider === 'local' && !user.emailVerifiedAt) {
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
};

export { authGuard };
