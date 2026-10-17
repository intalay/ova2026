import { describe, expect, it } from 'vitest';
import { audienceAnnouncements, canPinAnnouncement, sortAnnouncements } from '../lib/announcements';
const row=(id:string,pin:string|null,published='2026-10-17T12:00:00Z')=>({id,status:'published',pinned_at:pin,published_at:published});
describe('announcement rules',()=>{
 it('allows three pins but blocks a fourth',()=>{expect(canPinAnnouncement(2)).toBe(true);expect(canPinAnnouncement(3)).toBe(false);});
 it('shows last pinned first irrespective of publication date',()=>{expect(sortAnnouncements([row('first','2026-10-17T10:00:00Z'),row('last','2026-10-17T11:00:00Z','2026-10-01T12:00:00Z'),row('unpinned',null)]).map(a=>a.id)).toEqual(['last','first','unpinned']);});
 it('keeps old pinned items while unpinned items expire after 24 hours',()=>{expect(audienceAnnouncements([row('pinned','2026-10-17T11:00:00Z','2026-10-01T12:00:00Z'),row('expired',null,'2026-10-16T12:00:00Z'),row('new',null)],Date.parse('2026-10-17T12:00:00Z')).map(a=>a.id)).toEqual(['pinned','new']);});
 it('never displays archived pinned announcements',()=>{expect(audienceAnnouncements([{...row('old','2026-10-17T11:00:00Z'),status:'archived'}])).toEqual([]);});
});