import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "admin",
  "lawyer",
  "admin_staff",
  "accountant",
  "limited",
]);

export const caseStatusEnum = pgEnum("case_status", [
  "new",
  "active",
  "on_hold",
  "closed",
  "appeal",
]);

export const hearingStatusEnum = pgEnum("hearing_status", [
  "scheduled",
  "completed",
  "postponed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "urgent"]);

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const financeTypeEnum = pgEnum("finance_type", ["invoice", "payment", "expense"]);

export const financeStatusEnum = pgEnum("finance_status", [
  "draft",
  "pending",
  "paid",
  "partial",
  "overdue",
  "approved",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  phone: varchar("phone", { length: 40 }).notNull(),
  role: roleEnum("role").notNull().default("limited"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable("role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  role: roleEnum("role").notNull(),
  module: varchar("module", { length: 60 }).notNull(),
  canView: boolean("can_view").notNull().default(false),
  canCreate: boolean("can_create").notNull().default(false),
  canEdit: boolean("can_edit").notNull().default(false),
  canDelete: boolean("can_delete").notNull().default(false),
  canPrint: boolean("can_print").notNull().default(false),
  canExport: boolean("can_export").notNull().default(false),
  canApprove: boolean("can_approve").notNull().default(false),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 180 }).notNull(),
  identityNumber: varchar("identity_number", { length: 60 }).notNull(),
  phone: varchar("phone", { length: 40 }).notNull(),
  email: varchar("email", { length: 190 }),
  address: text("address").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const legalCases = pgTable("legal_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseNumber: varchar("case_number", { length: 80 }).notNull(),
  caseName: varchar("case_name", { length: 180 }).notNull(),
  caseType: varchar("case_type", { length: 120 }).notNull(),
  court: varchar("court", { length: 160 }).notNull(),
  circuit: varchar("circuit", { length: 160 }).notNull(),
  status: caseStatusEnum("status").notNull().default("new"),
  startDate: date("start_date").notNull(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  lawyerId: uuid("lawyer_id")
    .references(() => users.id, { onDelete: "set null" }),
  opponent: varchar("opponent", { length: 180 }).notNull().default(""),
  details: text("details").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const caseActions = pgTable("case_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => legalCases.id, { onDelete: "cascade" }),
  actionTitle: varchar("action_title", { length: 180 }).notNull(),
  details: text("details").notNull().default(""),
  actionDate: date("action_date").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hearings = pgTable("hearings", {
  id: uuid("id").defaultRandom().primaryKey(),
  hearingDate: date("hearing_date").notNull(),
  hearingTime: time("hearing_time").notNull(),
  court: varchar("court", { length: 160 }).notNull(),
  hall: varchar("hall", { length: 120 }).notNull().default(""),
  caseId: uuid("case_id")
    .notNull()
    .references(() => legalCases.id, { onDelete: "cascade" }),
  lawyerId: uuid("lawyer_id").references(() => users.id, { onDelete: "set null" }),
  result: text("result").notNull().default(""),
  notes: text("notes").notNull().default(""),
  reminderMinutes: integer("reminder_minutes").notNull().default(60),
  status: hearingStatusEnum("status").notNull().default("scheduled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description").notNull().default(""),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: taskStatusEnum("status").notNull().default("pending"),
  alertBeforeMinutes: integer("alert_before_minutes").notNull().default(120),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storedName: varchar("stored_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 120 }).notNull(),
  size: integer("size").notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  caseId: uuid("case_id").references(() => legalCases.id, { onDelete: "set null" }),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const financeEntries = pgTable("finance_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  entryType: financeTypeEnum("entry_type").notNull(),
  title: varchar("title", { length: 190 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  caseId: uuid("case_id").references(() => legalCases.id, { onDelete: "set null" }),
  status: financeStatusEnum("status").notNull().default("draft"),
  dueDate: date("due_date"),
  notes: text("notes").notNull().default(""),
  approved: boolean("approved").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 120 }).notNull(),
  entityId: varchar("entity_id", { length: 120 }).notNull().default("-"),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type LegalCase = typeof legalCases.$inferSelect;
export type Hearing = typeof hearings.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type DocumentRecord = typeof documents.$inferSelect;
export type FinanceEntry = typeof financeEntries.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
