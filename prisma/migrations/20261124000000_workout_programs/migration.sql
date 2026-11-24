-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('COACH', 'ATHLETE');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Athlete" (
    "coachId" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("coachId","id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginSession" (
    "digest" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginSession_pkey" PRIMARY KEY ("digest")
);

-- CreateTable
CREATE TABLE "ProgramTemplate" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "durationValue" INTEGER NOT NULL,
    "durationUnit" TEXT NOT NULL,
    "sessionCount" INTEGER NOT NULL,
    "status" "ProgramStatus" NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramVersion" (
    "templateId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramVersion_pkey" PRIMARY KEY ("templateId","revision")
);

-- CreateTable
CREATE TABLE "ProgramAssignment" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "requestId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledSession" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "cycleIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "override" JSONB,
    "reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ScheduledSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutLog" (
    "sessionId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("sessionId","entryId")
);

-- CreateIndex
CREATE INDEX "Athlete_coachId_name_idx" ON "Athlete"("coachId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_login_key" ON "Account"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Account_coachId_athleteId_key" ON "Account"("coachId", "athleteId");

-- CreateIndex
CREATE INDEX "LoginSession_expiresAt_idx" ON "LoginSession"("expiresAt");

-- CreateIndex
CREATE INDEX "ProgramTemplate_coachId_status_updatedAt_idx" ON "ProgramTemplate"("coachId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "ProgramTemplate_coachId_updatedAt_idx" ON "ProgramTemplate"("coachId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramTemplate_coachId_id_key" ON "ProgramTemplate"("coachId", "id");

-- CreateIndex
CREATE INDEX "ProgramAssignment_coachId_athleteId_startDate_idx" ON "ProgramAssignment"("coachId", "athleteId", "startDate");

-- CreateIndex
CREATE INDEX "ProgramAssignment_templateId_revision_idx" ON "ProgramAssignment"("templateId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramAssignment_coachId_requestId_athleteId_key" ON "ProgramAssignment"("coachId", "requestId", "athleteId");

-- CreateIndex
CREATE INDEX "ScheduledSession_assignmentId_date_idx" ON "ScheduledSession"("assignmentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledSession_assignmentId_cycleIndex_slotId_key" ON "ScheduledSession"("assignmentId", "cycleIndex", "slotId");

-- AddForeignKey
ALTER TABLE "Athlete" ADD CONSTRAINT "Athlete_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_coachId_athleteId_fkey" FOREIGN KEY ("coachId", "athleteId") REFERENCES "Athlete"("coachId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginSession" ADD CONSTRAINT "LoginSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramTemplate" ADD CONSTRAINT "ProgramTemplate_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramVersion" ADD CONSTRAINT "ProgramVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProgramTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_coachId_athleteId_fkey" FOREIGN KEY ("coachId", "athleteId") REFERENCES "Athlete"("coachId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_coachId_templateId_fkey" FOREIGN KEY ("coachId", "templateId") REFERENCES "ProgramTemplate"("coachId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "ProgramAssignment_templateId_revision_fkey" FOREIGN KEY ("templateId", "revision") REFERENCES "ProgramVersion"("templateId", "revision") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledSession" ADD CONSTRAINT "ScheduledSession_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ProgramAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScheduledSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Copy identifiers only. Legacy workouts, media and feedback stay in their original document.
INSERT INTO "Athlete" ("coachId", "id", "name")
SELECT w.id, s->>'id', s->>'name'
FROM "Workspace" w
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(w.data->'students', '[]'::jsonb)) s
WHERE s->>'id' IS NOT NULL AND s->>'name' IS NOT NULL
ON CONFLICT ("coachId", "id") DO NOTHING;

ALTER TABLE "Account" ADD CONSTRAINT "account_role_athlete"
CHECK (("role" = 'COACH' AND "athleteId" IS NULL) OR ("role" = 'ATHLETE' AND "athleteId" IS NOT NULL));
CREATE UNIQUE INDEX "one_coach_account_per_workspace" ON "Account" ("coachId") WHERE "role" = 'COACH';
ALTER TABLE "ProgramAssignment" ADD CONSTRAINT "assignment_dates" CHECK ("endDate" >= "startDate");

