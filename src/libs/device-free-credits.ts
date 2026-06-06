import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prismaClient } from "@/prisma/db";
import { DEVICE_COOKIE_NAME } from "@/libs/device-cookie";

const DEFAULT_FREE_CREDITS = 4;
const SIGNUP_CREDIT_ENFORCEMENT_WINDOW_MS = 1000 * 60 * 60 * 24;

type DeviceCreditPolicyResult =
  | "no_device_cookie"
  | "invalid_device_cookie"
  | "recorded_first_device_grant"
  | "same_user_device"
  | "duplicate_device_free_credits_removed"
  | "duplicate_device_no_change";

type DeviceSignupEligibilityResult = {
  allowed: boolean;
  reason:
    | "no_device_cookie"
    | "invalid_device_cookie"
    | "device_not_claimed"
    | "existing_account"
    | "device_already_claimed";
};

function getDeviceCookieSecret() {
  return process.env.DEVICE_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || "";
}

function signDeviceId(deviceId: string) {
  const secret = getDeviceCookieSecret();

  if (!secret) {
    return "";
  }

  return createHmac("sha256", secret).update(deviceId).digest("base64url");
}

function verifySignedDeviceCookie(cookieValue?: string) {
  if (!cookieValue) {
    return null;
  }

  const [deviceId, signature] = cookieValue.split(".");

  if (!deviceId || !signature) {
    return null;
  }

  const expectedSignature = signDeviceId(deviceId);

  if (!expectedSignature) {
    return null;
  }

  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) {
    return null;
  }

  return deviceId;
}

function hashDeviceId(deviceId: string) {
  return createHmac("sha256", getDeviceCookieSecret())
    .update(deviceId)
    .digest("base64url");
}

function getVerifiedDeviceIdFromCookie() {
  const deviceCookieValue = cookies().get(DEVICE_COOKIE_NAME)?.value;

  return {
    deviceCookieValue,
    deviceId: verifySignedDeviceCookie(deviceCookieValue),
  };
}

export async function getDeviceSignupEligibility(
  email?: string | null
): Promise<DeviceSignupEligibilityResult> {
  const { deviceCookieValue, deviceId } = getVerifiedDeviceIdFromCookie();

  if (!deviceCookieValue) {
    return { allowed: true, reason: "no_device_cookie" };
  }

  if (!deviceId) {
    return { allowed: false, reason: "invalid_device_cookie" };
  }

  const deviceIdHash = hashDeviceId(deviceId);
  const deviceGrantDelegate = (prismaClient as any).freeCreditDeviceGrant;
  const existingGrant = await deviceGrantDelegate.findUnique({
    where: { deviceIdHash },
  });

  if (!existingGrant) {
    return { allowed: true, reason: "device_not_claimed" };
  }

  if (email) {
    const existingUser = await prismaClient.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return { allowed: true, reason: "existing_account" };
    }
  }

  await deviceGrantDelegate.update({
    where: { deviceIdHash },
    data: {
      blockedAttempts: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  return { allowed: false, reason: "device_already_claimed" };
}

export async function applyDeviceFreeCreditPolicy(
  userId: string
): Promise<DeviceCreditPolicyResult> {
  const { deviceCookieValue, deviceId } = getVerifiedDeviceIdFromCookie();

  if (!deviceCookieValue) {
    return "no_device_cookie";
  }

  if (!deviceId) {
    return "invalid_device_cookie";
  }

  const deviceIdHash = hashDeviceId(deviceId);
  const deviceGrantDelegate = (prismaClient as any).freeCreditDeviceGrant;

  const existingGrant = await deviceGrantDelegate.findUnique({
    where: { deviceIdHash },
  });

  if (!existingGrant) {
    await deviceGrantDelegate.create({
      data: {
        deviceIdHash,
        firstUserId: userId,
        lastSeenAt: new Date(),
      },
    });

    return "recorded_first_device_grant";
  }

  if (existingGrant.firstUserId === userId) {
    await deviceGrantDelegate.update({
      where: { deviceIdHash },
      data: { lastSeenAt: new Date() },
    });

    return "same_user_device";
  }

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: {
      freeCredits: true,
      monthyBalance: true,
      lifetimeBalance: true,
      monthyPlan: true,
      lifetimePlan: true,
      createdAt: true,
    },
  });

  await deviceGrantDelegate.update({
    where: { deviceIdHash },
    data: {
      blockedAttempts: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });

  const isRecentSignup =
    !!user?.createdAt &&
    Date.now() - user.createdAt.getTime() <= SIGNUP_CREDIT_ENFORCEMENT_WINDOW_MS;

  const onlyHasDefaultSignupFreeCredits =
    user &&
    isRecentSignup &&
    user.freeCredits > 0 &&
    user.freeCredits <= DEFAULT_FREE_CREDITS &&
    user.monthyBalance <= 0 &&
    user.lifetimeBalance <= 0 &&
    user.monthyPlan <= 0 &&
    user.lifetimePlan <= 0;

  if (!onlyHasDefaultSignupFreeCredits) {
    return "duplicate_device_no_change";
  }

  await prismaClient.user.update({
    where: { id: userId },
    data: { freeCredits: 0 },
  });

  return "duplicate_device_free_credits_removed";
}
