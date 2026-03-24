export function detectMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;

  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const userAgentDataPlatform =
    typeof navigatorWithUserAgentData.userAgentData?.platform === "string"
      ? navigatorWithUserAgentData.userAgentData.platform
      : "";

  if (/mac/i.test(userAgentDataPlatform)) return true;

  return /mac/i.test(navigator.platform);
}
