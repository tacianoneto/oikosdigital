import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MobileTabbar } from "./MobileTabbar";

describe("MobileTabbar", () => {
  it("renders the active tab and available panels", () => {
    const markup = renderToStaticMarkup(
      <MobileTabbar
        activeSheet="mao"
        canShowHand
        canShowPlayers
        canShowSummary={false}
        onSelect={() => undefined}
      />
    );

    expect(markup).toContain('class="mobile-tabbar"');
    expect(markup).toContain('class="mobile-tab is-active"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Ação");
    expect(markup).toContain("Mão");
    expect(markup).toContain("Jogadores");
    expect(markup).toContain("Resumo");
    expect(markup).toContain("disabled");
  });
});
