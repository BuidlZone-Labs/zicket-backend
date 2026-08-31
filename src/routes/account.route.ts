import { Router } from 'express';
import {
  getErasureAssessment,
  requestErasure,
} from '../controllers/account.controller';
import {
  createDeveloperKey,
  listDeveloperKeys,
  revokeDeveloperKey,
} from '../controllers/developer-key.controller';
import { authGuard, authGuardIdentity } from '../middlewares/auth';
import { validateSchema } from '../middlewares/validator';
import { CreateDeveloperKeyBodySchema } from '../validators/developer-key.validator';

const accountRoutes = Router();

/**
 * @swagger
 * /account/erasure-assessment:
 *   get:
 *     summary: Get data erasure assessment
 *     description: Returns an assessment of personal data that will be affected by right-to-erasure
 *     tags:
 *       - Account
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Erasure assessment details
 *       401:
 *         description: Unauthorized
 */
accountRoutes.get(
  '/erasure-assessment',
  authGuardIdentity,
  getErasureAssessment,
);

/**
 * @swagger
 * /account/request-erasure:
 *   post:
 *     summary: Request account erasure (right-to-erasure)
 *     description: Initiates the right-to-erasure process for the user's account
 *     tags:
 *       - Account
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Erasure request accepted
 *       401:
 *         description: Unauthorized
 */
accountRoutes.post('/request-erasure', authGuardIdentity, requestErasure);

/**
 * @swagger
 * /account/developer-keys:
 *   post:
 *     summary: Create a new developer API key
 *     description: Generate a new API key for accessing the developer API
 *     tags:
 *       - Account
 *       - Developer Keys
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Human-readable name for the API key
 *     responses:
 *       201:
 *         description: Developer key created successfully
 *       401:
 *         description: Unauthorized
 *   get:
 *     summary: List all developer API keys
 *     description: Get all API keys created by the authenticated user
 *     tags:
 *       - Account
 *       - Developer Keys
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of developer API keys
 *       401:
 *         description: Unauthorized
 */
accountRoutes.post(
  '/developer-keys',
  authGuard,
  validateSchema(CreateDeveloperKeyBodySchema),
  createDeveloperKey,
);
accountRoutes.get('/developer-keys', authGuard, listDeveloperKeys);

/**
 * @swagger
 * /account/developer-keys/{id}:
 *   delete:
 *     summary: Revoke a developer API key
 *     description: Revoke and delete a previously created API key
 *     tags:
 *       - Account
 *       - Developer Keys
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: API key not found
 */
accountRoutes.delete('/developer-keys/:id', authGuard, revokeDeveloperKey);

export default accountRoutes;
