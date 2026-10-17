import { z } from 'zod';

export const coachApplicationSchema = z.object({
  team: z.string().trim().min(1, 'Choose a registered team'),
  coachName: z.string().trim().min(1, 'Enter your coach name').max(100),
  certificationNumber: z.string().trim().min(1, 'Enter your certification number').max(100),
});

export function hasCoachApplicationDetails(request: {
  coach_name: string | null;
  certification_number: string | null;
  contact_email: string | null;
  team_name: string | null;
}) {
  return [request.coach_name, request.certification_number, request.contact_email, request.team_name].every(value => Boolean(value?.trim()));
}