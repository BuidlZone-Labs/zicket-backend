import { Router, Request, Response } from 'express';
import { openApiSpec, renderSwaggerHtml } from '../docs/openapi';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  return res.send(renderSwaggerHtml());
});

router.get('/json', (req: Request, res: Response) => {
  return res.json(openApiSpec);
});

export default router;
