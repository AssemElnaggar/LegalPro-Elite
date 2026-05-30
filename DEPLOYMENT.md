# LegalPro Elite - دليل النشر على Vercel

## المشكلة
التطبيق يحتاج قاعدة بيانات PostgreSQL. Vercel لا يوفر قاعدة بيانات افتراضية.

## الحل خطوة بخطوة

### الخطوة 1: إنشاء قاعدة بيانات مجانية على Neon

1. اذهب إلى: https://neon.tech
2. اضغط **Sign Up** (مجاني)
3. سجّل الدخول بحساب GitHub أو Google
4. اضغط **New Project**
5. اكتب اسم المشروع: `legalpro-elite`
6. اختر المنطقة الأقرب لك (Washington D.C. مثلاً)
7. اضغط **Create Project**

### الخطوة 2: الحصول على رابط الاتصال

بعد إنشاء المشروع:
1. في الصفحة الرئيسية للمشروع، ستجد **Connection String**
2. يبدو مثل:
   ```
   postgresql://legalpro_owner:xxxxx@ep-quiet-breeze-123456.us-east-2.aws.neon.tech/legalpro?sslmode=require
   ```
3. انسخ هذا الرابط

### الخطوة 3: تشغيل ملف database.sql

1. في لوحة Neon، اضغط على **SQL Editor** في القائمة اليسرى
2. انسخ كامل محتوى ملف `database.sql` من مشروعك
3. الصقه في المحرر
4. اضغط **Run** (أو Ctrl+Enter)
5. انتظر رسالة النجاح

### الخطوة 4: إضافة DATABASE_URL في Vercel

1. اذهب إلى https://vercel.com/dashboard
2. افتح مشروع LegalPro-Elite
3. اضغط **Settings** (الإعدادات)
4. من القائمة اليسرى، اضغط **Environment Variables**
5. اضغط **Add New**
6. املأ:
   - **Name**: `DATABASE_URL`
   - **Value**: رابط الاتصال من Neon (الخطوة 2)
   - **Environment**: اختر Production و Preview و Development (كلها)
7. اضغط **Save**

### الخطوة 5: إعادة النشر

في Vercel Dashboard:
1. اذهب إلى **Deployments**
2. اضغط على آخر deployment
3. اضغط **Redeploy** (أيقونة السهم الدائري)
4. انتظر اكتمال البناء

أو من Terminal:
```bash
git add .
git commit -m "Configure database"
git push origin main
```

### الخطوة 6: التحقق

بعد اكتمال النشر:
1. افتح رابط Vercel الخاص بك
2. يجب أن ترى صفحة تسجيل الدخول
3. استخدم البيانات الافتراضية:
   - البريد: `admin@legalpro.local`
   - كلمة المرور: `Admin@12345`

---

## بدائل لقاعدة البيانات

### Neon (موصى به)
- مجاني 0.5 GB
- سهل الاستخدام
- https://neon.tech

### Supabase
- مجاني 500 MB
- مميزات إضافية
- https://supabase.com

### Vercel Postgres
- مجاني 256 MB
- مدمج مع Vercel
- https://vercel.com/docs/storage/vercel-postgres

### Railway
- مجاني $5 شهرياً
- https://railway.app

---

## حل المشاكل الشائعة

### خطأ: "relation users does not exist"
**السبب**: لم تقم بتشغيل database.sql
**الحل**: شغّل ملف database.sql في قاعدة البيانات

### خطأ: "DATABASE_URL is required"
**السبب**: لم تضف المتغير في Vercel
**الحل**: أضف DATABASE_URL في Environment Variables

### خطأ: "connection refused"
**السبب**: رابط DATABASE_URL غير صحيح
**الحل**: تأكد من نسخ الرابط كاملاً من Neon

### خطأ: "permission denied"
**السبب**: صلاحيات قاعدة البيانات
**الحل**: تأكد أن المستخدم لديه صلاحيات CREATE TABLE

---

## معلومات الاتصال

- المشروع: LegalPro Elite
- Next.js: 16.2.5
- Database: PostgreSQL
- ORM: Drizzle ORM
