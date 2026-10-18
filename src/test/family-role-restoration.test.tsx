import { render, screen, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';

const session = vi.hoisted(() => ({ user: { id: 'family-account' } as { id: string } | null }));
vi.mock('@/hooks/use-session', () => ({
 SessionProvider: ({children}: {children: ReactNode}) => children,
 useSessionUser: () => ({user: session.user, ready: true, signOut: vi.fn()}),
}));
vi.mock('@/lib/queries', () => ({myHouseholdQuery: (id?: string) => ({
 queryKey: ['household', id], enabled: !!id, queryFn: async () => ({self:null, linkedPlayers:[], managedTeams:[], roles:[]}),
})}));
import { RoleProvider, useRole } from '@/hooks/use-role';
const empty = {self:null, linkedPlayers:[], managedTeams:[], roles:[]};
const approved = {...empty, linkedPlayers:[{id:'approved-player',status:'verified'}]};
function Probe(){const {role}=useRole();return <output aria-label="Resolved homepage identity">{role}</output>;}
function mount(qc: QueryClient){return render(<QueryClientProvider client={qc}><RoleProvider><Probe/></RoleProvider></QueryClientProvider>);}
beforeEach(()=>{sessionStorage.clear();session.user={id:'family-account'};});
afterEach(cleanup);
it('restores approved family after refresh without a stored role', async()=>{
 const qc=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
 qc.setQueryData(['household','family-account'],approved);
 const first=mount(qc);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('family_friends');
 first.unmount();sessionStorage.clear();mount(qc);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('family_friends');
});
it('restores family when approval arrives without another identity selection', async()=>{
 const qc=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
 qc.setQueryData(['household','family-account'],empty);mount(qc);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('general_user');
 await act(async()=>{qc.setQueryData(['household','family-account'],approved);});
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('family_friends');
});
it('restores after sign-in but never uses the previous accounts approval', async()=>{
 const qc=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
 qc.setQueryData(['household','family-account'],approved);
 qc.setQueryData(['household','other-account'],empty);
 session.user=null;const view=mount(qc);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('general_user');
 session.user={id:'family-account'};view.rerender(<QueryClientProvider client={qc}><RoleProvider><Probe/></RoleProvider></QueryClientProvider>);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('family_friends');
 session.user={id:'other-account'};view.rerender(<QueryClientProvider client={qc}><RoleProvider><Probe/></RoleProvider></QueryClientProvider>);
 expect(screen.getByLabelText('Resolved homepage identity')).toHaveTextContent('general_user');
});