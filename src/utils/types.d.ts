import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

export interface UserAuthenticatedReq extends Request {
  user?: any;
}
