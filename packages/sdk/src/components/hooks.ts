import { useLayoutEffect, useState } from "react";
import { useAtomSet } from "@effect/atom-react";
import { Atom } from "effect/reactivity";

// Stable submission-time input for form instances retained across renders.
export const useLatestAtom = <A>(value: A) => {
  const [atom] = useState(() => Atom.make(value));
  const set = useAtomSet(atom);
  useLayoutEffect(() => set(value), [set, value]);
  return atom;
};

export const useOpenedOnce = (open: boolean) => {
  const [opened, setOpened] = useState(open);

  if (open && !opened) setOpened(true);

  return opened || open;
};
