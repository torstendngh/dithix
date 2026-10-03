import { Fragment } from "react";
import { PixelIcon } from "./pixel-icon";

/** Renders text with every "→" swapped for the pixel arrow (screen readers still hear "to"). */
export function PixelText({ children }: { children: string }) {
  const parts = children.split("→");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <>
              <PixelIcon name="arrow-right" scale={1} className="mx-1 inline-block align-[-1px]" />
              <span className="sr-only">to</span>
            </>
          )}
          {part.trim()}
        </Fragment>
      ))}
    </>
  );
}
