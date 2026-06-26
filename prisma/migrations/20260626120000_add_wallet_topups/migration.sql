-- CreateEnum
CREATE TYPE "WalletTopUpStatus" AS ENUM ('PENDING', 'PAID', 'FAILED');

-- CreateTable
CREATE TABLE "wallet_topups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "WalletTopUpStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_orderId_key" ON "wallet_topups"("orderId");

-- CreateIndex
CREATE INDEX "wallet_topups_userId_idx" ON "wallet_topups"("userId");

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
