import { z } from 'zod';

// Step One: Basic Event Information
const CreateEventStepOneBaseSchema = z.object({
  eventTitle: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title is too long'),

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters'),

  tags: z.array(z.string()).min(1, 'At least one tag is required'),

  startDate: z.string().refine((date: string) => !isNaN(Date.parse(date)), {
    message: 'Invalid start date',
  }),

  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid start time (HH:mm format required)',
  }),

  endDate: z.string().refine((date: string) => !isNaN(Date.parse(date)), {
    message: 'Invalid end date',
  }),

  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Invalid end time (HH:mm format required)',
  }),

  eventTicketImage: z.string().url('Must be a valid image URL'),
});

export const CreateEventStepOneSchema = CreateEventStepOneBaseSchema.refine(
  (data) => {
    // Logic to ensure end is after start
    const start = new Date(`${data.startDate}T${data.startTime}`);
    const end = new Date(`${data.endDate}T${data.endTime}`);
    return end > start;
  },
  {
    message: 'End date/time must be after start date/time',
    path: ['endDate'],
  },
);

export type CreateEventStepOneInput = z.infer<typeof CreateEventStepOneSchema>;

// Step Two: Privacy Settings
const TicketTypeSchema = z.object({
  ticketName: z.string().min(1, 'Ticket name is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  currencyOrToken: z.string().min(1, 'Currency or token is required'),
  price: z.number().min(0, 'Price must be non-negative'),
});

export const CreateEventStepTwoSchema = z
  .object({
    privacyLevel: z.enum(['anonymous', 'wallet-required', 'verified-access'], {
      errorMap: () => ({
        message: 'Privacy level must be one of: anonymous, wallet-required, verified-access',
      }),
    }),

    attendanceMode: z.enum(['online', 'in-person', 'hybrid'], {
      errorMap: () => ({
        message: 'Attendance mode must be one of: online, in-person, hybrid',
      }),
    }),

    eventType: z.enum(['FREE', 'PAID'], {
      errorMap: () => ({
        message: 'Event type must be either FREE or PAID',
      }),
    }),

    locationType: z.enum(['exact', 'general'], {
      errorMap: () => ({
        message: 'Location type must be either exact or general',
      }),
    }),

    paymentPrivacy: z.enum(['anonymous', 'public'], {
      errorMap: () => ({
        message: 'Payment privacy must be either anonymous or public',
      }),
    }),

    offerReceipts: z.boolean(),

    hasZkEmailUpdates: z.boolean(),

    hasEventReminders: z.boolean(),

    ticketType: z
      .array(TicketTypeSchema)
      .min(1, 'At least one ticket type is required'),

    isPublished: z.boolean(),
  })
  .refine(
    (data: { eventType: 'FREE' | 'PAID'; privacyLevel: string; ticketType: Array<{ ticketName: string; quantity: number; currencyOrToken: string; price: number }> }) => {
      // Rule: PAID events require wallet-required privacy level
      if (data.eventType === 'PAID' && data.privacyLevel !== 'wallet-required') {
        return false;
      }
      return true;
    },
    {
      message: 'PAID events require privacy level to be wallet-required',
      path: ['privacyLevel'],
    },
  )
  .refine(
    (data: { eventType: 'FREE' | 'PAID'; ticketType: Array<{ price: number }> }) => {
      // Rule: FREE events cannot have tickets with price > 0
      if (data.eventType === 'FREE') {
        return data.ticketType.every((ticket: { price: number }) => ticket.price === 0);
      }
      return true;
    },
    {
      message: 'FREE events cannot have tickets with price greater than 0',
      path: ['ticketType'],
    },
  )
  .refine(
    (data: { eventType: 'FREE' | 'PAID'; ticketType: Array<{ price: number }> }) => {
      // Rule: PAID events must have at least one ticket with price > 0
      if (data.eventType === 'PAID') {
        return data.ticketType.some((ticket: { price: number }) => ticket.price > 0);
      }
      return true;
    },
    {
      message: 'PAID events must have at least one ticket with price greater than 0',
      path: ['ticketType'],
    },
  );

export type CreateEventStepTwoInput = z.infer<typeof CreateEventStepTwoSchema>;
