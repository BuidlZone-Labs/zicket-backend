import { z } from 'zod';

export const CreateEventStepOneSchema = z
  .object({
    eventTitle: z
      .string()
      .min(3, 'Title must be at least 3 characters')
      .max(100, 'Title is too long'),

    description: z
      .string()
      .min(10, 'Description must be at least 10 characters'),

    tags: z.array(z.string()).min(1, 'At least one tag is required'),

    startDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid start date',
    }),

    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: 'Invalid start time (HH:mm format required)',
    }),

    endDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
      message: 'Invalid end date',
    }),

    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
      message: 'Invalid end time (HH:mm format required)',
    }),

    eventTicketImage: z.string().url('Must be a valid image URL'),
  })
  .refine(
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
