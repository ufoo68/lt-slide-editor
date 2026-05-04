-- CreateTable
CREATE TABLE "ImageLibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImageLibraryItem_userId_updatedAt_idx" ON "ImageLibraryItem"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "ImageLibraryItem" ADD CONSTRAINT "ImageLibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
