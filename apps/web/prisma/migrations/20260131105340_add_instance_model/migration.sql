-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('starting', 'running', 'stopped', 'error');

-- CreateTable
CREATE TABLE "instances" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'stopped',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3),
    "container_id" TEXT,
    "server_password" TEXT NOT NULL,

    CONSTRAINT "instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instances_slug_key" ON "instances"("slug");

-- CreateIndex
CREATE INDEX "instances_status_idx" ON "instances"("status");

-- AddForeignKey
ALTER TABLE "instances" ADD CONSTRAINT "instances_slug_fkey" FOREIGN KEY ("slug") REFERENCES "users"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
