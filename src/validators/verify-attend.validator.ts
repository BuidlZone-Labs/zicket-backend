import { z } from 'zod';

const groth16ProofSchema = z
  .object({
    pi_a: z.array(z.union([z.string(), z.number()])).optional(),
    pi_b: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
    pi_c: z.array(z.union([z.string(), z.number()])).optional(),
    protocol: z.string().optional(),
    curve: z.string().optional(),
  })
  .passthrough();

export const VerifyAttendBodySchema = z.object({
  proof: groth16ProofSchema,
  publicSignals: z
    .array(z.string().min(1))
    .min(1, 'publicSignals must include at least the nullifier'),
});

export type VerifyAttendBody = z.infer<typeof VerifyAttendBodySchema>;
