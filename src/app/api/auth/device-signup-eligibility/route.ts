import { getDeviceSignupEligibility } from "@/libs/device-free-credits";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({ email: null }));
  const result = await getDeviceSignupEligibility(
    typeof email === "string" ? email : null
  );

  return NextResponse.json({
    ...result,
    message: result.allowed
      ? "Signup allowed"
      : "This device has already been used to create an account. Please log in with your existing account.",
  });
}

