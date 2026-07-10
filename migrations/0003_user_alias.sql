-- Migration number: 0003 	 2026-07-10

create table "user_alias" ("id" text not null primary key, "userId" text not null references "user" ("id") on delete cascade, "forename" text, "surname" text, "grade" text, "hcpId" text not null, "createdAt" integer not null);

create index "user_alias_userId_idx" on "user_alias" ("userId");
