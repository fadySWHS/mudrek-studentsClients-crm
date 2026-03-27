# إعداد ربط Google Sheets (Service Account)

لكي يتمكن النظام من التفاعل مع ملفات Google Sheets، يجب إعداد **Google Service Account** واستخراج ملف الـ JSON لربطه بالـ Backend. 

فيما يلي الخطوات بالتفصيل للحصول على بيانات حساب Google Service Account:

### الخطوة 1: إنشاء مشروع في Google Cloud
1. اذهب إلى [Google Cloud Console](https://console.cloud.google.com/).
2. قم بتسجيل الدخول بحساب Google الخاص بك.
3. في الشريط العلوي (بجوار شعار Google Cloud)، انقر على قائمة المشاريع واختر **New Project** (مشروع جديد).
4. اكتب اسم المشروع (مثلاً: Mudrek CRM) واضغط على **Create**.

### الخطوة 2: تفعيل الـ APIs المطلوبة
1. تأكد من تحديد المشروع الذي قمت بإنشائه للتو.
2. من القائمة الجانبية، اذهب إلى **APIs & Services** ثم **Library**.
3. في شريط البحث، ابحث عن **Google Sheets API** واضغط على **Enable** (تفعيل).
4. عد مرة أخرى إلى الـ Library، وابحث عن **Google Drive API** واضغط على **Enable** (تفعيل).

### الخطوة 3: إنشاء Service Account (حساب الخدمة)
1. من القائمة الجانبية، اذهب إلى **IAM & Admin** > **Service Accounts**.
2. في الأعلى، انقر على **+ CREATE SERVICE ACCOUNT** (إنشاء حساب خدمة).
3. أدخل اسم حساب الخدمة (مثلاً: `sheets-integration`) واضغط **Create and Continue**.
4. (اختياري) يمكنك تخطي اختيار الأدوار (Roles) بالضغط على **Continue** ثم **Done**.

### الخطوة 4: استخراج مفتاح الـ JSON
1. ستجد حساب الخدمة الذي قمنا بإنشائه في القائمة. اضغط على عنوان البريد الإلكتروني الخاص به (والذي ينتهي بـ `gserviceaccount.com`).
2. اذهب إلى علامة التبويب **Keys** (المفاتيح).
3. انقر على **ADD KEY** > **Create new key**.
4. حدد خيار **JSON**، ثم انقر على **Create**.
5. سيتم تنزيل ملف أمان بصيغة `.json` على جهازك (يحتوي هذا الملف على كلمات المرور والروابط المطلوبة).

### الخطوة 5: ربط البيانات في المشروع (الـ Backend)
1. افتح ملف الـ `.json` الذي قمت بتنزيله باستخدام أي محرر نصوص (مثل VS Code أو Notepad).
2. انسخ **كل محتوى الملف** (النص بالكامل الذي يبدأ بـ `{` وينتهي بـ `}`).
3. اذهب إلى ملف `backend/.env`.
4. ابحث عن السطر `GOOGLE_SERVICE_ACCOUNT_JSON=...`.
5. الصق المحتوى الذي نسخته بين علامتي التنصيص المفردة `''` ليصبح سطراً واحداً. مثال:
   ```env
   GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account","project_id":"mudrek-crm-123","private_key_id":"...","private_key":"...","client_email":"..."}'
   ```

### الخطوة 6: إعطاء الصلاحية لملف Google Sheet
يجب أن تعطي حساب الخدمة (الروبوت) الإذن لقراءة وتعديل الـ Sheet الخاص بك:
1. افتح ملف الـ JSON مرة أخرى، وانسخ البريد الإلكتروني الموجود أمام كلمة `"client_email"` (والذي ينتهي بـ `iam.gserviceaccount.com`).
2. افتح ملف Google Sheet الذي تريد ربطه في المتصفح.
3. انقر على الزر الأزرق **Share** (مشاركة) في أعلى اليمين.
4. إلصق البريد الإلكتروني الذي نسخته هناك.
5. تأكد من إعطائه صلاحية **Editor** (مُحرر).
6. انقر على **Send** (إرسال).

### إعداد معرف الـ Sheet (Sheet ID)
في نفس ملف `backend/.env`، تأكد من وضع الـ `GOOGLE_SHEET_ID`:
يمكنك استخراج هذا الـ ID من رابط ملف الـ Google Sheet. على سبيل المثال، إذا كان الرابط هو:
`https://docs.google.com/spreadsheets/d/1BxiMVs0X_X...XYZ/edit`
فإن الـ ID هو الجزء الذي يقع بين `/d/` و `/edit` وهو: `1BxiMVs0X_X...XYZ`.
ضعه في السطر:
`GOOGLE_SHEET_ID="1BxiMVs0X_X...XYZ"`
