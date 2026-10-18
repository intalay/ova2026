import type { ComponentType, ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Match } from '@/lib/queries';
const mocks = vi.hoisted(()=>({ matches: [] as Match[], role: 'coach' }));
vi.mock('@tanstack/react-router',()=>({
 createFileRoute: ()=>(options:unknown)=>({options}),
 Link: ({to,params,children,...rest}:{to:string;params?:{id:string};children:ReactNode})=><a {...rest} href={to.replace('$id',params?.id??'')}>{children}</a>,
}));
vi.mock('@tanstack/react-query',()=>({useSuspenseQuery:()=>({data:{teams:[{id:'mine',name:'My team'},{id:'other',name:'Opponents'}],events:[{id:'event',name:'Actual event'}],venues:[{id:'known-venue',name:'Known venue',address:'Recorded address'}],matches:mocks.matches,announcements:[],rankings:[],divisions:[]}})}));
vi.mock('@/lib/queries',()=>({competitionQuery:{}}));
vi.mock('@/hooks/use-role',()=>({useRole:()=>({role:mocks.role,household:{data:{managedTeams:['mine'],linkedPlayers:[],self:null,profile:null}},user:{id:'review-user'}})}));
vi.mock('@/components/AppShell',()=>({
 AppShell:({children}:{children:ReactNode})=><main>{children}</main>,
 Section:({title,children}:{title:string;children:ReactNode})=><section aria-label={title}>{children}</section>,
 Card:({children}:{children:ReactNode})=><div>{children}</div>,Tbd:({children}:{children:ReactNode})=><span>{children}</span>,
 MoreLink:({to,children}:{to:string;children:ReactNode})=><a href={to}>{children}</a>,
}));
vi.mock('@/components/HomeLine',()=>({HomeLine:({children}:{children:ReactNode})=><div>{children}</div>}));
vi.mock('@/components/AnnouncementCarousel',()=>({AnnouncementCarousel:()=>null}));
vi.mock('@/components/LotteryModule',()=>({LotteryModule:()=>null}));
import {Route} from '@/routes/index';
const Home=Route.options.component as ComponentType;
const match=(patch:Partial<Match>={}):Match=>({id:'match',event_id:'event',division_id:'division',team_a_id:'mine',team_b_id:'other',venue_id:null,source_date:'2026-10-17',starts_at:null,court:null,status:'scheduled',score_a:null,score_b:null,sets:null,data_mode:'real',...patch});
afterEach(()=>{cleanup();vi.useRealTimers();mocks.matches=[];});
describe('independent next-match DOM regression',()=>{
 it('renders Toronto today with unknown time, isolates real/team records and supplies no venue navigation',()=>{
  vi.setSystemTime(new Date('2026-10-18T02:00:00Z'));
  mocks.matches=[match(),match({id:'demo',data_mode:'synthetic',venue_id:'known-venue'}),match({id:'other-team',team_a_id:'other',team_b_id:null,venue_id:'known-venue'})];
  render(<Home/>);
  const next=within(screen.getByRole('region',{name:'Next Match'}));
  expect(next.getAllByText('Actual event')).toHaveLength(1);
  expect(next.getByText(/Oct 17.*time TBD/)).toBeInTheDocument();
  expect(next.getByText('Venue TBD')).toBeInTheDocument();
  expect(screen.getByRole('region',{name:'Venue'})).toHaveTextContent('Venue to be determined');
  expect(screen.getAllByRole('link').some(a=>a.getAttribute('href')?.startsWith('/venue/'))).toBe(false);
 });
 it('renders a recorded venue link when the unique upcoming match has one',()=>{
  vi.setSystemTime(new Date('2026-10-18T02:00:00Z'));
  mocks.matches=[match({venue_id:'known-venue',starts_at:'2026-10-18T03:00:00Z'})];
  render(<Home/>);
  expect(within(screen.getByRole('region',{name:'Next Match'})).getByRole('link',{name:'Known venue'})).toHaveAttribute('href','/venue/known-venue');
  expect(within(screen.getByRole('region',{name:'Venue'})).getByRole('link')).toHaveAttribute('href','/venue/known-venue');
 });
 it('does not use a historical final as next match or venue',()=>{
  vi.setSystemTime(new Date('2026-10-18T02:00:00Z'));
  mocks.matches=[match({status:'final',source_date:'2026-04-19',venue_id:'known-venue',score_a:2,score_b:0})];
  render(<Home/>);
  expect(screen.getByRole('region',{name:'Next Match'})).toHaveTextContent('No upcoming match is published.');
  expect(screen.getByRole('region',{name:'Venue'})).toHaveTextContent('Venue to be determined');
 });
});
