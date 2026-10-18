import {beforeEach,describe,expect,it} from 'vitest';
import {confirmedSignupRole,readPendingSignup,rememberSignup,signupRole} from '@/lib/signup-continuation';
beforeEach(()=>localStorage.clear());
describe('email-confirmed signup continuation',()=>{
 const pending={role:'player' as const,email:'test@invalid.test',userId:'new-user'};
 const user={id:'new-user',email:pending.email,email_confirmed_at:'2026-10-18',user_metadata:{signup_role:'player'}};
 it('retains role and account across refresh without storing credentials',()=>{
  rememberSignup(pending);expect(readPendingSignup()).toEqual(pending);
 });
 it('does not continue before real email confirmation',()=>{
  expect(confirmedSignupRole({...user,email_confirmed_at:undefined},pending)).toBeNull();
 });
 it('does not apply another account draft',()=>{
  expect(confirmedSignupRole({...user,id:'another-user'},pending)).toBeNull();
  expect(confirmedSignupRole({...user,email:'other@invalid.test'},pending)).toBeNull();
 });
 it.each(['player','coach','family_friends'] as const)('restores %s in a new confirmation tab from metadata',role=>{
  expect(confirmedSignupRole({...user,user_metadata:{signup_role:role}},null)).toBe(role);
 });
 it('does not accept staff or admin as a registration preference',()=>{
  expect(signupRole('staff')).toBeNull();expect(signupRole('admin')).toBeNull();
 });
});