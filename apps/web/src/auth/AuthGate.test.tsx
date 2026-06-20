// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import { AuthGate } from "./AuthGate";

const mocks = vi.hoisted(() => ({
  sessionRef: { current: null as Session | null }
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mocks.sessionRef.current } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } })
    }
  }
}));

vi.mock("./tutorialProgress", () => ({
  loadTutorialProgress: () => Promise.resolve()
}));

function makeSession(): Session {
  return {
    access_token: "token",
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: { id: "u1", email: "player@oikos.test" }
  } as unknown as Session;
}

afterEach(() => {
  cleanup();
  mocks.sessionRef.current = null;
});

describe("AuthGate", () => {
  it("shows the login form when there is no session", async () => {
    mocks.sessionRef.current = null;

    render(<AuthGate>{() => <div>GAME CONTENT</div>}</AuthGate>);

    expect(await screen.findByLabelText("Entrar no Oikos Digital")).toBeTruthy();
    expect(screen.queryByText("GAME CONTENT")).toBeNull();
  });

  it("renders the gated children once a session is present", async () => {
    mocks.sessionRef.current = makeSession();

    render(
      <AuthGate>
        {(_session, user) => <div>GAME for {user.email}</div>}
      </AuthGate>
    );

    await waitFor(() => {
      expect(screen.getByText("GAME for player@oikos.test")).toBeTruthy();
    });
    expect(screen.queryByLabelText("Entrar no Oikos Digital")).toBeNull();
  });
});
