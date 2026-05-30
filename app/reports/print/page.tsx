"use client";

import { useEffect, useState } from "react";

export const dynamic = "force-dynamic";

export default function ReportPrintPage() {
  const [dataset, setDataset] = useState<{
    title: string;
    columns: string[];
    rows: (string | number)[][];
    summary: { label: string; value: string | number }[];
  } | null>(null);
  const [type, setType] = useState<string>("cases");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reportType = params.get("type") ?? "cases";
    setType(reportType);

    fetch(`/api/reports/${reportType}?format=json`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            throw new Error("لا تملك الصلاحية لعرض هذا التقرير");
          }
          throw new Error("تعذر تحميل التقرير - تأكد من اتصالك بالإنترنت");
        }
        return res.json();
      })
      .then((data) => {
        if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) {
          throw new Error("بيانات التقرير غير صالحة");
        }
        setDataset(data);
      })
      .catch((err) => setError(err?.message ?? "حدث خطأ غير متوقع"))
      .finally(() => setBusy(false));

    // preload font to improve PDF generation reliability
    try {
      const fontUrl = "https://fonts.gstatic.com/s/notosansarabic/v41/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyG2vu3CBFQLaig.woff2";
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "font";
      link.type = "font/woff2";
      link.crossOrigin = "anonymous";
      link.href = fontUrl;
      document.head.appendChild(link);
    } catch {
      // ignore preload failure
    }
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          @page { size: A4; margin: 15mm; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div className="mx-auto max-w-5xl space-y-6">
        <header className="no-print flex flex-col gap-4 rounded-3xl border border-amber-200 bg-white p-6 shadow-lg sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-amber-700">LegalPro Elite • تقرير تنفيذي</p>
            <h1 className="mt-2 text-2xl font-black text-slate-900">
              {dataset?.title ?? (busy ? "جارٍ تحميل بيانات التقرير..." : error ? "تعذّر تحميل التقرير" : "التقرير")}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {dataset ? `${dataset.rows.length} سجل • يمكن الطباعة أو الحفظ كـ PDF` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handlePrint}
              disabled={busy || !dataset}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "جارٍ التحميل..." : "طباعة / حفظ PDF"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.close();
              }}
              className="btn-danger"
            >
              إغلاق
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-bold">تعذّر تحميل التقرير</p>
            <p className="mt-2 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-danger mt-4"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : null}

        {dataset ? (
          <section className="print-card panel p-6">
            <div className="mb-5 border-b border-amber-200 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">LegalPro Elite</p>
                  <h2 className="mt-1 text-3xl font-black text-amber-700">{dataset.title}</h2>
                </div>
                <div className="text-left text-xs text-slate-500">
                  <div>تاريخ الإنشاء</div>
                  <div className="font-bold text-slate-900">{new Date().toLocaleDateString("ar-SA-u-nu-latn")}</div>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-bold text-amber-900">ملخص مؤشرات التقرير</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {dataset.summary.map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-amber-900">{item.label}</span>
                    <span className="font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table-shell">
                <thead>
                  <tr>
                    {dataset.columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.length ? (
                    dataset.rows.map((row, index) => (
                      <tr key={index}>
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex}>{String(cell ?? "—")}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={dataset.columns.length} className="text-center py-8 text-slate-500">
                        لا توجد بيانات متاحة لهذا التقرير في الوقت الحالي.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
              تم إنشاء هذا التقرير تلقائياً بواسطة نظام LegalPro Elite • جميع الحقوق محفوظة
            </footer>
          </section>
        ) : null}

        {busy ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
            <p className="mt-3 text-sm text-slate-600">جارٍ تحميل بيانات التقرير...</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
