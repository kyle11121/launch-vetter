# Launch Vetter — Pivotree GTM

Product launch vetting tool. Intake form + live market research + red/yellow/green scoring across 8 dimensions. Downloadable HTML report.

## Stack

- React + Vite (frontend)
- Express (backend, proxies Anthropic API)
- Claude claude-sonnet-4-20250514 with web search

---

## Deploy to Render

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/launch-vetter.git
git push -u origin main
```

### 2. Create a Web Service on Render

1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Configure:
   - **Name:** launch-vetter (or whatever you want)
   - **Environment:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`

### 3. Add Environment Variable

In Render → Your Service → Environment:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |

### 4. Deploy

Hit deploy. Render builds the client, bundles it into the Express server, and serves everything from one URL.

---

## Local Dev

```bash
# Install root deps
npm install

# Install client deps + run dev server
cd client && npm install && npm run dev
```

For local dev, the Vite proxy routes `/api` calls to `localhost:3001`. Run the Express server separately:

```bash
# Root
node server.js
```

Set `ANTHROPIC_API_KEY` in a `.env` file or your shell environment.
