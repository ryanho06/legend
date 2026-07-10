-- Migration number: 0004 	 2026-07-10

create table "case_session" ("scope" text not null references "user" ("id") on delete cascade, "caseId" text not null, "simNow" integer not null, "updatedAt" integer not null, primary key ("scope", "caseId"));
