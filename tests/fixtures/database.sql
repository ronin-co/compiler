CREATE TABLE "accounts" ("id" text, "handle" text, "firstName" text, "lastName" text, PRIMARY KEY (id));
CREATE TABLE "products" ("id" text, "name" text, "position" integer, PRIMARY KEY (id));
CREATE TABLE "members" ("id" text, "account" text, PRIMARY KEY (id), FOREIGN KEY ("account") REFERENCES "accounts"("id"));
CREATE TABLE "teams" ("id" text, "billing" text, PRIMARY KEY (id));

INSERT INTO "accounts" ("id", "handle", "firstName", "lastName") VALUES
('acc_39h8fhe98hefah8', 'elaine', 'Elaine', 'Jones'),
('acc_39h8fhe98hefah9', 'david', 'David', 'Brown');

INSERT INTO "products" ("id", "name", "position") VALUES
('pro_39h8fhe98hefah8', 'Apple', 1),
('pro_39h8fhe98hefah9', 'Banana', 2),
('pro_39h8fhe98hefah0', 'Cherry', 3);

INSERT INTO "members" ("id", "account") VALUES
('mem_39h8fhe98hefah8', 'acc_39h8fhe98hefah8'),
('mem_39h8fhe98hefah9', 'acc_39h8fhe98hefah9');

INSERT INTO "teams" ("id", "billing") VALUES
('team_39h8fhe98hefah8', '{"invoiceRecipient":"receipts@site.org"}'),
('team_39h8fhe98hefah9', '{"invoiceRecipient":"receipts@company.net"}');