# GC Popup Manager

A multi-tenant popup opt-in management system with Global Control CRM
integration. One central app (deployed on Vercel) serves popup forms that can
be embedded on **any** external website via a single `<script>` tag: cPanel
sites, Shopify, ClickFunnels, Webflow, GoHighLevel, and more.

## What it does

- Central admin UI to create and manage popups (headline, copy, fields, style,
  GC tag, allowed domains).
- A single embeddable script (`/embed.js`) that renders a modal opt-in form on
  any site and posts back to this hub.
- A **non-blocking** submit endpoint: it validates, queues the submission, and
  returns success to the visitor in well under 50ms. It never calls Global
  Control inline.
- A Vercel cron job (every 5 minutes) that drains the queue and talks to Global
  Control: create/update the contact, fire the tag, then verify and restore any
  name/phone the tag-fire may have wiped.

## Architecture

```
Visitor site  ──<script src="…/embed.js" data-popup-id="…">──▶  Modal form
     │                                                              │
     │  POST /api/submit  (validate + enqueue, <50ms)              │
     ▼                                                              ▼
  Upstash Redis  ◀── queue:pending (LIST) ── submission:{id} (JSON)
     ▲
     │  every 5 min
  Vercel Cron ──▶ POST /api/cron/process-queue ──▶ Global Control CRM
```

All state lives in Upstash Redis. There is no SQL database.

### Redis keys

| Key                      | Type          | Purpose                               |
| ------------------------ | ------------- | ------------------------------------- |
| `popup:{id}`             | string (JSON) | One popup definition                  |
| `popups:index`           | set           | All popup IDs                         |
| `popup:{id}:submissions` | sorted set    | Submission IDs by timestamp           |
| `submission:{id}`        | string (JSON) | One submission                        |
| `queue:pending`          | list          | Work queue (RPUSH / LPOP)             |
| `queue:failed`           | set           | Submissions that hit max retries      |
| `uploads:index`          | list          | Uploaded image records (newest first) |

## Image Storage (Vercel Blob)

Uploaded images in the popup builder are stored in **Vercel Blob**, Vercel's
built-in object storage. You need to create a Blob store and add the token
before image upload will work.

### Setup

1. Go to your [Vercel dashboard](https://vercel.com/dashboard) → **Storage**.
2. Click **Create Database** and choose **Blob**.
3. Give it a name (e.g. `gc-popup-images`) and click **Create**.
4. Open the store → **\.env.local** tab and copy the `BLOB_READ_WRITE_TOKEN` value.
5. Add it to your project's environment variables in Vercel → **Settings → Environment Variables**:

   ```
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
   ```

6. Re-deploy (or trigger a new build) for the variable to take effect.

### Redis index

Every successful upload stores a JSON record in Redis under the list key
`uploads:index` so the library modal can list past images. No extra setup
needed — the same Upstash Redis instance is reused.

| Redis key       | Type | Purpose                                             |
| --------------- | ---- | --------------------------------------------------- |
| `uploads:index` | list | JSON records for each uploaded image (newest first) |

## Environment variables

| Variable                   | Required    | Description                                                                                     |
| -------------------------- | ----------- | ----------------------------------------------------------------------------------------------- |
| `GC_API_KEY`               | yes         | Global Control API key (sent as `X-API-KEY`)                                                    |
| `GC_API_URL`               | yes         | GC API base, e.g. `https://api.globalcontrol.io/api/ai`                                         |
| `UPSTASH_REDIS_REST_URL`   | yes         | Upstash Redis REST URL                                                                          |
| `UPSTASH_REDIS_REST_TOKEN` | yes         | Upstash Redis REST token                                                                        |
| `ADMIN_PASSWORD`           | yes         | Password for the admin UI login                                                                 |
| `JWT_SECRET`               | yes         | Secret used to sign admin JWTs                                                                  |
| `CRON_SECRET`              | recommended | Shared secret protecting the cron endpoint                                                      |
| `NEXT_PUBLIC_APP_URL`      | optional    | Public origin used when building embed snippets (auto-detected from request headers if omitted) |
| `BLOB_READ_WRITE_TOKEN`    | yes         | Vercel Blob store token for image uploads (see Image Storage section)                           |

Copy `.env.example` to `.env.local` for local development.

## Deploy to Vercel

1. Push this repo to GitHub (already the case).
2. In Vercel, **New Project** → import the repo.
3. Add all environment variables from the table above in
   **Settings → Environment Variables**.
4. Create an [Upstash Redis](https://upstash.com/) database and copy its REST
   URL and token into the env vars.
5. Deploy. `vercel.json` registers the cron automatically:

   ```json
   {
     "crons": [{ "path": "/api/cron/process-queue", "schedule": "*/5 * * * *" }]
   }
   ```

6. Vercel Cron calls the endpoint on schedule. Set `CRON_SECRET` and Vercel
   will send it as a bearer token; the endpoint also accepts `?secret=` or an
   `x-cron-secret` header for manual triggers.

## How to embed a popup

1. Sign in to `/admin`, create a popup, set its status to **active**, and add
   the domains it is allowed to run on.
2. Open the popup and copy the embed snippet:

   ```html
   <script
     src="https://YOUR-APP.vercel.app/embed.js"
     data-popup-id="your-popup-id"
     async
   ></script>
   ```

3. Paste it into the target site's HTML (before `</body>`). New popups default to
   **button activation**, so the script does not show an overlay just by loading.

### Trigger modes

Each popup has a trigger setting in the admin builder. The public config contains
only these display/behavior settings; it never exposes Global Control credentials,
tag IDs, or allowed domains.

- **Button activated (recommended/default):** add this attribute to a button or
  link on the visitor site. The popup opens only after a click:

  ```html
  <button data-gc-popup-trigger="your-popup-id">Get the offer</button>
  ```

  You can also enter a CSS selector such as `#open-offer` or `.open-popup` in
  the builder. Both the data attribute and configured selector are bound. The
  embed avoids duplicate listener bindings.

- **Delayed page load:** choose any whole-second delay from **1 to 86,400**
  seconds (24 hours). The default delay value is 30 seconds, but button mode is
  the default trigger. Use a longer delay when an immediate interruption would
  be annoying.
- **Exit intent:** on desktop, the popup opens when the mouse leaves near the
  top of the viewport. Touch/mobile devices intentionally do nothing for this
  trigger so visitors do not get a surprise overlay.

The **Show once per browser session** option is on by default. When enabled,
the embed records the first display in `sessionStorage`; a close or later button
click in the same tab session will not re-open the popup. Turn it off only when
repeat opening during a session is intentional.

`window.GCPopup.open()` and `window.GCPopup.close()` remain available for a
manual integration. The normal data attribute is preferred because it is
platform-independent.

The script is vanilla JS with no dependencies and works cross-origin. It fetches
only public display fields — `gcTagId` and `allowedDomains` are never exposed.

## How the queue works

1. `POST /api/submit` validates the email + popup, checks the request Origin /
   Referer against the popup's `allowedDomains`, stores the submission with
   status `queued`, and `RPUSH`es its ID onto `queue:pending`. It returns
   immediately.
2. `POST /api/cron/process-queue` (every 5 min):
   - `LPOP`s up to 20 submission IDs.
   - For each: mark `processing`, look up the GC contact by email (tolerating
     `data.contacts` / `data.data` / `data` / bare-array response shapes),
     merge without overwriting existing name/phone with empty values,
     create-or-update the contact, fire the tag, wait 2s, re-fetch, and restore
     name/phone if the tag-fire wiped them. Mark `processed`.
   - On error: increment `retryCount`; re-queue if under 3 attempts, otherwise
     mark `max_retries` and add to `queue:failed`.
   - 500ms pause between submissions.
3. Failed submissions can be re-queued from the admin **Submissions** screen.

## Admin screens

- `/admin` — login
- `/admin/dashboard` — stats + recent submissions
- `/admin/popups` — list, create
- `/admin/popups/new` — create form
- `/admin/popups/[id]` — edit, embed snippet, recent submissions
- `/admin/submissions` — all submissions, filter by status/popup, retry

## Local development

```bash
npm install --include=dev
cp .env.example .env.local   # fill in values
npm run dev
```

## Tech stack

Next.js 14 (App Router) · TypeScript · Upstash Redis · Tailwind CSS · JWT auth ·
Vercel Cron.

## Image framing and responsive behavior

The popup builder keeps image presentation with the popup definition, so the
admin live preview and the public embed use the same crop and sizing rules.

- **Fit:** choose **Crop to frame** (`cover`), **Show whole image** (`contain`),
  or **Stretch** (`fill`).
- **Position:** choose the focal direction used when an image is cropped.
- **Scale:** adjust the image inside its crop frame from 50% to 150%.
- **Heights:** choose separate desktop (100–360px) and mobile (100–260px)
  image-frame heights for templates that show an image.
- **Classic:** uses the configured fixed frame instead of the source image's
  natural dimensions, keeping the card responsive and desktop sizing tidy.
- **Split:** uses a stable 45% image panel with a 360px minimum height on
  desktop. The image panel is intentionally hidden on mobile, where the form
  becomes single-column.

If a configured image cannot load, the preview and embed show an explicit
“Image unavailable” state rather than leaving an empty area. Existing popup
records without image settings automatically receive safe template defaults.
