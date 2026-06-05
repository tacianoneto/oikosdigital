import { lazy, Suspense } from "react";
import { supabase } from "./auth/supabase";
import { AuthGate } from "./auth/AuthGate";
import { ProfilePanel } from "./auth/ProfilePanel";

const OikosApp = lazy(() => import("./screens/OikosApp").then((module) => ({ default: module.OikosApp })));

export function App() {
  return (
    <AuthGate>
      {(session, user) => (
        <Suspense fallback={<main className="app-shell menu-active" aria-busy="true" />}>
          <OikosApp authSession={session} authUser={user} onSignOut={() => void supabase.auth.signOut()} />
          <ProfilePanel user={user} />
        </Suspense>
      )}
    </AuthGate>
  );
}
