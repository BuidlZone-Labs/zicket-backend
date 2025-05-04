import { UserAuthenticatedReq } from '../utils/types';
import { extractToken, handleAuthError, validateAndGetUser } from '../utils/helper';

const authGuard = async(req: UserAuthenticatedReq, res: any, next: any) => {
  try {
    // Handle JWT guard (local & oauth)
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized: No token provided'
      });
    }

    const user = await validateAndGetUser(token);

    req.user = user;
    return next();

  } catch (err) {
    const {error, code} = handleAuthError(err);
    return res.status(code).json({ error });
  }
}

export { authGuard };
