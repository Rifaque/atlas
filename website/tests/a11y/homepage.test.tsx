import { cleanup, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it } from "vitest";
import { AtlasHome } from "@/app/page";

describe("Atlas 1.0 public homepage", () => {
  afterEach(cleanup);
  it("presents a Windows download CTA with accurate 1.0.1 disclosure", () => {
    render(<AtlasHome />);
    expect(screen.getAllByRole("link", { name: /Download Atlas 1.0.1/i })[0]).toHaveAttribute(
      "href",
      "https://github.com/Rifaque/atlas/releases/tag/v1.0.1"
    );
    expect(screen.getByText(/Unsigned NSIS installer/i)).toBeInTheDocument();
    expect(screen.getByText(/Linux is configured but unverified/i)).toBeInTheDocument();
    expect(screen.getByText(/2C1C4F511895624400F437B4117ED4D532244D06828E4F10875C8F8324BD18CC/i)).toBeInTheDocument();
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
