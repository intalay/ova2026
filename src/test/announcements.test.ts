import { describe, expect, it } from 'vitest';
import { announcementVisible, orderAnnouncements, ANNOUNCEMENT_LIFETIME_MS } from '../lib/announcements';
const published = Date.parse('2026-10-17T12:00:00Z');
const a = {id:'a',status:'published',pinned:false,published_at:'2026-10-17T12:00:00Z'};
describe('Announcement display rules',()=>{
  it('retains unpinned notices before 24 hours',()=>expect(announcementVisible(a,published+24*60*60*1000-1)).toBe(true));
  it('removes unpinned notices at exactly 24 hours',()=>expect(announcementVisible(a,published+24*60*60*1000)).toBe(false));
  it('retains pinned notices indefinitely',()=>expect(announcementVisible({...a,pinned:true},published+365*ANNOUNCEMENT_LIFETIME_MS)).toBe(true));
  it('unpinning an old notice removes it immediately from audience screens',()=>expect(announcementVisible({...a,pinned:false},published+2*ANNOUNCEMENT_LIFETIME_MS)).toBe(false));
  it('keeps expired notices available to managers',()=>expect(announcementVisible(a,published+2*ANNOUNCEMENT_LIFETIME_MS,true)).toBe(true));
  it('never displays archived notices even when pinned',()=>expect(announcementVisible({...a,pinned:true,status:'archived'},published,true)).toBe(false));
  it('puts every pin above unpinned notices and orders pins newest first',()=>{
    const items=[a,{...a,id:'oldpin',pinned:true,published_at:'2026-10-16T12:00:00Z'},{...a,id:'newpin',pinned:true},{...a,id:'newregular',published_at:'2026-10-18T12:00:00Z'}];
    expect(orderAnnouncements(items).map(a=>a.id)).toEqual(['newpin','oldpin','newregular','a']);
  });
});