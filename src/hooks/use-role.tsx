import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { SessionProvider, useSessionUser } from "./use-session";
import { myHouseholdQuery } from "@/lib/queries";
import { authorizedRole, type AppRole } from "@/lib/modules";
const RoleContext = createContext<{ requested: AppRole; selectRole: (r: AppRole) => void }>({ requested: "general_user", selectRole: () => {} });
export function RoleProvider({ children }: { children: ReactNode }) {
 return <SessionProvider><RolePreferenceProvider>{children}</RolePreferenceProvider></SessionProvider>;
}
function RolePreferenceProvider({ children }: { children: ReactNode }) {
 const [requested, setRequested] = useState<AppRole>("general_user");
 useEffect(() => { const r = sessionStorage.getItem("ova-role"); if (r === "player" || r === "family_friends" || r === "coach") setRequested(r); }, []);
 const selectRole = (r: AppRole) => { setRequested(r); sessionStorage.setItem("ova-role", r); };
 return <RoleContext.Provider value={{ requested, selectRole }}>{children}</RoleContext.Provider>;
}
export function useRole() {
 const context = useContext(RoleContext);
 const { user, ready, signOut } = useSessionUser();
 const household = useQuery(myHouseholdQuery(user?.id));
 return { ...context, role: user ? authorizedRole(context.requested, household.data) : "general_user" as AppRole, user, ready, household, signOut };
}
