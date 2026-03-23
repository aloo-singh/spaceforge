"use client";

import { useLayoutEffect, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 639px)";

export function useMobile() {
  const [state, setState] = useState({
    isMobile: false,
    isReady: false,
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
    const updateMatch = () => {
      setState({
        isMobile: mediaQuery.matches,
        isReady: true,
      });
    };

    updateMatch();
    mediaQuery.addEventListener("change", updateMatch);

    return () => {
      mediaQuery.removeEventListener("change", updateMatch);
    };
  }, []);

  return state;
}
