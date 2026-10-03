import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PixelText } from "../pixel-text";

describe("PixelText", () => {
  it("swaps text arrows for pixel icons but keeps a spoken 'to'", () => {
    const { container } = render(<PixelText>Dark → light</PixelText>);
    expect(container.textContent).toBe("Darktolight");
    expect(container.textContent).not.toContain("→");
    expect(container.querySelectorAll("[data-slot=pixel-icon]")).toHaveLength(1);
    expect(container.querySelector(".sr-only")?.textContent).toBe("to");
  });

  it("leaves text without arrows alone", () => {
    const { container } = render(<PixelText>Horizontal</PixelText>);
    expect(container.textContent).toBe("Horizontal");
    expect(container.querySelector("svg")).toBeNull();
  });
});
