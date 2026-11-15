CREATE TABLE "Workspace" (
  "id" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "Clip" (
  "id" TEXT PRIMARY KEY,
  "content" BYTEA NOT NULL,
  "mime" TEXT NOT NULL
);