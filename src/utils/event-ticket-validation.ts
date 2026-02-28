import mongoose from 'mongoose';
import {
  PrivacyLevel,
  EventType,
  LocationType,
  PaymentPrivacy,
  AttendanceMode,
} from '../models/event-ticket';

/**
 * Validation utility for event ticket privacy settings
 * 
 * Business Rules:
 * 1. PAID events MUST have privacyLevel set to 'wallet-required'
 * 2. FREE events cannot have tickets with price > 0
 * 3. PAID events must have at least one ticket with price > 0
 * 4. All ticket types must have valid names, quantities, and currencies
 */

export interface ValidationResult<T> {
  valid: boolean;
  error?: string;
  data?: T;
}

/**
 * Validates privacy level enum value
 */
export function validatePrivacyLevel(value: unknown): ValidationResult<PrivacyLevel> {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'privacyLevel is required and must be a string',
    };
  }

  if (!Object.values(PrivacyLevel).includes(value as PrivacyLevel)) {
    return {
      valid: false,
      error: `privacyLevel must be one of: ${Object.values(PrivacyLevel).join(', ')}`,
    };
  }

  return { valid: true, data: value as PrivacyLevel };
}

/**
 * Validates attendance mode enum value
 */
export function validateAttendanceMode(value: unknown): ValidationResult<AttendanceMode> {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'attendanceMode is required and must be a string',
    };
  }

  if (!Object.values(AttendanceMode).includes(value as AttendanceMode)) {
    return {
      valid: false,
      error: `attendanceMode must be one of: ${Object.values(AttendanceMode).join(', ')}`,
    };
  }

  return { valid: true, data: value as AttendanceMode };
}

/**
 * Validates event type enum value
 */
export function validateEventType(value: unknown): ValidationResult<EventType> {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'eventType is required and must be a string',
    };
  }

  if (!Object.values(EventType).includes(value as EventType)) {
    return {
      valid: false,
      error: `eventType must be one of: ${Object.values(EventType).join(', ')}`,
    };
  }

  return { valid: true, data: value as EventType };
}

/**
 * Validates location type enum value
 */
export function validateLocationType(value: unknown): ValidationResult<LocationType> {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'locationType is required and must be a string',
    };
  }

  if (!Object.values(LocationType).includes(value as LocationType)) {
    return {
      valid: false,
      error: `locationType must be one of: ${Object.values(LocationType).join(', ')}`,
    };
  }

  return { valid: true, data: value as LocationType };
}

/**
 * Validates payment privacy enum value
 */
export function validatePaymentPrivacy(value: unknown): ValidationResult<PaymentPrivacy> {
  if (!value || typeof value !== 'string') {
    return {
      valid: false,
      error: 'paymentPrivacy is required and must be a string',
    };
  }

  if (!Object.values(PaymentPrivacy).includes(value as PaymentPrivacy)) {
    return {
      valid: false,
      error: `paymentPrivacy must be one of: ${Object.values(PaymentPrivacy).join(', ')}`,
    };
  }

  return { valid: true, data: value as PaymentPrivacy };
}

/**
 * Validates MongoDB ObjectId
 */
export function validateObjectId(value: unknown, fieldName: string): ValidationResult<string> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a string`,
    };
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid MongoDB ObjectId`,
    };
  }

  return { valid: true, data: value };
}

/**
 * Validates ISO date string
 */
export function validateISODate(value: unknown, fieldName: string): ValidationResult<Date> {
  if (typeof value !== 'string') {
    return {
      valid: false,
      error: `${fieldName} must be a valid ISO date string`,
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      valid: false,
      error: `${fieldName} must be a valid date`,
    };
  }

  return { valid: true, data: date };
}

/**
 * Validates business rule: PAID events require wallet-required privacy level
 */
export function validatePaidEventPrivacy(
  eventType: EventType,
  privacyLevel: PrivacyLevel,
): ValidationResult<void> {
  if (eventType === EventType.PAID && privacyLevel !== PrivacyLevel.WALLET_REQUIRED) {
    return {
      valid: false,
      error: 'PAID events require privacy level to be wallet-required',
    };
  }

  return { valid: true };
}
