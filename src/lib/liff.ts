import liff from "@line/liff";

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";

let initialized = false;

export async function initLiff(): Promise<void> {
  if (initialized) return;
  await liff.init({ liffId: LIFF_ID });
  initialized = true;
}

export async function ensureLogin(): Promise<void> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    // login() redirects, so execution stops here
    await new Promise(() => {});
  }
}

export async function getLineId(): Promise<string> {
  await ensureLogin();
  const profile = await liff.getProfile();
  return profile.userId;
}

export async function getProfile(): Promise<{ userId: string; displayName: string }> {
  await ensureLogin();
  const profile = await liff.getProfile();
  return { userId: profile.userId, displayName: profile.displayName };
}

export function isInLiff(): boolean {
  return liff.isInClient();
}
