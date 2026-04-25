import { NextResponse } from "next/server";
import { getFatSecretToken } from "../_helpers";

export async function POST() {
  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({ success: false, reason: "missing_credentials" });
  }

  const accessToken = await getFatSecretToken(clientId, clientSecret);
  if (!accessToken) {
    return NextResponse.json({ success: false, reason: "api_error" });
  }

  // Return token info — never return the client secret
  return NextResponse.json({ success: true, accessToken });
}
