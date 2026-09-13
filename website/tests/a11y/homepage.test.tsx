import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { AtlasHome } from "@/app/page";

describe("Atlas 1.0 public homepage", () => {
  afterEach(cleanup);
  it("presents a Windows download CTA with accurate 1.0.3 disclosure", () => {
    render(<AtlasHome />);
    expect(screen.getAllByRole("link", { name: /Download Atlas 1.0.3/i })[0]).toHaveAttribute(
      "href",
      "https://github.com/Rifaque/atlas/releases/tag/v1.0.3"
    );
    expect(screen.getByText(/Unsigned NSIS installer/i)).toBeInTheDocument();
    expect(screen.getByText(/Linux is configured but unverified/i)).toBeInTheDocument();
    expect(screen.getByText(/16D953C943BF55F18D5A73F9C8C842B94203652CD2857E61F3883E51D50E7D23/i)).toBeInTheDocument();
  });

  it("states the evidence and local/cloud boundaries without retired product claims", () => {
    render(<AtlasHome />);
    const content = document.body.textContent?.toLowerCase() ?? "";
    expect(content).toContain("evidence first");
    expect(content).toContain("optional cloud mode");
    expect(content).toContain("no arbitrary shell execution");
    for (const retiredTerm of ["graphrag", "hyde", "autonomous workflow", "vision attachment", "overlay chat"]) {
      expect(content).not.toContain(retiredTerm);
    }
  });

  it("has no obvious accessibility violations", async () => {
    const view = render(<AtlasHome />);
    const violations = (await axe(view.container)).violations as Array<{ id: string }>;
    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
