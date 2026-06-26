-- AlterTable
ALTER TABLE "wallet_topups" ADD COLUMN     "bonusAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "creditAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "packageId" TEXT;
