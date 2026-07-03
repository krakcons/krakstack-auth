import { useEffect, useState } from "react";

export const useOpenedOnce = (open: boolean) => {
  const [opened, setOpened] = useState(open);

  useEffect(() => {
    if (open) setOpened(true);
  }, [open]);

  return opened;
};
