import { expect, it } from 'vitest';
import { coachApplicationSchema, hasCoachApplicationDetails } from '@/lib/coach-application';

const application = { team: 'demo-north', coachName: 'Test Coach', certificationNumber: 'OVA-12345' };
it('requires the coach name', () => {
  expect(coachApplicationSchema.safeParse({ ...application, coachName: ' ' }).success).toBe(false);
});
it('requires the coach certification number', () => {
  expect(coachApplicationSchema.safeParse({ ...application, certificationNumber: ' ' }).success).toBe(false);
});
it('requires a team selection', () => {
  expect(coachApplicationSchema.safeParse({ ...application, team: '' }).success).toBe(false);
});
it('preserves the submitted coach identity and selected team', () => {
  expect(coachApplicationSchema.parse(application)).toEqual(application);
});
it('only enables approval for requests containing all required details', () => {
  const request = {coach_name: 'Test Coach', certification_number: 'OVA-12345', contact_email: 'test@example.com', team_name: 'North Team'};
  expect(hasCoachApplicationDetails(request)).toBe(true);
  for (const key of Object.keys(request) as Array<keyof typeof request>) {
    expect(hasCoachApplicationDetails({...request, [key]: null})).toBe(false);
  }
});