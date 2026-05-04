-- CreateTable
CREATE TABLE "SlideLibraryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlideLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlideLibraryItem_userId_updatedAt_idx" ON "SlideLibraryItem"("userId", "updatedAt");

-- AddForeignKey
ALTER TABLE "SlideLibraryItem" ADD CONSTRAINT "SlideLibraryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
