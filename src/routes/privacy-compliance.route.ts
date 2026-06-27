import { Router } from 'express';
import {
  getDataRetentionMatrix,
  getPaymentPrivacyDisclosure,
} from '../controllers/privacy-compliance.controller';

const privacyComplianceRoutes = Router();

privacyComplianceRoutes.get('/data-retention', getDataRetentionMatrix);
privacyComplianceRoutes.get(
  '/payment-privacy-disclosure/:eventId',
  getPaymentPrivacyDisclosure,
);

export default privacyComplianceRoutes;
