import "server-only";

import bcrypt from "bcryptjs";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { db } from "@/db";
import {
  activityLogs,
  caseActions,
  clients,
  documents,
  financeEntries,
  hearings,
  legalCases,
  rolePermissions,
  sessions,
  tasks,
  users,
  type RolePermission,
  type User,
} from "@/db/schema";

export const SESSION_COOKIE = "legalpro_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
export const UPLOAD_ROOT = path.join(process.cwd(), "storage", "documents");

export const ROLES = ["admin", "lawyer", "admin_staff", "accountant", "limited"] as const;
export type Role = (typeof ROLES)[number];

export const MODULES = [
  "dashboard",
  "clients",
  "cases",
  "hearings",
  "tasks",
  "documents",
  "finance",
  "users",
  "reports",
] as const;
export type ModuleKey = (typeof MODULES)[number];

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "print",
  "export",
  "approve",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionFlags = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
  approve: boolean;
};

export type PermissionMap = Record<ModuleKey, PermissionFlags>;

export type SessionContext = {
  user: User;
  permissions: PermissionMap;
};

export type SectionKey =
  | "overview"
  | "clients"
  | "cases"
  | "hearings"
  | "tasks"
  | "documents"
  | "finance"
  | "users"
  | "reports";

export const SECTION_TO_MODULE: Record<SectionKey, ModuleKey> = {
  overview: "dashboard",
  clients: "clients",
  cases: "cases",
  hearings: "hearings",
  tasks: "tasks",
  documents: "documents",
  finance: "finance",
  users: "users",
  reports: "reports",
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  lawyer: "محامي",
  admin_staff: "موظف إداري",
  accountant: "محاسب",
  limited: "مستخدم محدود",
};

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "لوحة التحكم",
  clients: "العملاء",
  cases: "القضايا",
  hearings: "الجلسات",
  tasks: "المهام",
  documents: "المستندات",
  finance: "الإدارة المالية",
  users: "المستخدمون والصلاحيات",
  reports: "التقارير",
};

export const SECTION_LABELS: Record<SectionKey, string> = {
  overview: "لوحة التحكم",
  clients: "إدارة العملاء",
  cases: "إدارة القضايا",
  hearings: "إدارة الجلسات",
  tasks: "إدارة المهام",
  documents: "إدارة المستندات",
  finance: "الإدارة المالية",
  users: "إدارة المستخدمين والصلاحيات",
  reports: "التقارير والتصدير",
};

export const NAV_ITEMS: { key: SectionKey; module: ModuleKey; label: string; hint: string }[] = [
  { key: "overview", module: "dashboard", label: "لوحة التحكم", hint: "نظرة شاملة" },
  { key: "clients", module: "clients", label: "العملاء", hint: "البيانات والعلاقات" },
  { key: "cases", module: "cases", label: "القضايا", hint: "التفاصيل والإجراءات" },
  { key: "hearings", module: "hearings", label: "الجلسات", hint: "المواعيد والنتائج" },
  { key: "tasks", module: "tasks", label: "المهام", hint: "التكليفات والتنبيهات" },
  { key: "documents", module: "documents", label: "المستندات", hint: "رفع ومعاينة آمنة" },
  { key: "finance", module: "finance", label: "المالية", hint: "الفواتير والدفعات" },
  { key: "users", module: "users", label: "المستخدمون", hint: "الأدوار والصلاحيات" },
  { key: "reports", module: "reports", label: "التقارير", hint: "PDF و Excel" },
];

export const CASE_STATUS_LABELS: Record<string, string> = {
  new: "جديدة",
  active: "نشطة",
  on_hold: "معلقة",
  closed: "مغلقة",
  appeal: "استئناف",
};

export const HEARING_STATUS_LABELS: Record<string, string> = {
  scheduled: "مجدولة",
  completed: "مكتملة",
  postponed: "مؤجلة",
  cancelled: "ملغاة",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "مرتفعة",
  urgent: "عاجلة",
};

export const FINANCE_TYPE_LABELS: Record<string, string> = {
  invoice: "فاتورة / أتعاب",
  payment: "دفعة / إيراد",
  expense: "مصروف",
};

export const FINANCE_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  pending: "معلق",
  paid: "مدفوع",
  partial: "مدفوع جزئيًا",
  overdue: "متأخر",
  approved: "معتمد",
};

const emptyPermissions = (): PermissionMap => ({
  dashboard: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  clients: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  cases: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  hearings: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  tasks: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  documents: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  finance: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  users: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  reports: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
});

const defaultPermissionPreset: Record<Role, PermissionMap> = {
  admin: Object.fromEntries(
    MODULES.map((module) => [
      module,
      { view: true, create: true, edit: true, delete: true, print: true, export: true, approve: true },
    ]),
  ) as PermissionMap,
  lawyer: {
    dashboard: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    clients: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    cases: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    hearings: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    tasks: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    documents: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    finance: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    users: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    reports: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
  },
  admin_staff: {
    dashboard: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    clients: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    cases: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    hearings: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    tasks: { view: true, create: true, edit: true, delete: false, print: true, export: true, approve: false },
    documents: { view: true, create: true, edit: true, delete: true, print: true, export: true, approve: false },
    finance: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    users: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    reports: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
  },
  accountant: {
    dashboard: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    clients: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    cases: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    hearings: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    tasks: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    documents: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
    finance: { view: true, create: true, edit: true, delete: true, print: true, export: true, approve: true },
    users: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    reports: { view: true, create: false, edit: false, delete: false, print: true, export: true, approve: false },
  },
  limited: {
    dashboard: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    clients: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    cases: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    hearings: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    tasks: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    documents: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    finance: { view: true, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    users: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
    reports: { view: false, create: false, edit: false, delete: false, print: false, export: false, approve: false },
  },
};

const optionalEmail = z.union([z.literal(""), z.string().email("صيغة البريد الإلكتروني غير صحيحة")]);
const optionalUuid = z.union([z.literal(""), z.string().uuid()]).transform((value) => value || null);

export const clientSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  fullName: z.string().trim().min(3, "اسم العميل مطلوب"),
  identityNumber: z.string().trim().min(5, "رقم الهوية/الإقامة مطلوب"),
  phone: z.string().trim().min(7, "رقم الجوال مطلوب"),
  email: optionalEmail,
  address: z.string().trim().min(3, "العنوان مطلوب"),
  notes: z.string().trim().optional().default(""),
});

export const legalCaseSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  caseNumber: z.string().trim().min(2, "رقم القضية مطلوب"),
  caseName: z.string().trim().min(3, "اسم القضية مطلوب"),
  caseType: z.string().trim().min(2, "نوع القضية مطلوب"),
  court: z.string().trim().min(2, "المحكمة مطلوبة"),
  circuit: z.string().trim().min(2, "الدائرة مطلوبة"),
  status: z.enum(["new", "active", "on_hold", "closed", "appeal"]),
  startDate: z.string().trim().min(1, "تاريخ بداية القضية مطلوب"),
  clientId: z.string().uuid("العميل المرتبط مطلوب"),
  lawyerId: optionalUuid,
  opponent: z.string().trim().optional().default(""),
  details: z.string().trim().optional().default(""),
});

export const caseActionSchema = z.object({
  caseId: z.string().uuid("يجب اختيار القضية"),
  actionTitle: z.string().trim().min(2, "عنوان الإجراء مطلوب"),
  details: z.string().trim().optional().default(""),
  actionDate: z.string().trim().min(1, "تاريخ الإجراء مطلوب"),
});

export const hearingSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  hearingDate: z.string().trim().min(1, "تاريخ الجلسة مطلوب"),
  hearingTime: z.string().trim().min(1, "وقت الجلسة مطلوب"),
  court: z.string().trim().min(2, "المحكمة مطلوبة"),
  hall: z.string().trim().optional().default(""),
  caseId: z.string().uuid("القضية المرتبطة مطلوبة"),
  lawyerId: optionalUuid,
  result: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  reminderMinutes: z.coerce.number().min(0, "قيمة التذكير غير صحيحة").max(10080, "قيمة التذكير كبيرة جدًا"),
  status: z.enum(["scheduled", "completed", "postponed", "cancelled"]),
});

export const taskSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  title: z.string().trim().min(3, "عنوان المهمة مطلوب"),
  description: z.string().trim().optional().default(""),
  assigneeId: optionalUuid,
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.string().trim().min(1, "تاريخ الاستحقاق مطلوب"),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
  alertBeforeMinutes: z.coerce.number().min(0, "قيمة التنبيه غير صحيحة").max(10080, "قيمة التنبيه كبيرة جدًا"),
});

export const financeSchema = z.object({
  id: z.union([z.literal(""), z.string().uuid()]).optional(),
  entryType: z.enum(["invoice", "payment", "expense"]),
  title: z.string().trim().min(2, "العنوان مطلوب"),
  amount: z.coerce.number().positive("المبلغ يجب أن يكون أكبر من صفر"),
  clientId: optionalUuid,
  caseId: optionalUuid,
  status: z.enum(["draft", "pending", "paid", "partial", "overdue", "approved"]),
  dueDate: z.union([z.literal(""), z.string().trim()]).optional().transform((value) => value || null),
  notes: z.string().trim().optional().default(""),
  approved: z.boolean().optional().default(false),
});

export const userSchema = z
  .object({
    id: z.union([z.literal(""), z.string().uuid()]).optional(),
    fullName: z.string().trim().min(3, "اسم المستخدم مطلوب"),
    email: z.string().trim().email("البريد الإلكتروني غير صحيح"),
    phone: z.string().trim().min(7, "رقم الجوال مطلوب"),
    role: z.enum(ROLES),
    password: z.string().trim().optional().default(""),
    active: z.boolean().optional().default(true),
  })
  .refine((value) => (value.id ? true : value.password.length >= 8), {
    message: "كلمة المرور مطلوبة وبحد أدنى 8 أحرف عند إنشاء مستخدم جديد",
    path: ["password"],
  });

export const permissionSchema = z.object({
  role: z.enum(ROLES),
  module: z.enum(MODULES),
  canView: z.boolean().optional().default(false),
  canCreate: z.boolean().optional().default(false),
  canEdit: z.boolean().optional().default(false),
  canDelete: z.boolean().optional().default(false),
  canPrint: z.boolean().optional().default(false),
  canExport: z.boolean().optional().default(false),
  canApprove: z.boolean().optional().default(false),
});

export const documentSchema = z.object({
  category: z.string().trim().min(2, "تصنيف المستند مطلوب"),
  clientId: optionalUuid,
  caseId: optionalUuid,
});

export function parseSection(value?: string | string[]): SectionKey {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return "overview";
  return (
    [
      "overview",
      "clients",
      "cases",
      "hearings",
      "tasks",
      "documents",
      "finance",
      "users",
      "reports",
    ] as const
  ).includes(normalized as SectionKey)
    ? (normalized as SectionKey)
    : "overview";
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatMoney(value?: number | string | null) {
  const amount = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function makeDashboardUrl(section: SectionKey, params?: Record<string, string | undefined | null>) {
  const search = new URLSearchParams({ section });
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return `/dashboard?${search.toString()}`;
}

export function getPermissionValue(permission: PermissionFlags, action: PermissionAction) {
  return permission[action];
}

export function hasPermission(
  context: SessionContext | null,
  module: ModuleKey,
  action: PermissionAction = "view",
): boolean {
  if (!context) return false;
  if (context.user.role === "admin") return true;
  return context.permissions[module]?.[action] ?? false;
}

export function getUploadPath(storedName: string) {
  return path.join(UPLOAD_ROOT, storedName);
}

export async function ensureUploadRoot() {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizePermissions(rows: RolePermission[]): PermissionMap {
  const result = emptyPermissions();
  for (const row of rows) {
    const module = row.module as ModuleKey;
    if (!MODULES.includes(module)) continue;
    result[module] = {
      view: row.canView,
      create: row.canCreate,
      edit: row.canEdit,
      delete: row.canDelete,
      print: row.canPrint,
      export: row.canExport,
      approve: row.canApprove,
    };
  }
  return result;
}

async function seedRolePermissions() {
  const inserts = ROLES.flatMap((role) =>
    MODULES.map((module) => {
      const preset = defaultPermissionPreset[role][module];
      return {
        id: randomUUID(),
        role,
        module,
        canView: preset.view,
        canCreate: preset.create,
        canEdit: preset.edit,
        canDelete: preset.delete,
        canPrint: preset.print,
        canExport: preset.export,
        canApprove: preset.approve,
      };
    }),
  );

  await db.insert(rolePermissions).values(inserts);
}

export async function ensureSystemSeeded() {
  await ensureUploadRoot();

  const [existingUsers] = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  if ((existingUsers?.count ?? 0) > 0) return;

  await seedRolePermissions();

  const adminId = randomUUID();
  const lawyerId = randomUUID();
  const accountantId = randomUUID();
  const staffId = randomUUID();
  const limitedId = randomUUID();
  const adminPasswordHash = await hashPassword("Admin@12345");
  const userPasswordHash = await hashPassword("Legal@12345");

  await db.insert(users).values([
    {
      id: adminId,
      fullName: "مدير النظام - LegalPro Elite",
      email: "admin@legalpro.local",
      phone: "0500000001",
      role: "admin",
      passwordHash: adminPasswordHash,
      active: true,
    },
    {
      id: lawyerId,
      fullName: "أ. خالد العتيبي",
      email: "lawyer@legalpro.local",
      phone: "0500000002",
      role: "lawyer",
      passwordHash: userPasswordHash,
      active: true,
    },
    {
      id: accountantId,
      fullName: "أ. ريم المحاسبي",
      email: "accountant@legalpro.local",
      phone: "0500000003",
      role: "accountant",
      passwordHash: userPasswordHash,
      active: true,
    },
    {
      id: staffId,
      fullName: "أ. ناصر الإداري",
      email: "staff@legalpro.local",
      phone: "0500000004",
      role: "admin_staff",
      passwordHash: userPasswordHash,
      active: true,
    },
    {
      id: limitedId,
      fullName: "مستخدم محدود",
      email: "limited@legalpro.local",
      phone: "0500000005",
      role: "limited",
      passwordHash: userPasswordHash,
      active: true,
    },
  ]);

  const clientOneId = randomUUID();
  const clientTwoId = randomUUID();
  const caseOneId = randomUUID();
  const caseTwoId = randomUUID();
  const hearingOneId = randomUUID();
  const hearingTwoId = randomUUID();
  const taskOneId = randomUUID();
  const taskTwoId = randomUUID();

  await db.insert(clients).values([
    {
      id: clientOneId,
      fullName: "شركة النخبة القابضة",
      identityNumber: "7001002003",
      phone: "0551010101",
      email: "client1@example.com",
      address: "الرياض - حي العليا - طريق الملك فهد",
      notes: "عميل إستراتيجي ويحتاج متابعة أسبوعية.",
    },
    {
      id: clientTwoId,
      fullName: "مؤسسة آفاق التجارية",
      identityNumber: "1020304050",
      phone: "0552020202",
      email: "client2@example.com",
      address: "جدة - شارع التحلية",
      notes: "يوجد نزاع تعاقدي ومستندات بحاجة لأرشفة مستمرة.",
    },
  ]);

  await db.insert(legalCases).values([
    {
      id: caseOneId,
      caseNumber: "LP-2026-001",
      caseName: "مطالبة مالية تجارية",
      caseType: "تجاري",
      court: "المحكمة التجارية بالرياض",
      circuit: "الدائرة الثانية",
      status: "active",
      startDate: new Date().toISOString().slice(0, 10),
      clientId: clientOneId,
      lawyerId,
      opponent: "شركة المدار للمقاولات",
      details: "مطالبة بأتعاب وتأخر سداد قيمة عقد توريد.",
    },
    {
      id: caseTwoId,
      caseNumber: "LP-2026-002",
      caseName: "نزاع عقد توريد",
      caseType: "مدني",
      court: "المحكمة العامة بجدة",
      circuit: "الدائرة السابعة",
      status: "appeal",
      startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10),
      clientId: clientTwoId,
      lawyerId,
      opponent: "مؤسسة السهم الذهبي",
      details: "استئناف على حكم ابتدائي بشأن فسخ عقد توريد ومطالبة بالتعويض.",
    },
  ]);

  await db.insert(caseActions).values([
    {
      id: randomUUID(),
      caseId: caseOneId,
      actionTitle: "إيداع صحيفة الدعوى",
      details: "تم رفع الدعوى إلكترونيًا وإرفاق العقد والفواتير.",
      actionDate: new Date().toISOString().slice(0, 10),
      createdBy: lawyerId,
    },
    {
      id: randomUUID(),
      caseId: caseTwoId,
      actionTitle: "رفع لائحة الاستئناف",
      details: "تمت مراجعة الحكم ورفع مذكرة الاعتراض التفصيلية.",
      actionDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString().slice(0, 10),
      createdBy: lawyerId,
    },
  ]);

  await db.insert(hearings).values([
    {
      id: hearingOneId,
      hearingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10),
      hearingTime: "10:30",
      court: "المحكمة التجارية بالرياض",
      hall: "قاعة 4",
      caseId: caseOneId,
      lawyerId,
      result: "",
      notes: "مراجعة العقد وكشف الحساب قبل الجلسة.",
      reminderMinutes: 1440,
      status: "scheduled",
    },
    {
      id: hearingTwoId,
      hearingDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 9).toISOString().slice(0, 10),
      hearingTime: "12:00",
      court: "المحكمة العامة بجدة",
      hall: "قاعة 2",
      caseId: caseTwoId,
      lawyerId,
      result: "",
      notes: "إعداد مذكرة تعقيبية موجزة.",
      reminderMinutes: 2880,
      status: "scheduled",
    },
  ]);

  await db.insert(tasks).values([
    {
      id: taskOneId,
      title: "إعداد مذكرة رد",
      description: "إعداد مذكرة تفصيلية للرد على دفوع الخصم في القضية التجارية.",
      assigneeId: lawyerId,
      priority: "high" as const,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
      status: "in_progress" as const,
      alertBeforeMinutes: 180,
    },
    {
      id: taskTwoId,
      title: "أرشفة مستندات العميل",
      description: "ترتيب مستندات قضية النزاع المدني ورفعها للنظام.",
      assigneeId: staffId,
      priority: "medium" as const,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5),
      status: "pending" as const,
      alertBeforeMinutes: 240,
    },
  ]);

  await db.insert(financeEntries).values([
    {
      id: randomUUID(),
      entryType: "invoice",
      title: "فاتورة أتعاب القضية التجارية",
      amount: "15000.00",
      clientId: clientOneId,
      caseId: caseOneId,
      status: "approved",
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString().slice(0, 10),
      notes: "أتعاب المرحلة الابتدائية.",
      approved: true,
      createdBy: accountantId,
    },
    {
      id: randomUUID(),
      entryType: "payment",
      title: "دفعة مقدمة من العميل",
      amount: "8000.00",
      clientId: clientOneId,
      caseId: caseOneId,
      status: "paid",
      dueDate: null,
      notes: "تم التحصيل عبر تحويل بنكي.",
      approved: true,
      createdBy: accountantId,
    },
    {
      id: randomUUID(),
      entryType: "expense",
      title: "رسوم ترجمة وتصديق",
      amount: "1200.00",
      clientId: clientTwoId,
      caseId: caseTwoId,
      status: "paid",
      dueDate: null,
      notes: "مصاريف تجهيز ملف الاستئناف.",
      approved: true,
      createdBy: accountantId,
    },
  ]);

  await db.insert(activityLogs).values([
    {
      id: randomUUID(),
      userId: adminId,
      action: "seed",
      entityType: "system",
      entityId: "bootstrap",
      description: "تم تهيئة نظام LegalPro Elite وإضافة البيانات التجريبية الأساسية.",
    },
  ]);
}

export async function logActivity(
  userId: string | null | undefined,
  action: string,
  entityType: string,
  entityId: string,
  description: string,
) {
  await db.insert(activityLogs).values({
    id: randomUUID(),
    userId: userId ?? null,
    action,
    entityType,
    entityId,
    description,
  });
}

export async function getSessionContext(): Promise<SessionContext | null> {
  await ensureSystemSeeded();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [record] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()), eq(users.active, true)));

  if (!record?.user) return null;

  const permissionRows = await db.select().from(rolePermissions).where(eq(rolePermissions.role, record.user.role));
  return {
    user: record.user,
    permissions: normalizePermissions(permissionRows),
  };
}

export async function requireUser() {
  const context = await getSessionContext();
  if (!context) redirect("/login?error=expired");
  return context;
}

export async function requireSectionAccess(section: SectionKey) {
  const context = await requireUser();
  const module = SECTION_TO_MODULE[section];
  if (!hasPermission(context, module, "view")) {
    redirect(makeDashboardUrl("overview", { alert: "forbidden" }));
  }
  return context;
}

export async function requireModulePermission(module: ModuleKey, action: PermissionAction) {
  const context = await requireUser();
  if (!hasPermission(context, module, action)) {
    redirect(makeDashboardUrl("overview", { alert: "forbidden" }));
  }
  return context;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(sessions).values({
    id: randomUUID(),
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function getFormBoolean(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function getFirstError(error: unknown) {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "تعذر التحقق من البيانات المدخلة";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "حدث خطأ غير متوقع";
}

export async function getOverviewMetrics() {
  const [caseStats] = await db.select({ count: sql<number>`count(*)::int` }).from(legalCases);
  const [clientStats] = await db.select({ count: sql<number>`count(*)::int` }).from(clients);
  const [upcomingHearings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hearings)
    .where(eq(hearings.status, "scheduled"));

  const [revenueStats] = await db
    .select({ total: sql<string>`coalesce(sum(case when ${financeEntries.entryType} = 'payment' then ${financeEntries.amount} else 0 end), 0)` })
    .from(financeEntries);
  const [expenseStats] = await db
    .select({ total: sql<string>`coalesce(sum(case when ${financeEntries.entryType} = 'expense' then ${financeEntries.amount} else 0 end), 0)` })
    .from(financeEntries);

  const recentActivities = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      description: activityLogs.description,
      createdAt: activityLogs.createdAt,
      userName: users.fullName,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(8);

  const alerts: { title: string; tone: "danger" | "warning" | "info"; detail: string }[] = [];

  const dueHearings = await db
    .select({
      id: hearings.id,
      hearingDate: hearings.hearingDate,
      hearingTime: hearings.hearingTime,
      caseName: legalCases.caseName,
    })
    .from(hearings)
    .innerJoin(legalCases, eq(hearings.caseId, legalCases.id))
    .where(eq(hearings.status, "scheduled"))
    .orderBy(asc(hearings.hearingDate))
    .limit(4);

  for (const hearing of dueHearings) {
    alerts.push({
      title: `جلسة قريبة: ${hearing.caseName}`,
      tone: "warning",
      detail: `${hearing.hearingDate} الساعة ${hearing.hearingTime}`,
    });
  }

  const overdueTasks = await db
    .select({ title: tasks.title, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.status, "pending"), sql`${tasks.dueDate} < now()`))
    .orderBy(asc(tasks.dueDate))
    .limit(3);

  for (const task of overdueTasks) {
    alerts.push({
      title: `مهمة متأخرة: ${task.title}`,
      tone: "danger",
      detail: `تاريخ الاستحقاق ${formatDateTime(task.dueDate)}`,
    });
  }

  const overdueFinance = await db
    .select({ title: financeEntries.title, dueDate: financeEntries.dueDate })
    .from(financeEntries)
    .where(and(eq(financeEntries.entryType, "invoice"), sql`${financeEntries.dueDate} is not null and ${financeEntries.dueDate} < current_date`))
    .limit(3);

  for (const item of overdueFinance) {
    alerts.push({
      title: `فاتورة متأخرة: ${item.title}`,
      tone: "info",
      detail: `تاريخ الاستحقاق ${formatDate(item.dueDate)}`,
    });
  }

  return {
    totalCases: caseStats?.count ?? 0,
    totalClients: clientStats?.count ?? 0,
    upcomingHearings: upcomingHearings?.count ?? 0,
    revenues: Number(revenueStats?.total ?? 0),
    expenses: Number(expenseStats?.total ?? 0),
    alerts,
    recentActivities,
  };
}

export async function getRolePermissionRows() {
  return db.select().from(rolePermissions).orderBy(asc(rolePermissions.role), asc(rolePermissions.module));
}

export async function getDashboardLookups() {
  const clientRows = await db.select().from(clients).orderBy(desc(clients.createdAt));
  const userRows = await db.select().from(users).orderBy(asc(users.fullName));
  const caseRows = await db.select().from(legalCases).orderBy(desc(legalCases.createdAt));
  return { clientRows, userRows, caseRows };
}

export async function getClientBalances() {
  const rows = await db.execute(sql`
    select
      c.id,
      c.full_name,
      coalesce(sum(case when f.entry_type = 'invoice' then f.amount else 0 end), 0) as invoices,
      coalesce(sum(case when f.entry_type = 'payment' then f.amount else 0 end), 0) as payments,
      coalesce(sum(case when f.entry_type = 'invoice' then f.amount else 0 end), 0) -
      coalesce(sum(case when f.entry_type = 'payment' then f.amount else 0 end), 0) as balance
    from clients c
    left join finance_entries f on f.client_id = c.id
    group by c.id, c.full_name
    order by c.full_name asc
  `);

  return rows.rows.map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name),
    invoices: Number(row.invoices ?? 0),
    payments: Number(row.payments ?? 0),
    balance: Number(row.balance ?? 0),
  }));
}

export async function getLawyerPerformanceRows() {
  const rows = await db.execute(sql`
    select
      u.id,
      u.full_name,
      count(distinct lc.id)::int as cases_count,
      count(distinct h.id)::int as hearings_count,
      count(distinct t.id)::int as tasks_count
    from users u
    left join legal_cases lc on lc.lawyer_id = u.id
    left join hearings h on h.lawyer_id = u.id
    left join tasks t on t.assignee_id = u.id
    where u.role in ('admin', 'lawyer', 'admin_staff')
    group by u.id, u.full_name
    order by u.full_name asc
  `);

  return rows.rows.map((row) => ({
    id: String(row.id),
    fullName: String(row.full_name),
    casesCount: Number(row.cases_count ?? 0),
    hearingsCount: Number(row.hearings_count ?? 0),
    tasksCount: Number(row.tasks_count ?? 0),
  }));
}

export async function getReportDataset(type: string) {
  switch (type) {
    case "clients": {
      const rows = await db
        .select({
          name: clients.fullName,
          identity: clients.identityNumber,
          phone: clients.phone,
          email: clients.email,
          createdAt: clients.createdAt,
        })
        .from(clients)
        .orderBy(asc(clients.fullName));
      return {
        title: "تقرير العملاء",
        columns: ["الاسم", "الهوية", "الجوال", "البريد", "تاريخ الإضافة"],
        rows: rows.map((row) => [row.name, row.identity, row.phone, row.email ?? "", formatDateTime(row.createdAt)]),
        summary: [
          { label: "Total Clients", value: String(rows.length) },
        ],
      };
    }
    case "cases": {
      const rows = await db
        .select({
          number: legalCases.caseNumber,
          name: legalCases.caseName,
          type: legalCases.caseType,
          court: legalCases.court,
          status: legalCases.status,
          client: clients.fullName,
        })
        .from(legalCases)
        .innerJoin(clients, eq(legalCases.clientId, clients.id))
        .orderBy(desc(legalCases.createdAt));
      return {
        title: "تقرير القضايا",
        columns: ["رقم القضية", "الاسم", "النوع", "المحكمة", "الحالة", "العميل"],
        rows: rows.map((row) => [
          row.number,
          row.name,
          row.type,
          row.court,
          CASE_STATUS_LABELS[row.status],
          row.client,
        ]),
        summary: [{ label: "Total Cases", value: String(rows.length) }],
      };
    }
    case "hearings": {
      const rows = await db
        .select({
          date: hearings.hearingDate,
          time: hearings.hearingTime,
          court: hearings.court,
          hall: hearings.hall,
          status: hearings.status,
          caseName: legalCases.caseName,
        })
        .from(hearings)
        .innerJoin(legalCases, eq(hearings.caseId, legalCases.id))
        .orderBy(asc(hearings.hearingDate));
      return {
        title: "تقرير الجلسات",
        columns: ["التاريخ", "الوقت", "المحكمة", "القاعة", "الحالة", "القضية"],
        rows: rows.map((row) => [
          formatDate(row.date),
          row.time,
          row.court,
          row.hall,
          HEARING_STATUS_LABELS[row.status],
          row.caseName,
        ]),
        summary: [{ label: "Total Hearings", value: String(rows.length) }],
      };
    }
    case "revenues": {
      const rows = await db
        .select({
          title: financeEntries.title,
          amount: financeEntries.amount,
          status: financeEntries.status,
          client: clients.fullName,
          createdAt: financeEntries.createdAt,
        })
        .from(financeEntries)
        .leftJoin(clients, eq(financeEntries.clientId, clients.id))
        .where(eq(financeEntries.entryType, "payment"))
        .orderBy(desc(financeEntries.createdAt));
      const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        title: "تقرير الإيرادات",
        columns: ["العنوان", "المبلغ", "الحالة", "العميل", "التاريخ"],
        rows: rows.map((row) => [row.title, Number(row.amount), FINANCE_STATUS_LABELS[row.status], row.client ?? "", formatDateTime(row.createdAt)]),
        summary: [
          { label: "Total Revenues", value: total.toFixed(2) },
          { label: "Records", value: String(rows.length) },
        ],
      };
    }
    case "expenses": {
      const rows = await db
        .select({
          title: financeEntries.title,
          amount: financeEntries.amount,
          status: financeEntries.status,
          client: clients.fullName,
          createdAt: financeEntries.createdAt,
        })
        .from(financeEntries)
        .leftJoin(clients, eq(financeEntries.clientId, clients.id))
        .where(eq(financeEntries.entryType, "expense"))
        .orderBy(desc(financeEntries.createdAt));
      const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
      return {
        title: "تقرير المصروفات",
        columns: ["العنوان", "المبلغ", "الحالة", "العميل", "التاريخ"],
        rows: rows.map((row) => [row.title, Number(row.amount), FINANCE_STATUS_LABELS[row.status], row.client ?? "", formatDateTime(row.createdAt)]),
        summary: [
          { label: "Total Expenses", value: total.toFixed(2) },
          { label: "Records", value: String(rows.length) },
        ],
      };
    }
    case "lawyers": {
      const rows = await getLawyerPerformanceRows();
      return {
        title: "تقرير أداء المحامين",
        columns: ["الاسم", "عدد القضايا", "عدد الجلسات", "عدد المهام"],
        rows: rows.map((row) => [row.fullName, row.casesCount, row.hearingsCount, row.tasksCount]),
        summary: [{ label: "Lawyers", value: String(rows.length) }],
      };
    }
    default:
      return getReportDataset("cases");
  }
}
