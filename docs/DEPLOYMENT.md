# Deploy to Vercel with a Render backend

Deploy the backend first using its
[Render deployment guide](https://github.com/mahmudrafi24/restaurants_finder_api/blob/fix/backend-bug-audit/docs/DEPLOYMENT.md).

Import `mahmudrafi24/restaurants_finder` into Vercel. Use these settings:

| Setting               | Value                                                |
| --------------------- | ---------------------------------------------------- |
| Production branch     | `fix/frontend-bug-audit`                             |
| Framework             | Next.js                                              |
| Root directory        | Repository root (`.`)                                |
| Node.js               | 22.x                                                 |
| Install command       | `npm ci`                                             |
| Build command         | `npm run build`                                      |
| Output directory      | Framework default                                    |
| `NEXT_PUBLIC_API_URL` | Your actual Render backend origin, without `/api/v1` |

Set the environment variable before building. Changing it requires a redeploy
because Next.js embeds public environment variables into the browser bundle.

Once Vercel assigns the frontend domain, set the backend's `CORS_ORIGINS` to that
exact origin, without a trailing slash. Deploy the backend configuration change
before testing. Add trusted custom or preview origins explicitly as needed.

Verify autocomplete, a small search, table filtering, and all three downloads.
After Render Free has been idle, open its `/api/v1/health` URL and let it wake
before testing; the first request can take about a minute.

See [Vercel Git deployments](https://vercel.com/docs/git) and
[Render Free limits](https://render.com/docs/free).
