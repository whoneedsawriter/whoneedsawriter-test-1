CREATE TABLE "PluginSite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "siteSecretHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PluginSite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PluginSite_userId_website_key" ON "PluginSite"("userId", "website");
CREATE INDEX "PluginSite_userId_idx" ON "PluginSite"("userId");
