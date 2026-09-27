import { verifyToken } from '../utils/jwt.js';
import { ApiError } from './errorHandler.js';

// Populates req.auth = { sub, role, ... } from a "Bearer <token>" header.
// Does NOT reject the request by itself -- some routes (verify-code, login)
// are public. Mount this once, globally, ahead of every route; routes that
// need a signed-in user call requireRole(...) after it.
export function attachAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      // Invalid/expired token: leave req.auth unset. A route that requires
      // auth will reject it via requireRole below; a public route just
      // proceeds as if no token had been sent.
    }
  }
  next();
}

// requireRole() with no arguments just requires *some* signed-in user.
// requireRole('admin'), requireRole('student'), etc. also checks the role.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return next(new ApiError(401, 'Authentication required'));
    if (roles.length && !roles.includes(req.auth.role)) {
      return next(new ApiError(403, 'Not authorized for this action'));
    }
    next();
  };
}
