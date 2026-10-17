import { it, expect } from 'vitest';
import { isStaffEmailAllowed } from '@/lib/staff';
it('allowed staff email passes case-insensitively',()=>expect(isStaffEmailAllowed(' 395945526@QQ.com ')).toBe(true));
it('other emails cannot create staff accounts',()=>expect(isStaffEmailAllowed('someone@example.com')).toBe(false));
