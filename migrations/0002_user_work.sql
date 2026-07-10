-- Migration number: 0002 	 2026-07-10

create table "user_note" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "status" text not null, "payload" text not null, "createdAt" integer not null, "updatedAt" integer not null);

create index "user_note_userId_caseId_idx" on "user_note" ("userId", "caseId");

create table "note_addendum" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "noteId" text not null, "body" text not null, "createdAt" integer not null);

create index "note_addendum_userId_caseId_idx" on "note_addendum" ("userId", "caseId");

create table "wrapup_attempt" ("userId" text not null references "user" ("id") on delete cascade, "caseId" text not null, "text" text not null, "at" text not null, "signed" integer not null, "updatedAt" integer not null, primary key ("userId", "caseId"));
