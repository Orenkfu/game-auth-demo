-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('pending', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "VideoVisibility" AS ENUM ('private', 'unlisted', 'public');

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "title" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadId" TEXT,
    "status" "VideoStatus" NOT NULL DEFAULT 'pending',
    "visibility" "VideoVisibility" NOT NULL DEFAULT 'private',
    "sizeBytes" BIGINT,
    "durationSecs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
