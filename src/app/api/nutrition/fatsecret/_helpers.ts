// Shared server-side helper — not a route (underscore prefix)

const FS_API = "https://platform.fatsecret.com/rest/server.api";
const FS_TOKEN_URL = "https://oauth.fatsecret.com/connect/token";

export async function getFatSecretToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(FS_TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=basic",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

export async function fatSecretPost(
  token: string,
  params: Record<string, string>
): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const body = new URLSearchParams({ ...params, format: "json" }).toString();
    const res = await fetch(FS_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
