import { prismaClient } from "@/prisma/db";
import { Prisma, User } from "@prisma/client";
import { TRIAL_CREDITS, isTrialActive } from "./trial";

type BalanceBucket = "freeCredits" | "monthyBalance" | "lifetimeBalance";

type SpendCreditsArgs = {
  userId: string;
  amount: number;
  idempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
};

type RefundCreditsArgs = SpendCreditsArgs & {
  bucket?: BalanceBucket;
};

function roundCredit(value: number) {
  const rounded = Number(value.toFixed(1));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function getBucketValue(user: Pick<User, BalanceBucket>, bucket: BalanceBucket) {
  return Number(user[bucket] || 0);
}

export async function grantTrialCredits(userId: string, idempotencyKey: string) {
  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const nextFreeCredits = Math.min(
      TRIAL_CREDITS,
      Math.max(Number(user.freeCredits || 0), TRIAL_CREDITS)
    );

    await tx.user.update({
      where: { id: userId },
      data: { freeCredits: nextFreeCredits },
    });

    return tx.creditLedger.create({
      data: {
        userId,
        eventType: "trial_credit_grant",
        amount: TRIAL_CREDITS,
        balanceBucket: "freeCredits",
        idempotencyKey,
      },
    });
  });
}

export async function spendCredits({
  userId,
  amount,
  idempotencyKey,
  metadata,
}: SpendCreditsArgs) {
  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const userPlan = await tx.userPlan.findUnique({ where: { userId } });
    let effectiveUser = user;

    if (userPlan?.status === "trialing" && !isTrialActive(userPlan)) {
      effectiveUser = await tx.user.update({
        where: { id: userId },
        data: { freeCredits: 0 },
      });
      await tx.userPlan.update({
        where: { userId },
        data: {
          status: "expired",
          cancelled: 1,
        },
      });
    }

    const orderedBuckets: BalanceBucket[] = isTrialActive(userPlan)
      ? ["freeCredits", "monthyBalance", "lifetimeBalance"]
      : ["monthyBalance", "lifetimeBalance", "freeCredits"];

    let remaining = roundCredit(amount);
    const ledgerRows: Prisma.CreditLedgerCreateManyInput[] = [];
    const updates: Partial<Record<BalanceBucket, number>> = {};

    for (const bucket of orderedBuckets) {
      if (remaining <= 0) break;

      const available = getBucketValue(effectiveUser, bucket);
      if (available <= 0) continue;

      const spendAmount = Math.min(available, remaining);
      updates[bucket] = roundCredit(available - spendAmount);
      remaining = roundCredit(remaining - spendAmount);
      ledgerRows.push({
        userId,
        eventType: "credit_spend",
        amount: -spendAmount,
        balanceBucket: bucket,
        idempotencyKey:
          ledgerRows.length === 0
            ? idempotencyKey
            : `${idempotencyKey}:${bucket}`,
        metadata,
      });
    }

    if (remaining > 0) {
      throw new Error("Insufficient credits");
    }

    await tx.user.update({
      where: { id: userId },
      data: updates,
    });

    if (userPlan && isTrialActive(userPlan)) {
      const trialSpend = Math.abs(
        ledgerRows
          .filter((row) => row.balanceBucket === "freeCredits")
          .reduce((sum, row) => sum + Number(row.amount), 0)
      );

      if (trialSpend > 0) {
        await tx.userPlan.update({
          where: { userId },
          data: {
            trialCreditsUsed: {
              increment: trialSpend,
            },
          },
        });
      }
    }

    await tx.creditLedger.createMany({ data: ledgerRows });

    return tx.creditLedger.findUniqueOrThrow({ where: { idempotencyKey } });
  });
}

export async function refundCredits({
  userId,
  amount,
  idempotencyKey,
  bucket = "freeCredits",
  metadata,
}: RefundCreditsArgs) {
  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey } });
    if (existing) return existing;

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    await tx.user.update({
      where: { id: userId },
      data: {
        [bucket]: roundCredit(getBucketValue(user, bucket) + amount),
      },
    });

    return tx.creditLedger.create({
      data: {
        userId,
        eventType: "generation_refund",
        amount,
        balanceBucket: bucket,
        idempotencyKey,
        metadata,
      },
    });
  });
}

export async function refundSpentCredits({
  userId,
  spendIdempotencyKey,
  refundIdempotencyKey,
  metadata,
}: {
  userId: string;
  spendIdempotencyKey: string;
  refundIdempotencyKey: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prismaClient.$transaction(async (tx) => {
    const existing = await tx.creditLedger.findFirst({
      where: {
        idempotencyKey: {
          startsWith: refundIdempotencyKey,
        },
      },
    });
    if (existing) return existing;

    const spendRows = await tx.creditLedger.findMany({
      where: {
        userId,
        eventType: "credit_spend",
        OR: [
          { idempotencyKey: spendIdempotencyKey },
          { idempotencyKey: { startsWith: `${spendIdempotencyKey}:` } },
        ],
      },
    });

    if (spendRows.length === 0) {
      throw new Error("No credit spend found to refund");
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const updates: Partial<Record<BalanceBucket, number>> = {};
    const refundRows: Prisma.CreditLedgerCreateManyInput[] = [];

    for (const spendRow of spendRows) {
      const bucket = spendRow.balanceBucket as BalanceBucket;
      const refundAmount = Math.abs(Number(spendRow.amount));
      const currentValue = updates[bucket] ?? getBucketValue(user, bucket);
      updates[bucket] = roundCredit(currentValue + refundAmount);
      refundRows.push({
        userId,
        eventType: "generation_refund",
        amount: refundAmount,
        balanceBucket: bucket,
        idempotencyKey:
          refundRows.length === 0
            ? refundIdempotencyKey
            : `${refundIdempotencyKey}:${bucket}`,
        metadata,
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: updates,
    });
    await tx.creditLedger.createMany({ data: refundRows });

    return tx.creditLedger.findUniqueOrThrow({
      where: { idempotencyKey: refundIdempotencyKey },
    });
  });
}
