# تمرین‌یار

نسخهٔ اولیهٔ فارسی برای برنامه‌ریزی و پیگیری تمرین شاگردان باشگاه. نمای مربی و شاگرد از منوی بالای صفحه قابل جابه‌جایی است و هر دو از یک فضای آزمایشی مشترک استفاده می‌کنند.

## اجرای محلی

با Node.js 24 از پوشهٔ پروژه اجرا کنید.

```sh
npm ci
npm run dev
```

اپ در [localhost:3000](http://localhost:3000) در دسترس است. در اجرای محلی بدون `DATABASE_URL`، اطلاعات و فایل‌های ویدیو در پوشهٔ `.data` همان پروژه ذخیره می‌شوند. فضای آزمایشی هنگام نخستین مراجعه با چند شاگرد و جلسهٔ نمونه ساخته می‌شود.

## اجرای Docker

```sh
docker compose up --build
```

سرویس Nginx روی [localhost:8080](http://localhost:8080) در دسترس است. Compose از Node.js 24 و PostgreSQL 18 استفاده می‌کند. Prisma در راه‌اندازی اپ migration را اجرا می‌کند. اجرای Compose به آدرس محلی محدود است. برای حفاظت از دموی اشتراکی می‌توانید `DEMO_ACCESS_PASSWORD` را در `.env` تنظیم کنید. نام کاربری Basic Auth برابر `demo` است.

## مسیرهای اصلی

- مربی پروندهٔ شاگرد و جلسه می‌سازد. هر جلسه تاریخ، عنوان و یک یا چند حرکت با تعداد ست و تکرار دارد.
- شاگرد از تقویم هفتگی حرکت را ثبت و ویدیوی اجرای آن را بارگذاری می‌کند. مربی از بخش بازبینی ویدیو، بازخورد را ثبت می‌کند و شاگرد آن را می‌بیند.
- مربی می‌تواند در کتابخانه برای هر حرکت نمونهٔ فارسی MP4 یا WebM بارگذاری کند. هر فایل حداکثر ۵۰ مگابایت است. دادهٔ اولیه شامل متن راهنمای اجرای شش حرکت است و ویدیوهای نمونه به‌صورت فایل همراه پروژه ارائه نشده‌اند.
- در نمای شاگرد، یادآوری حرکت‌های باقیماندهٔ امروز در خود اپ نمایش داده می‌شود. در نمای مربی، دستیار جلسات عقب‌افتادهٔ هفت روز گذشته را نشان می‌دهد.

## دستیار و پرداخت

برای اتصال دستیار، `AI_URL` را روی نشانی کامل یک سرویس سازگار با Chat Completions تنظیم کنید و `AI_MODEL` و در صورت نیاز `AI_KEY` را در `.env` بگذارید. اتصال به سرویس بیرونی با `AI_WORKSPACE_CONSENT=true` فعال می‌شود. برای پیش‌نویس، سن، وزن، سطح، هدف و فهرست حرکات به سرویس فرستاده می‌شود. در گفت‌وگو، متن سؤال و خلاصهٔ برنامه فرستاده می‌شود. برای شاگردی که آسیب‌دیدگی ثبت‌شده دارد، جلسه باید دستی تنظیم شود. در حالت محلی، پیش‌نویس‌ها و پاسخ‌ها از الگوهای ثابت می‌آیند.

صفحهٔ اشتراک مدل ماهانهٔ مربی و دسترسی رایگان شاگرد را نمایش می‌دهد. برای استفادهٔ تجاری، احراز هویت و دسترسی مجزای مربی و شاگرد، درگاه و تمدید اشتراک ریالی، محتوای آموزشی فارسی و آزمون استقرار در ایران باقی مانده‌اند.

## ساخت و ساختار پروژه

```sh
npm run build
npm run typecheck
```

- `src/app` نقطهٔ ورود App Router، صفحهٔ سمت سرور، سبک‌های عمومی و مسیر پخش ویدیو
- `src/features/training` مدل، داده‌های نمونه، عملیات سرور و ذخیره‌سازی
- `src/features/dashboard` داشبورد، نماها و فرم‌های تعاملی
- `src/components` اجزای مشترک رابط

تصویر `public/gym.png` با ImageGen ساخته شده است. پرامپت نهایی تصویر:

> Photorealistic editorial fitness photography for a compact dark dashboard hero wide banner. A fit adult Iranian male athlete with dark short hair and black sleeveless athletic shirt, in a moody black gym performing seated dumbbell curls, cropped from thighs to face, on LEFT third of composition. Dark almost black right two thirds with negative space for text overlaid later. Warm orange rim lighting and dramatic deep shadows, black rubber gym floors, premium sports editorial aesthetic. No typography, no graphics, no watermark. Wide landscape composition.

مراجع فنی [Next.js App Router](https://nextjs.org/docs/app/getting-started/installation) و [Prisma و PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).