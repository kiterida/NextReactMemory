# How to start the project

Run `npm run dev` to work on the project.

## Dashboard widget system

Suggested file structure for the widget system:

```text
app/
  (dashboard)/
    page.tsx
  components/
    widgets/
      CurrentCoursesWidget.js
      DashboardWidgets.js
      HistoryWidget.js
      WidgetConfigDialog.js
      WidgetPickerDialog.js
      widgetQueries.js
      widgetRegistry.js
data/
  memory_core_widgets.sql
```

Implementation steps:

1. Run the SQL in `data/memory_core_widgets.sql` in Supabase.
2. Confirm `user_id` should store the same identifier used by your app session. The current implementation uses the signed-in user email because this app uses NextAuth rather than Supabase Auth.
3. If Supabase reports `new row violates row-level security policy`, re-run the latest `data/memory_core_widgets.sql`. It now includes permissive RLS policies for the current NextAuth + browser anon-key setup.
4. Open the dashboard page and click `Add Widget`.
5. Pick a widget type, fill in its config, and save it.
6. The dashboard will fetch rows from `memory_core_widgets` and render them through `widgetRegistry.js`.
7. To add a future widget type, register it in `widgetRegistry.js`, create a widget component, and add its config fields to `WidgetConfigDialog.js`.

# How to update to github

First build the project
`npm run build`

Then add the changes to git
`git add .`
`git commit -m "Describe your changes"`
`git push -u origin main`

# View on Github
https://github.com/kiterida/NextReactMemory


# Create Toolpad App

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-toolpad-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Setup

Run `npx auth secret` to generate a secret and replace the value in the .env.local file with it.

Add the CLIENT_ID and CLIENT_SECRET from your OAuth provider to the .env.local file.

## Getting Started

First, run the development server: `npm run dev`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Cloudflare R2 Image Upload (Quill)

To upload pasted/inserted Quill images to Cloudflare R2, add these values to `.env.local`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL` (public base URL for your bucket/domain, without a trailing `/`)


## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
