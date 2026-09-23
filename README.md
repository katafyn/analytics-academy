# Analytics Academy v10

Русскоязычная платформа для подготовки к Data Analytics: 133 урока, 500 практических заданий, 12 проектов, экзамены, SQL/Python Playground, портфолио и University Ready.

## Accounts & sync
- Регистрация и вход по email + паролю.
- Пароли хранятся только как scrypt-хеши.
- Сессии используют HttpOnly cookie.
- Прогресс синхронизируется через `/api/state`.
- Для постоянного облачного хранения на Render подключите Supabase PostgreSQL.

## Supabase setup
1. Создайте проект в Supabase.
2. Откройте SQL Editor.
3. Выполните `supabase_schema.sql`.
4. В Render → Environment добавьте `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`.
5. Redeploy сервис.

Не публикуйте service-role key в GitHub или frontend.

## Local fallback
Если Supabase variables не заданы, приложение использует локальный `data.json` как demo storage. Для production на Render рекомендуется обязательно подключить Supabase, потому что локальная файловая система Render не является постоянным хранилищем.

## Start
```bash
npm install
npm start
```


## v11 — Teacher Mode
Added a guided teacher system for practice, SQL and Python: progressive hints, concept-first prompts, and feedback that avoids revealing the answer after mistakes.


## v12 Teacher Mode
Персональный учитель доступен на уроках, Practice Lab, Exam Mode и Playground. Он сохраняет историю ошибок по категориям и выдаёт ступенчатые подсказки без готового ответа.


## v13 additions
- Career Path: Data Analyst, Business Analyst, BI Analyst, Product Analyst, Marketing Analyst, Financial Analyst, Operations Analyst, Data Scientist.
- Each career includes responsibilities, focus, tools, example task, typical workday, skills, and growth path.
- Career selection is stored in the local learning state and can guide the learner toward the relevant course path.
