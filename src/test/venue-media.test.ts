import { describe, expect, it } from 'vitest';
import { venueMedia } from '@/lib/venue-media';

describe('Source-checked venue photos', () => {
  it('uses the official Enercare source for Enercare Centre', () => {
    expect(venueMedia('Enercare Centre')?.source).toBe('https://www.explace.on.ca/venue/enercare-centre/');
  });
  it('does not substitute an unrelated venue photograph', () => {
    expect(venueMedia('Unknown venue')).toBeNull();
  });
});