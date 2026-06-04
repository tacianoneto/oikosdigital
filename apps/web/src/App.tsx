import { lazy, Suspense } from "react";

const OikosApp = lazy(() => import("./screens/OikosApp").then((module) => ({ default: module.OikosApp })));

export function App() {
  return (
    <Suspense fallback={<main className="app-shell menu-active" aria-busy="true" />}>
      <OikosApp />
    </Suspense>
  );
}
