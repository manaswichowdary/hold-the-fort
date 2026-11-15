// The "·" separator, drawn bigger and bolder than plain text so it reads clearly.
import { Fragment, type ReactNode } from "react";

export default function Sep() {
  return <span className="sep" aria-hidden="true">·</span>;
}

// Turns "Scene 1 · The problem" into text with a proper separator
export function dots(text: string): ReactNode {
  return text.split(" · ").map((part, i) => (
    <Fragment key={i}>
      {i > 0 && <> <Sep /> </>}
      {part}
    </Fragment>
  ));
}
