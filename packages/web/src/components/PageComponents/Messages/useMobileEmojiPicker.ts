import { useEffect, useState } from "react";

const MOBILE_EMOJI_PICKER_QUERY = "(max-width: 950px)";

export function useMobileEmojiPicker(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(MOBILE_EMOJI_PICKER_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_EMOJI_PICKER_QUERY);
    const update = () => setIsMobile(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}
