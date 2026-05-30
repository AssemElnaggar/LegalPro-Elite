import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  addCaseActionLogAction,
  deleteCaseAction,
  deleteClientAction,
  deleteDocumentAction,
  deleteFinanceAction,
  deleteHearingAction,
  deleteTaskAction,
  deleteUserAction,
  logoutAction,
  updateRolePermissionAction,
  uploadDocumentAction,
  upsertCaseAction,
  upsertClientAction,
  upsertFinanceAction,
  upsertHearingAction,
  upsertTaskAction,
  upsertUserAction,
} from "@/app/actions";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";
export const revalidate = 0;
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
  tasks,
  users,
} from "@/db/schema";
import {
  CASE_STATUS_LABELS,
  FINANCE_STATUS_LABELS,
  FINANCE_TYPE_LABELS,
  HEARING_STATUS_LABELS,
  MODULE_LABELS,
  NAV_ITEMS,
  ROLE_LABELS,
  SECTION_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatMoney,
  getClientBalances,
  getDashboardLookups,
  getLawyerPerformanceRows,
  getOverviewMetrics,
  getReportDataset,
  getRolePermissionRows,
  hasPermission,
  makeDashboardUrl,
  parseSection,
  requireSectionAccess,
  type SectionKey,
} from "@/lib/core";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function toArrayValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveMessage(code?: string | null) {
  if (!code) return null;
  const dictionary: Record<string, string> = {
    welcome: "مرحبًا بك، تم تسجيل الدخول بنجاح.",
    "client-created": "تمت إضافة العميل بنجاح.",
    "client-updated": "تم تحديث بيانات العميل بنجاح.",
    "client-deleted": "تم حذف العميل بنجاح.",
    "case-created": "تمت إضافة القضية بنجاح.",
    "case-updated": "تم تحديث القضية بنجاح.",
    "case-deleted": "تم حذف القضية بنجاح.",
    "case-action-created": "تمت إضافة إجراء جديد إلى سجل القضية.",
    "hearing-created": "تمت إضافة الجلسة بنجاح.",
    "hearing-updated": "تم تحديث بيانات الجلسة بنجاح.",
    "hearing-deleted": "تم حذف الجلسة بنجاح.",
    "task-created": "تمت إضافة المهمة بنجاح.",
    "task-updated": "تم تحديث المهمة بنجاح.",
    "task-deleted": "تم حذف المهمة بنجاح.",
    "document-uploaded": "تم رفع المستند وحمايته داخل النظام.",
    "document-deleted": "تم حذف المستند بنجاح.",
    "finance-created": "تم إنشاء السجل المالي بنجاح.",
    "finance-updated": "تم تحديث السجل المالي بنجاح.",
    "finance-deleted": "تم حذف السجل المالي بنجاح.",
    "user-created": "تم إنشاء المستخدم بنجاح.",
    "user-updated": "تم تحديث بيانات المستخدم بنجاح.",
    "user-deleted": "تم حذف المستخدم بنجاح.",
    "permission-updated": "تم تحديث صلاحيات الدور بنجاح.",
  };

  return dictionary[code] ?? decodeURIComponent(code);
}

function toneClass(tone: "info" | "success" | "warning" | "danger") {
  if (tone === "success") return "badge-success";
  if (tone === "warning") return "badge-warning";
  if (tone === "danger") return "badge-danger";
  return "badge-info";
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span> : null}
    </label>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <article className="stat-card">
      <div className="text-sm font-semibold text-slate-500 dark:text-slate-300">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>
    </article>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel-muted p-6 text-center">
      <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </div>
  );
}

function toDateTimeLocal(value?: Date | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {};
  const section = parseSection(params.section);
  const context = await requireSectionAccess(section);
  const editId = toArrayValue(params.edit) ?? "";
  const success = resolveMessage(typeof params.success === "string" ? params.success : null);
  const error = typeof params.error === "string" ? decodeURIComponent(params.error) : null;
  const alert = typeof params.alert === "string" && params.alert === "forbidden" ? "لا تملك الصلاحية المطلوبة للوصول إلى هذا القسم." : null;

  const { clientRows, userRows, caseRows } = await getDashboardLookups();
  const visibleNav = NAV_ITEMS.filter((item) => hasPermission(context, item.module, "view"));
  const teamMembers = userRows.filter((user) => ["admin", "lawyer", "admin_staff"].includes(user.role));

  let sectionContent: ReactNode = null;

  if (section === "overview") {
    const overview = await getOverviewMetrics();
    const upcoming = await db
      .select({
        id: hearings.id,
        hearingDate: hearings.hearingDate,
        hearingTime: hearings.hearingTime,
        caseName: legalCases.caseName,
        court: hearings.court,
      })
      .from(hearings)
      .innerJoin(legalCases, eq(hearings.caseId, legalCases.id))
      .where(eq(hearings.status, "scheduled"))
      .orderBy(asc(hearings.hearingDate))
      .limit(6);

    const latestFinance = await db
      .select({
        id: financeEntries.id,
        title: financeEntries.title,
        amount: financeEntries.amount,
        type: financeEntries.entryType,
        status: financeEntries.status,
        clientName: clients.fullName,
      })
      .from(financeEntries)
      .leftJoin(clients, eq(financeEntries.clientId, clients.id))
      .orderBy(desc(financeEntries.createdAt))
      .limit(6);

    sectionContent = (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="إجمالي القضايا" value={String(overview.totalCases)} subtitle="عدد القضايا المسجلة في النظام" />
          <StatCard title="الجلسات القادمة" value={String(overview.upcomingHearings)} subtitle="الجلسات المجدولة القادمة" />
          <StatCard title="العملاء" value={String(overview.totalClients)} subtitle="ملفات العملاء النشطة" />
          <StatCard title="الإيرادات" value={formatMoney(overview.revenues)} subtitle="إجمالي الدفعات المسجلة" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">التنبيهات المهمة</h2>
                <p className="section-subtitle">مواعيد قريبة، مهام متأخرة، ومستحقات تحتاج متابعة.</p>
              </div>
              <span className="badge badge-warning">{overview.alerts.length} تنبيه</span>
            </div>
            <div className="mt-5 space-y-3">
              {overview.alerts.length ? (
                overview.alerts.map((item) => (
                  <div key={`${item.title}-${item.detail}`} className="panel-muted p-4">
                    <div className="flex items-center gap-3">
                      <span className={`badge ${toneClass(item.tone)}`}>{item.title}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
                  </div>
                ))
              ) : (
                <EmptyState title="لا توجد تنبيهات حالية" description="كل شيء منظم حاليًا ولا توجد عناصر عاجلة." />
              )}
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">ملخص مالي</h2>
                <p className="section-subtitle">إيرادات ومصروفات وآخر القيود المالية.</p>
              </div>
              <Link href={makeDashboardUrl("finance")} className="btn-secondary">فتح المالية</Link>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="panel-muted p-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">الإيرادات</div>
                <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatMoney(overview.revenues)}</div>
              </div>
              <div className="panel-muted p-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">المصروفات</div>
                <div className="mt-2 text-2xl font-black text-red-700 dark:text-red-300">{formatMoney(overview.expenses)}</div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {latestFinance.map((entry) => (
                <div key={entry.id} className="panel-muted flex items-start justify-between gap-3 p-4">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{entry.title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{entry.clientName ?? "بدون عميل مباشر"}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">{formatMoney(entry.amount)}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{FINANCE_TYPE_LABELS[entry.type]} • {FINANCE_STATUS_LABELS[entry.status]}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">الجلسات القادمة</h2>
                <p className="section-subtitle">مواعيد الجلسات المقبلة مع المحكمة المرتبطة.</p>
              </div>
              <Link href={makeDashboardUrl("hearings")} className="btn-secondary">إدارة الجلسات</Link>
            </div>
            <div className="mt-5 space-y-3">
              {upcoming.length ? (
                upcoming.map((item) => (
                  <div key={item.id} className="panel-muted p-4">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.caseName}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{item.court}</div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.hearingDate)} • {item.hearingTime}</div>
                  </div>
                ))
              ) : (
                <EmptyState title="لا توجد جلسات قريبة" description="أضف جلسة جديدة من قسم الجلسات لتظهر هنا." />
              )}
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">آخر النشاطات</h2>
                <p className="section-subtitle">سجل العمليات الأخيرة التي تمت داخل النظام.</p>
              </div>
              <span className="badge badge-info">مراقبة مستمرة</span>
            </div>
            <div className="mt-5 space-y-3">
              {overview.recentActivities.map((log) => (
                <div key={log.id} className="panel-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{log.description}</div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(log.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {log.userName ?? "النظام"} • {log.action}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (section === "clients") {
    const selectedClient = clientRows.find((item) => item.id === editId) ?? null;
    const caseLinks = await db
      .select({ id: legalCases.id, caseName: legalCases.caseName, clientId: legalCases.clientId, caseNumber: legalCases.caseNumber })
      .from(legalCases)
      .orderBy(desc(legalCases.createdAt));

    sectionContent = (
      <div className="space-y-6">
        {(hasPermission(context, "clients", "create") || (selectedClient && hasPermission(context, "clients", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedClient ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</h2>
                <p className="section-subtitle">حفظ بيانات العميل وربط ملفه بالقضايا ذات الصلة.</p>
              </div>
              {selectedClient ? <Link className="btn-secondary" href={makeDashboardUrl("clients")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertClientAction} className="mt-6 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" defaultValue={selectedClient?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="clients" />
              <Field label="اسم العميل">
                <input name="fullName" className="input" defaultValue={selectedClient?.fullName ?? ""} required />
              </Field>
              <Field label="رقم الهوية / الإقامة">
                <input name="identityNumber" className="input" defaultValue={selectedClient?.identityNumber ?? ""} required />
              </Field>
              <Field label="رقم الجوال">
                <input name="phone" className="input" defaultValue={selectedClient?.phone ?? ""} required />
              </Field>
              <Field label="البريد الإلكتروني">
                <input name="email" type="email" className="input" defaultValue={selectedClient?.email ?? ""} />
              </Field>
              <div className="md:col-span-2">
                <Field label="العنوان">
                  <textarea name="address" className="textarea" defaultValue={selectedClient?.address ?? ""} required />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="ملاحظات">
                  <textarea name="notes" className="textarea" defaultValue={selectedClient?.notes ?? ""} />
                </Field>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button type="submit" className="btn-primary">{selectedClient ? "حفظ التعديلات" : "إضافة العميل"}</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">قائمة العملاء</h2>
              <p className="section-subtitle">عرض بيانات العملاء والملفات المرتبطة بهم.</p>
            </div>
            <span className="badge badge-info">{clientRows.length} عميل</span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>الهوية</th>
                  <th>الجوال</th>
                  <th>البريد</th>
                  <th>القضايا المرتبطة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {clientRows.map((client) => {
                  const linkedCases = caseLinks.filter((item) => item.clientId === client.id);
                  return (
                    <tr key={client.id}>
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-white">{client.fullName}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{client.address}</div>
                      </td>
                      <td>{client.identityNumber}</td>
                      <td>{client.phone}</td>
                      <td>{client.email ?? "—"}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {linkedCases.length ? linkedCases.map((item) => <span key={item.id} className="badge badge-info">{item.caseNumber}</span>) : <span className="text-xs text-slate-400">لا توجد قضايا</span>}
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {hasPermission(context, "clients", "edit") ? <Link href={makeDashboardUrl("clients", { edit: client.id })} className="btn-secondary">تعديل</Link> : null}
                          {hasPermission(context, "clients", "delete") ? (
                            <form action={deleteClientAction}>
                              <input type="hidden" name="id" value={client.id} />
                              <input type="hidden" name="redirectSection" value="clients" />
                              <button className="btn-danger" type="submit">حذف</button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (section === "cases") {
    const caseRecords = await db
      .select({
        id: legalCases.id,
        caseNumber: legalCases.caseNumber,
        caseName: legalCases.caseName,
        caseType: legalCases.caseType,
        court: legalCases.court,
        circuit: legalCases.circuit,
        status: legalCases.status,
        startDate: legalCases.startDate,
        clientId: legalCases.clientId,
        clientName: clients.fullName,
        lawyerId: legalCases.lawyerId,
        lawyerName: users.fullName,
        opponent: legalCases.opponent,
        details: legalCases.details,
      })
      .from(legalCases)
      .innerJoin(clients, eq(legalCases.clientId, clients.id))
      .leftJoin(users, eq(legalCases.lawyerId, users.id))
      .orderBy(desc(legalCases.createdAt));

    const selectedCase = caseRecords.find((item) => item.id === editId) ?? null;
    const focusedCaseId = selectedCase?.id ?? caseRecords[0]?.id ?? "";
    const actionRows = focusedCaseId
      ? await db
          .select({
            id: caseActions.id,
            actionTitle: caseActions.actionTitle,
            details: caseActions.details,
            actionDate: caseActions.actionDate,
            createdByName: users.fullName,
          })
          .from(caseActions)
          .leftJoin(users, eq(caseActions.createdBy, users.id))
          .where(eq(caseActions.caseId, focusedCaseId))
          .orderBy(desc(caseActions.actionDate))
      : [];

    const relatedHearings = focusedCaseId
      ? await db
          .select({ id: hearings.id, hearingDate: hearings.hearingDate, hearingTime: hearings.hearingTime, status: hearings.status })
          .from(hearings)
          .where(eq(hearings.caseId, focusedCaseId))
          .orderBy(desc(hearings.hearingDate))
      : [];

    const relatedDocuments = focusedCaseId
      ? await db
          .select({ id: documents.id, originalName: documents.originalName, category: documents.category, createdAt: documents.createdAt })
          .from(documents)
          .where(eq(documents.caseId, focusedCaseId))
          .orderBy(desc(documents.createdAt))
      : [];

    sectionContent = (
      <div className="space-y-6">
        {(hasPermission(context, "cases", "create") || (selectedCase && hasPermission(context, "cases", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedCase ? "تعديل القضية" : "إضافة قضية جديدة"}</h2>
                <p className="section-subtitle">أدخل تفاصيل القضية والخصم والمحامي المسؤول والعميل المرتبط.</p>
              </div>
              {selectedCase ? <Link className="btn-secondary" href={makeDashboardUrl("cases")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertCaseAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="id" defaultValue={selectedCase?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="cases" />
              <Field label="رقم القضية"><input name="caseNumber" className="input" defaultValue={selectedCase?.caseNumber ?? ""} required /></Field>
              <Field label="اسم القضية"><input name="caseName" className="input" defaultValue={selectedCase?.caseName ?? ""} required /></Field>
              <Field label="نوع القضية"><input name="caseType" className="input" defaultValue={selectedCase?.caseType ?? ""} required /></Field>
              <Field label="المحكمة"><input name="court" className="input" defaultValue={selectedCase?.court ?? ""} required /></Field>
              <Field label="الدائرة"><input name="circuit" className="input" defaultValue={selectedCase?.circuit ?? ""} required /></Field>
              <Field label="حالة القضية">
                <select name="status" className="select" defaultValue={selectedCase?.status ?? "active"}>
                  {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="تاريخ بداية القضية"><input name="startDate" type="date" className="input" defaultValue={selectedCase?.startDate ?? ""} required /></Field>
              <Field label="العميل المرتبط">
                <select name="clientId" className="select" defaultValue={selectedCase?.clientId ?? ""} required>
                  <option value="">اختر العميل</option>
                  {clientRows.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
                </select>
              </Field>
              <Field label="المحامي المسؤول">
                <select name="lawyerId" className="select" defaultValue={selectedCase?.lawyerId ?? ""}>
                  <option value="">بدون تعيين</option>
                  {teamMembers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
                </select>
              </Field>
              <div className="xl:col-span-3">
                <Field label="الخصم"><input name="opponent" className="input" defaultValue={selectedCase?.opponent ?? ""} /></Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="تفاصيل القضية">
                  <textarea name="details" className="textarea" defaultValue={selectedCase?.details ?? ""} />
                </Field>
              </div>
              <div className="xl:col-span-3 flex flex-wrap gap-3">
                <button type="submit" className="btn-primary">{selectedCase ? "حفظ التعديلات" : "إضافة القضية"}</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">سجل القضايا</h2>
              <p className="section-subtitle">جميع القضايا مع العميل والمحامي والحالة.</p>
            </div>
            <span className="badge badge-info">{caseRecords.length} قضية</span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>رقم القضية</th>
                  <th>الاسم</th>
                  <th>العميل</th>
                  <th>المحكمة</th>
                  <th>الحالة</th>
                  <th>المحامي</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {caseRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.caseNumber}</td>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white">{record.caseName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{record.caseType} • {record.circuit}</div>
                    </td>
                    <td>{record.clientName}</td>
                    <td>{record.court}</td>
                    <td><span className="badge badge-warning">{CASE_STATUS_LABELS[record.status]}</span></td>
                    <td>{record.lawyerName ?? "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission(context, "cases", "edit") ? <Link href={makeDashboardUrl("cases", { edit: record.id })} className="btn-secondary">تعديل</Link> : null}
                        {hasPermission(context, "cases", "delete") ? (
                          <form action={deleteCaseAction}>
                            <input type="hidden" name="id" value={record.id} />
                            <input type="hidden" name="redirectSection" value="cases" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {focusedCaseId ? (
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="section-title">سجل الإجراءات</h2>
                  <p className="section-subtitle">إضافة ومراجعة تسلسل الإجراءات على القضية المحددة.</p>
                </div>
                <span className="badge badge-info">القضية المركزة</span>
              </div>
              {hasPermission(context, "cases", "edit") ? (
                <form action={addCaseActionLogAction} className="mt-5 space-y-4">
                  <input type="hidden" name="redirectSection" value="cases" />
                  <input type="hidden" name="caseId" value={focusedCaseId} />
                  <Field label="عنوان الإجراء"><input name="actionTitle" className="input" required /></Field>
                  <Field label="تاريخ الإجراء"><input name="actionDate" type="date" className="input" required /></Field>
                  <Field label="التفاصيل"><textarea name="details" className="textarea" /></Field>
                  <button className="btn-primary" type="submit">إضافة إلى السجل</button>
                </form>
              ) : null}
              <div className="mt-5 space-y-3">
                {actionRows.length ? actionRows.map((item) => (
                  <div key={item.id} className="panel-muted p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{item.actionTitle}</div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.actionDate)}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.details || "بدون تفاصيل إضافية"}</p>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">بواسطة: {item.createdByName ?? "غير محدد"}</div>
                  </div>
                )) : <EmptyState title="لا يوجد سجل إجراءات" description="أضف أول إجراء للقضية الحالية." />}
              </div>
            </section>

            <section className="space-y-6">
              <div className="panel p-6">
                <h2 className="section-title">الجلسات المرتبطة</h2>
                <div className="mt-4 space-y-3">
                  {relatedHearings.length ? relatedHearings.map((item) => (
                    <div key={item.id} className="panel-muted p-4">
                      <div className="font-semibold text-slate-900 dark:text-white">{formatDate(item.hearingDate)} • {item.hearingTime}</div>
                      <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">{HEARING_STATUS_LABELS[item.status]}</div>
                    </div>
                  )) : <EmptyState title="لا توجد جلسات مرتبطة" description="أضف جلسات للقضية من قسم الجلسات." />}
                </div>
              </div>
              <div className="panel p-6">
                <h2 className="section-title">مستندات القضية</h2>
                <div className="mt-4 space-y-3">
                  {relatedDocuments.length ? relatedDocuments.map((doc) => (
                    <div key={doc.id} className="panel-muted flex items-center justify-between gap-3 p-4">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{doc.originalName}</div>
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{doc.category} • {formatDateTime(doc.createdAt)}</div>
                      </div>
                      <a className="btn-secondary" href={`/api/documents/${doc.id}`} target="_blank">معاينة</a>
                    </div>
                  )) : <EmptyState title="لا توجد مستندات مرتبطة" description="ارفع مستندات القضية من قسم المستندات." />}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  }

  if (section === "hearings") {
    const hearingRows = await db
      .select({
        id: hearings.id,
        hearingDate: hearings.hearingDate,
        hearingTime: hearings.hearingTime,
        court: hearings.court,
        hall: hearings.hall,
        caseId: hearings.caseId,
        caseName: legalCases.caseName,
        lawyerId: hearings.lawyerId,
        lawyerName: users.fullName,
        result: hearings.result,
        notes: hearings.notes,
        reminderMinutes: hearings.reminderMinutes,
        status: hearings.status,
      })
      .from(hearings)
      .innerJoin(legalCases, eq(hearings.caseId, legalCases.id))
      .leftJoin(users, eq(hearings.lawyerId, users.id))
      .orderBy(asc(hearings.hearingDate));

    const selectedHearing = hearingRows.find((item) => item.id === editId) ?? null;

    sectionContent = (
      <div className="space-y-6">
        {(hasPermission(context, "hearings", "create") || (selectedHearing && hasPermission(context, "hearings", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedHearing ? "تعديل جلسة" : "إضافة جلسة جديدة"}</h2>
                <p className="section-subtitle">حدد التاريخ والوقت والقاعة والتنبيه والمحامي المسؤول.</p>
              </div>
              {selectedHearing ? <Link className="btn-secondary" href={makeDashboardUrl("hearings")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertHearingAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="id" defaultValue={selectedHearing?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="hearings" />
              <Field label="تاريخ الجلسة"><input name="hearingDate" type="date" className="input" defaultValue={selectedHearing?.hearingDate ?? ""} required /></Field>
              <Field label="وقت الجلسة"><input name="hearingTime" type="time" className="input" defaultValue={selectedHearing?.hearingTime ?? ""} required /></Field>
              <Field label="المحكمة"><input name="court" className="input" defaultValue={selectedHearing?.court ?? ""} required /></Field>
              <Field label="القاعة"><input name="hall" className="input" defaultValue={selectedHearing?.hall ?? ""} /></Field>
              <Field label="القضية المرتبطة">
                <select name="caseId" className="select" defaultValue={selectedHearing?.caseId ?? ""} required>
                  <option value="">اختر القضية</option>
                  {caseRows.map((record) => <option key={record.id} value={record.id}>{record.caseNumber} — {record.caseName}</option>)}
                </select>
              </Field>
              <Field label="المحامي المسؤول">
                <select name="lawyerId" className="select" defaultValue={selectedHearing?.lawyerId ?? ""}>
                  <option value="">بدون تعيين</option>
                  {teamMembers.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
                </select>
              </Field>
              <Field label="تنبيه قبل الجلسة بالدقائق"><input name="reminderMinutes" type="number" className="input" defaultValue={selectedHearing?.reminderMinutes ?? 60} min={0} /></Field>
              <Field label="حالة الجلسة">
                <select name="status" className="select" defaultValue={selectedHearing?.status ?? "scheduled"}>
                  {Object.entries(HEARING_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <div className="xl:col-span-3">
                <Field label="نتيجة الجلسة"><textarea name="result" className="textarea" defaultValue={selectedHearing?.result ?? ""} /></Field>
              </div>
              <div className="xl:col-span-3">
                <Field label="ملاحظات"><textarea name="notes" className="textarea" defaultValue={selectedHearing?.notes ?? ""} /></Field>
              </div>
              <div className="xl:col-span-3 flex flex-wrap gap-3"><button className="btn-primary" type="submit">{selectedHearing ? "حفظ التعديلات" : "إضافة الجلسة"}</button></div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">جدول الجلسات</h2>
              <p className="section-subtitle">المواعيد الحالية مع النتائج والتنبيهات والحالات.</p>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الوقت</th>
                  <th>القضية</th>
                  <th>المحكمة / القاعة</th>
                  <th>المحامي</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {hearingRows.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.hearingDate)}</td>
                    <td>{item.hearingTime}</td>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white">{item.caseName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">تنبيه قبل {item.reminderMinutes} دقيقة</div>
                    </td>
                    <td>{item.court} / {item.hall || "—"}</td>
                    <td>{item.lawyerName ?? "—"}</td>
                    <td><span className="badge badge-warning">{HEARING_STATUS_LABELS[item.status]}</span></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission(context, "hearings", "edit") ? <Link href={makeDashboardUrl("hearings", { edit: item.id })} className="btn-secondary">تعديل</Link> : null}
                        {hasPermission(context, "hearings", "delete") ? (
                          <form action={deleteHearingAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="redirectSection" value="hearings" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (section === "tasks") {
    const taskRows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        assigneeId: tasks.assigneeId,
        assigneeName: users.fullName,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        status: tasks.status,
        alertBeforeMinutes: tasks.alertBeforeMinutes,
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .orderBy(asc(tasks.dueDate));

    const selectedTask = taskRows.find((item) => item.id === editId) ?? null;

    sectionContent = (
      <div className="space-y-6">
        {(hasPermission(context, "tasks", "create") || (selectedTask && hasPermission(context, "tasks", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedTask ? "تعديل مهمة" : "إضافة مهمة جديدة"}</h2>
                <p className="section-subtitle">حدد المسؤول والأولوية والتنبيهات وحالة التنفيذ.</p>
              </div>
              {selectedTask ? <Link className="btn-secondary" href={makeDashboardUrl("tasks")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertTaskAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="id" defaultValue={selectedTask?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="tasks" />
              <Field label="عنوان المهمة"><input name="title" className="input" defaultValue={selectedTask?.title ?? ""} required /></Field>
              <Field label="الموظف المسؤول">
                <select name="assigneeId" className="select" defaultValue={selectedTask?.assigneeId ?? ""}>
                  <option value="">بدون تعيين</option>
                  {userRows.map((user) => <option key={user.id} value={user.id}>{user.fullName}</option>)}
                </select>
              </Field>
              <Field label="الأولوية">
                <select name="priority" className="select" defaultValue={selectedTask?.priority ?? "medium"}>
                  {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="تاريخ الاستحقاق"><input name="dueDate" type="datetime-local" className="input" defaultValue={toDateTimeLocal(selectedTask?.dueDate)} required /></Field>
              <Field label="الحالة">
                <select name="status" className="select" defaultValue={selectedTask?.status ?? "pending"}>
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="تنبيه قبل الاستحقاق بالدقائق"><input name="alertBeforeMinutes" type="number" className="input" defaultValue={selectedTask?.alertBeforeMinutes ?? 120} min={0} /></Field>
              <div className="xl:col-span-3">
                <Field label="الوصف"><textarea name="description" className="textarea" defaultValue={selectedTask?.description ?? ""} /></Field>
              </div>
              <div className="xl:col-span-3 flex flex-wrap gap-3"><button className="btn-primary" type="submit">{selectedTask ? "حفظ التعديلات" : "إضافة المهمة"}</button></div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <h2 className="section-title">قائمة المهام</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>المسؤول</th>
                  <th>الأولوية</th>
                  <th>الاستحقاق</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description || "بدون وصف"}</div>
                    </td>
                    <td>{item.assigneeName ?? "—"}</td>
                    <td><span className="badge badge-warning">{TASK_PRIORITY_LABELS[item.priority]}</span></td>
                    <td>{formatDateTime(item.dueDate)}</td>
                    <td><span className="badge badge-info">{TASK_STATUS_LABELS[item.status]}</span></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission(context, "tasks", "edit") ? <Link href={makeDashboardUrl("tasks", { edit: item.id })} className="btn-secondary">تعديل</Link> : null}
                        {hasPermission(context, "tasks", "delete") ? (
                          <form action={deleteTaskAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="redirectSection" value="tasks" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (section === "documents") {
    const documentRows = await db
      .select({
        id: documents.id,
        originalName: documents.originalName,
        category: documents.category,
        mimeType: documents.mimeType,
        size: documents.size,
        createdAt: documents.createdAt,
        clientName: clients.fullName,
        caseName: legalCases.caseName,
        uploaderName: users.fullName,
      })
      .from(documents)
      .leftJoin(clients, eq(documents.clientId, clients.id))
      .leftJoin(legalCases, eq(documents.caseId, legalCases.id))
      .leftJoin(users, eq(documents.uploadedBy, users.id))
      .orderBy(desc(documents.createdAt));

    sectionContent = (
      <div className="space-y-6">
        {hasPermission(context, "documents", "create") ? (
          <section className="panel p-6">
            <div>
              <h2 className="section-title">رفع مستند محمي</h2>
              <p className="section-subtitle">يدعم PDF والصور و Word مع ربطه بعميل أو قضية وإبقائه خارج الوصول العام.</p>
            </div>
            <form action={uploadDocumentAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="redirectSection" value="documents" />
              <Field label="الملف"><input name="file" type="file" className="input" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" required /></Field>
              <Field label="تصنيف المستند"><input name="category" className="input" placeholder="مثال: عقد، وكالة، لائحة" required /></Field>
              <Field label="العميل المرتبط">
                <select name="clientId" className="select" defaultValue="">
                  <option value="">بدون عميل</option>
                  {clientRows.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}
                </select>
              </Field>
              <Field label="القضية المرتبطة" hint="يمكن الربط بالعميل أو بالقضية أو بهما معًا">
                <select name="caseId" className="select" defaultValue="">
                  <option value="">بدون قضية</option>
                  {caseRows.map((record) => <option key={record.id} value={record.id}>{record.caseNumber} — {record.caseName}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 xl:col-span-3 flex flex-wrap gap-3">
                <button className="btn-primary" type="submit">رفع المستند</button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">أرشيف المستندات</h2>
              <p className="section-subtitle">عرض، معاينة، تحميل، أو حذف المستندات حسب الصلاحية.</p>
            </div>
            <span className="badge badge-info">{documentRows.length} مستند</span>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>التصنيف</th>
                  <th>العميل / القضية</th>
                  <th>الرافع</th>
                  <th>الحجم</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {documentRows.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white">{doc.originalName}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{doc.mimeType} • {formatDateTime(doc.createdAt)}</div>
                    </td>
                    <td>{doc.category}</td>
                    <td>{doc.clientName ?? "—"} / {doc.caseName ?? "—"}</td>
                    <td>{doc.uploaderName ?? "—"}</td>
                    <td>{(doc.size / 1024).toFixed(1)} KB</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <a href={`/api/documents/${doc.id}`} target="_blank" className="btn-secondary">معاينة</a>
                        <a href={`/api/documents/${doc.id}?download=1`} className="btn-secondary">تحميل</a>
                        {hasPermission(context, "documents", "delete") ? (
                          <form action={deleteDocumentAction}>
                            <input type="hidden" name="id" value={doc.id} />
                            <input type="hidden" name="redirectSection" value="documents" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (section === "finance") {
    const financeRows = await db
      .select({
        id: financeEntries.id,
        entryType: financeEntries.entryType,
        title: financeEntries.title,
        amount: financeEntries.amount,
        status: financeEntries.status,
        dueDate: financeEntries.dueDate,
        notes: financeEntries.notes,
        approved: financeEntries.approved,
        clientId: financeEntries.clientId,
        clientName: clients.fullName,
        caseId: financeEntries.caseId,
        caseName: legalCases.caseName,
      })
      .from(financeEntries)
      .leftJoin(clients, eq(financeEntries.clientId, clients.id))
      .leftJoin(legalCases, eq(financeEntries.caseId, legalCases.id))
      .orderBy(desc(financeEntries.createdAt));

    const selectedFinance = financeRows.find((item) => item.id === editId) ?? null;
    const totals = financeRows.reduce(
      (acc, item) => {
        const amount = Number(item.amount);
        if (item.entryType === "invoice") acc.invoices += amount;
        if (item.entryType === "payment") acc.payments += amount;
        if (item.entryType === "expense") acc.expenses += amount;
        return acc;
      },
      { invoices: 0, payments: 0, expenses: 0 },
    );
    const balances = await getClientBalances();

    sectionContent = (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="أتعاب وفواتير" value={formatMoney(totals.invoices)} subtitle="إجمالي الفواتير المسجلة" />
          <StatCard title="الدفعات / الإيرادات" value={formatMoney(totals.payments)} subtitle="إجمالي التحصيلات" />
          <StatCard title="المصروفات" value={formatMoney(totals.expenses)} subtitle="إجمالي المصروفات" />
        </div>

        {(hasPermission(context, "finance", "create") || (selectedFinance && hasPermission(context, "finance", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedFinance ? "تعديل سجل مالي" : "إضافة سجل مالي"}</h2>
                <p className="section-subtitle">إدارة الأتعاب والدفعات والمصروفات مع حالة السداد والاعتماد.</p>
              </div>
              {selectedFinance ? <Link className="btn-secondary" href={makeDashboardUrl("finance")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertFinanceAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="id" defaultValue={selectedFinance?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="finance" />
              <Field label="نوع السجل">
                <select name="entryType" className="select" defaultValue={selectedFinance?.entryType ?? "invoice"}>
                  {Object.entries(FINANCE_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label="العنوان"><input name="title" className="input" defaultValue={selectedFinance?.title ?? ""} required /></Field>
              <Field label="المبلغ"><input name="amount" type="number" step="0.01" min="0" className="input" defaultValue={selectedFinance ? Number(selectedFinance.amount) : ""} required /></Field>
              <Field label="العميل"><select name="clientId" className="select" defaultValue={selectedFinance?.clientId ?? ""}><option value="">بدون عميل</option>{clientRows.map((client) => <option key={client.id} value={client.id}>{client.fullName}</option>)}</select></Field>
              <Field label="القضية"><select name="caseId" className="select" defaultValue={selectedFinance?.caseId ?? ""}><option value="">بدون قضية</option>{caseRows.map((record) => <option key={record.id} value={record.id}>{record.caseNumber} — {record.caseName}</option>)}</select></Field>
              <Field label="حالة السداد"><select name="status" className="select" defaultValue={selectedFinance?.status ?? "pending"}>{Object.entries(FINANCE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="تاريخ الاستحقاق"><input name="dueDate" type="date" className="input" defaultValue={selectedFinance?.dueDate ?? ""} /></Field>
              <Field label="اعتماد السجل" hint="يتطلب صلاحية اعتماد"><input name="approved" type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked={selectedFinance?.approved ?? false} /></Field>
              <div className="xl:col-span-3"><Field label="ملاحظات"><textarea name="notes" className="textarea" defaultValue={selectedFinance?.notes ?? ""} /></Field></div>
              <div className="xl:col-span-3 flex flex-wrap gap-3"><button className="btn-primary" type="submit">{selectedFinance ? "حفظ التعديلات" : "إضافة السجل المالي"}</button></div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <h2 className="section-title">القيود المالية</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>العنوان</th>
                  <th>النوع</th>
                  <th>العميل / القضية</th>
                  <th>المبلغ</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {financeRows.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">الاستحقاق: {formatDate(item.dueDate)}</div>
                    </td>
                    <td>{FINANCE_TYPE_LABELS[item.entryType]}</td>
                    <td>{item.clientName ?? "—"} / {item.caseName ?? "—"}</td>
                    <td>{formatMoney(item.amount)}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <span className="badge badge-info">{FINANCE_STATUS_LABELS[item.status]}</span>
                        {item.approved ? <span className="badge badge-success">معتمد</span> : null}
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission(context, "finance", "edit") ? <Link href={makeDashboardUrl("finance", { edit: item.id })} className="btn-secondary">تعديل</Link> : null}
                        {hasPermission(context, "finance", "delete") ? (
                          <form action={deleteFinanceAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="redirectSection" value="finance" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">رصيد كل عميل</h2>
              <p className="section-subtitle">الفواتير مقابل الدفعات لمعرفة المديونية أو الرصيد.</p>
            </div>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell min-w-[620px]">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>الفواتير</th>
                  <th>الدفعات</th>
                  <th>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{formatMoney(item.invoices)}</td>
                    <td>{formatMoney(item.payments)}</td>
                    <td><span className={item.balance > 0 ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}>{formatMoney(item.balance)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (section === "users") {
    const userList = await db.select().from(users).orderBy(asc(users.fullName));
    const selectedUser = userList.find((item) => item.id === editId) ?? null;
    const permissionRows = await getRolePermissionRows();

    sectionContent = (
      <div className="space-y-6">
        {(hasPermission(context, "users", "create") || (selectedUser && hasPermission(context, "users", "edit"))) ? (
          <section className="panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="section-title">{selectedUser ? "تعديل مستخدم" : "إضافة مستخدم جديد"}</h2>
                <p className="section-subtitle">إنشاء مستخدمين بالأدوار المختلفة مع بقاء الجلسة حتى تسجيل الخروج.</p>
              </div>
              {selectedUser ? <Link className="btn-secondary" href={makeDashboardUrl("users")}>إلغاء التعديل</Link> : null}
            </div>
            <form action={upsertUserAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <input type="hidden" name="id" defaultValue={selectedUser?.id ?? ""} />
              <input type="hidden" name="redirectSection" value="users" />
              <Field label="الاسم الكامل"><input name="fullName" className="input" defaultValue={selectedUser?.fullName ?? ""} required /></Field>
              <Field label="البريد الإلكتروني"><input name="email" type="email" className="input" defaultValue={selectedUser?.email ?? ""} required /></Field>
              <Field label="رقم الجوال"><input name="phone" className="input" defaultValue={selectedUser?.phone ?? ""} required /></Field>
              <Field label="الدور">
                <select name="role" className="select" defaultValue={selectedUser?.role ?? "limited"}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
              <Field label={selectedUser ? "كلمة المرور الجديدة (اختياري)" : "كلمة المرور"}><input name="password" type="password" className="input" required={!selectedUser} /></Field>
              <Field label="الحساب نشط"><input name="active" type="checkbox" className="h-5 w-5 rounded border-slate-300" defaultChecked={selectedUser?.active ?? true} /></Field>
              <div className="xl:col-span-3 flex flex-wrap gap-3"><button className="btn-primary" type="submit">{selectedUser ? "حفظ التعديلات" : "إضافة المستخدم"}</button></div>
            </form>
          </section>
        ) : null}

        <section className="panel overflow-hidden p-6">
          <h2 className="section-title">المستخدمون</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الجوال</th>
                  <th>الدور</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {userList.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{item.email}</td>
                    <td>{item.phone}</td>
                    <td>{ROLE_LABELS[item.role]}</td>
                    <td>{item.active ? <span className="badge badge-success">نشط</span> : <span className="badge badge-danger">موقوف</span>}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {hasPermission(context, "users", "edit") ? <Link href={makeDashboardUrl("users", { edit: item.id })} className="btn-secondary">تعديل</Link> : null}
                        {hasPermission(context, "users", "delete") && item.id !== context.user.id ? (
                          <form action={deleteUserAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="redirectSection" value="users" />
                            <button className="btn-danger" type="submit">حذف</button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {hasPermission(context, "users", "approve") ? (
          <section className="panel p-6">
            <div>
              <h2 className="section-title">مصفوفة الصلاحيات التفصيلية</h2>
              <p className="section-subtitle">تحكم في العرض والإضافة والتعديل والحذف والطباعة والتصدير والاعتماد لكل دور.</p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="table-shell min-w-[980px]">
                <thead>
                  <tr>
                    <th>الدور</th>
                    <th>الوحدة</th>
                    <th>عرض</th>
                    <th>إضافة</th>
                    <th>تعديل</th>
                    <th>حذف</th>
                    <th>طباعة</th>
                    <th>تصدير</th>
                    <th>اعتماد</th>
                    <th>حفظ</th>
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((item) => (
                    <tr key={item.id}>
                      <td>{ROLE_LABELS[item.role]}</td>
                      <td>{MODULE_LABELS[item.module as keyof typeof MODULE_LABELS] ?? item.module}</td>
                      <td colSpan={8} className="!p-0">
                        <form action={updateRolePermissionAction} className="grid grid-cols-8 gap-2 p-3">
                          <input type="hidden" name="redirectSection" value="users" />
                          <input type="hidden" name="role" value={item.role} />
                          <input type="hidden" name="module" value={item.module} />
                          <label className="flex items-center justify-center"><input name="canView" type="checkbox" defaultChecked={item.canView} /></label>
                          <label className="flex items-center justify-center"><input name="canCreate" type="checkbox" defaultChecked={item.canCreate} /></label>
                          <label className="flex items-center justify-center"><input name="canEdit" type="checkbox" defaultChecked={item.canEdit} /></label>
                          <label className="flex items-center justify-center"><input name="canDelete" type="checkbox" defaultChecked={item.canDelete} /></label>
                          <label className="flex items-center justify-center"><input name="canPrint" type="checkbox" defaultChecked={item.canPrint} /></label>
                          <label className="flex items-center justify-center"><input name="canExport" type="checkbox" defaultChecked={item.canExport} /></label>
                          <label className="flex items-center justify-center"><input name="canApprove" type="checkbox" defaultChecked={item.canApprove} /></label>
                          <button className="btn-secondary justify-center" type="submit">حفظ</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  if (section === "reports") {
    const overview = await getOverviewMetrics();
    const balances = await getClientBalances();
    const performance = await getLawyerPerformanceRows();
    const reportCards = [
      ["clients", "تقرير العملاء"],
      ["cases", "تقرير القضايا"],
      ["hearings", "تقرير الجلسات"],
      ["revenues", "تقرير الإيرادات"],
      ["expenses", "تقرير المصروفات"],
      ["lawyers", "تقرير أداء المحامين"],
    ] as const;
    const reportParam = toArrayValue(params.report);
    const selectedReport = reportCards.some(([key]) => key === reportParam) ? reportParam! : "cases";
    const previewDataset = await getReportDataset(selectedReport);

    sectionContent = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportCards.map(([key, label]) => {
            const active = selectedReport === key;
            return (
              <article key={key} className={`panel p-6 ${active ? "ring-2 ring-amber-400/60" : ""}`}>
                <h2 className="section-title">{label}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">عرض مباشر داخل الصفحة مع إمكانية التصدير إلى Excel وPDF.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link href={makeDashboardUrl("reports", { report: key })} className="btn-secondary">
                    {active ? "التقرير الحالي" : "عرض التقرير"}
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {hasPermission(context, "reports", "print") ? (
                    <Link href={`/reports/print?type=${key}`} target="_blank" className="btn-primary">
                      عرض وتصدير PDF
                    </Link>
                  ) : null}
                  {hasPermission(context, "reports", "export") ? (
                    <a href={`/api/reports/${key}?format=xlsx`} className="btn-secondary">
                      تنزيل Excel
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <section className="panel p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="section-title">معاينة التقرير المحدد: {previewDataset.title}</h2>
              <p className="section-subtitle">يمكنك الآن استعراض البيانات داخل النظام مباشرة ثم تصديرها عند الحاجة.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {hasPermission(context, "reports", "print") ? (
                <Link href={`/reports/print?type=${selectedReport}`} target="_blank" className="btn-primary">
                  فتح PDF وتنزيله
                </Link>
              ) : null}
              {hasPermission(context, "reports", "export") ? (
                <a href={`/api/reports/${selectedReport}?format=xlsx`} className="btn-secondary">
                  تنزيل Excel
                </a>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {previewDataset.summary.map((item) => (
              <div key={`${previewDataset.title}-${item.label}`} className="panel-muted p-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">{item.label}</div>
                <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{item.value}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="table-shell min-w-[860px]">
              <thead>
                <tr>
                  {previewDataset.columns.map((column) => (
                    <th key={`${selectedReport}-${column}`}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewDataset.rows.length ? (
                  previewDataset.rows.map((row, index) => (
                    <tr key={`${selectedReport}-row-${index}`}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${selectedReport}-cell-${index}-${cellIndex}`}>{String(cell)}</td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={previewDataset.columns.length} className="text-center !py-8 text-slate-500 dark:text-slate-400">
                      لا توجد بيانات متاحة لهذا التقرير حاليًا.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="panel p-6">
            <h2 className="section-title">مؤشرات مالية</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="panel-muted p-4"><div className="text-sm text-slate-500 dark:text-slate-400">الإيرادات</div><div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{formatMoney(overview.revenues)}</div></div>
              <div className="panel-muted p-4"><div className="text-sm text-slate-500 dark:text-slate-400">المصروفات</div><div className="mt-2 text-2xl font-black text-red-700 dark:text-red-300">{formatMoney(overview.expenses)}</div></div>
              <div className="panel-muted p-4"><div className="text-sm text-slate-500 dark:text-slate-400">صافي الربح</div><div className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{formatMoney(overview.revenues - overview.expenses)}</div></div>
            </div>
          </section>
          <section className="panel p-6">
            <h2 className="section-title">أداء المحامين</h2>
            <div className="mt-5 space-y-3">
              {performance.map((row) => (
                <div key={row.id} className="panel-muted grid gap-3 p-4 sm:grid-cols-4">
                  <div className="font-semibold text-slate-900 dark:text-white">{row.fullName}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">القضايا: {row.casesCount}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">الجلسات: {row.hearingsCount}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">المهام: {row.tasksCount}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="panel p-6">
          <h2 className="section-title">ملخص أرصدة العملاء</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="table-shell min-w-[620px]">
              <thead><tr><th>العميل</th><th>إجمالي الفواتير</th><th>إجمالي الدفعات</th><th>الرصيد</th></tr></thead>
              <tbody>
                {balances.map((item) => (
                  <tr key={item.id}>
                    <td>{item.fullName}</td>
                    <td>{formatMoney(item.invoices)}</td>
                    <td>{formatMoney(item.payments)}</td>
                    <td>{formatMoney(item.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 lg:px-8">
      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="panel h-fit p-5 xl:sticky xl:top-4">
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-amber-800 p-5 text-white shadow-xl shadow-slate-900/20">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">LegalPro Elite</div>
            <h1 className="mt-3 text-2xl font-black">إدارة قانونية بمعيار تنفيذي</h1>
            <p className="mt-2 text-sm leading-7 text-slate-200">{context.user.fullName}</p>
            <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-amber-100">{ROLE_LABELS[context.user.role]}</span>
          </div>

          <div className="mt-5 space-y-2">
            {visibleNav.map((item) => {
              const active = item.key === section;
              return (
                <Link key={item.key} href={makeDashboardUrl(item.key)} className={`nav-link ${active ? "nav-link-active" : ""}`}>
                  <span>
                    <span className="block font-bold">{item.label}</span>
                    <span className="mt-1 block text-xs opacity-80">{item.hint}</span>
                  </span>
                  <span className="text-xs">←</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ThemeToggle />
            <form action={logoutAction} className="flex-1">
              <button type="submit" className="btn-danger w-full justify-center">تسجيل الخروج</button>
            </form>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="panel p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-amber-700 dark:text-amber-200">النظام القانوني المتكامل</p>
                <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white">{SECTION_LABELS[section]}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">واجهة عربية حديثة، متجاوبة، ومحمية بالصلاحيات لتمكين المكتب من إدارة عملياته القانونية والمالية بكفاءة عالية.</p>
              </div>
              <div className="panel-muted flex flex-wrap gap-3 p-4 text-sm text-slate-600 dark:text-slate-300">
                <div>المستخدم الحالي: <span className="font-bold text-slate-900 dark:text-white">{context.user.fullName}</span></div>
                <div>الدور: <span className="font-bold text-slate-900 dark:text-white">{ROLE_LABELS[context.user.role]}</span></div>
              </div>
            </div>
          </section>

          {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{success}</div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">{error}</div> : null}
          {alert ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">{alert}</div> : null}

          {sectionContent}
        </div>
      </div>
    </main>
  );
}
