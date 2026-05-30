import { redirect } from "next/navigation";

import { loginAction } from "@/app/actions";
import { getSessionContext } from "@/lib/core";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getMessage(error?: string) {
  if (!error) return null;
  if (error === "invalid") return "بيانات الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.";
  if (error === "expired") return "انتهت الجلسة أو ليس لديك صلاحية. سجل الدخول من جديد.";
  return decodeURIComponent(error);
}

function getSuccessMessage(success?: string) {
  if (!success) return null;
  if (success === "logout") return "تم تسجيل الخروج بنجاح.";
  return decodeURIComponent(success);
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSessionContext();
  if (session) {
    redirect("/dashboard?section=overview");
  }

  const params = searchParams ? await searchParams : {};
  const error = typeof params.error === "string" ? getMessage(params.error) : null;
  const success = typeof params.success === "string" ? getSuccessMessage(params.success) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel overflow-hidden p-8 sm:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            LegalPro Elite • منصة عربية متكاملة لإدارة مكاتب المحاماة
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 dark:text-white sm:text-5xl">
            إدارة احترافية للقضايا والعملاء والجلسات والمالية في مكان واحد.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
            تم تصميم النظام بالكامل باللغة العربية مع دعم RTL، صلاحيات تفصيلية، حفظ آمن للجلسات، أرشفة مستندات محمية، تقارير قابلة للتصدير، ولوحة تحكم تنفيذية فاخرة مناسبة لمكاتب المحاماة الحديثة.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["لوحة تنفيذية", "إحصاءات فورية وتنبيهات ذكية"],
              ["أمان وصلاحيات", "تحكم تفصيلي بحسب الدور"],
              ["مستندات محمية", "رفع ومعاينة وتحميل آمن"],
              ["تقارير احترافية", "Excel و PDF ومؤشرات أداء"],
            ].map(([title, desc]) => (
              <div key={title} className="panel-muted p-4">
                <h2 className="font-bold text-slate-900 dark:text-white">{title}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-8 sm:p-10">
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-200">تسجيل الدخول الآمن</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 dark:text-white">مرحبًا بك في LegalPro Elite</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              استخدم بيانات المدير الافتراضية للدخول ثم ابدأ بإدارة المستخدمين والصلاحيات وبقية أقسام المكتب.
            </p>
          </div>

          {error ? <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">{error}</div> : null}
          {success ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">{success}</div> : null}

          <form action={loginAction} className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">البريد الإلكتروني</label>
              <input name="email" type="email" defaultValue="admin@legalpro.local" className="input" placeholder="name@example.com" required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">كلمة المرور</label>
              <input name="password" type="password" defaultValue="Admin@12345" className="input" placeholder="••••••••" required />
            </div>
            <button type="submit" className="btn-primary w-full justify-center">دخول إلى النظام</button>
          </form>

          <div className="mt-6 panel-muted p-4 text-sm text-slate-700 dark:text-slate-200">
            <div className="font-bold">بيانات افتراضية جاهزة للتجربة</div>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
              <li>البريد: admin@legalpro.local</li>
              <li>كلمة المرور: Admin@12345</li>
              <li>يبقى المستخدم مسجلًا بعد تحديث الصفحة حتى الضغط على تسجيل الخروج.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
