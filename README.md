# preview-lab

[![Deploy on Back4app](https://img.shields.io/badge/Deploy%20on-Back4app-1568B8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2ZmZiIgZD0iTTEyIDJMMiA3djEwbDEwIDUgMTAtNVY3eiIvPjwvc3ZnPg==)](https://www.back4app.com/signup?utm_source=github&utm_medium=repo&utm_campaign=preview-lab)

One build, deployed twice: once with the settings it had in preview, and once with
the four that production actually needs. A real browser records what a person
sees; the API records what it thinks happened. They disagree.

> **Read the article:** [App Works in Preview but Not in Production: 404 on Refresh, No Data, Login Sent to localhost](https://www.back4app.com/blog/works-in-preview-not-in-production?utm_source=github&utm_medium=repo&utm_campaign=preview-lab)

## Run it

```
./run.sh
```

Needs Node 22 and Google Chrome.

## What it found

```
SHIPPED WITH THE SETTINGS IT HAD IN PREVIEW
  /orders typed into the address bar     HTTP 404
  orders shown on the home page          0 of 3 — failed: Failed to fetch
  what the api says about that request   200 /api/orders origin=…:7502 cors=NOT SENT
  where "sign in" lands                  chrome-error://chromewebdata/ — nothing there

WITH THE FOUR SETTINGS PRODUCTION NEEDS
  /orders typed into the address bar     HTTP 200, shows "Your orders"
  orders shown on the home page          3 of 3
  what the api says about that request   200 /api/orders origin=…:7502 cors=…:7502
  where "sign in" lands                  http://127.0.0.1:7502/callback — loaded
```

Same build. Same code. Four settings.

### The line worth staring at

```
what the api says about that request   200 /api/orders origin=…:7502 cors=NOT SENT
```

**The API returned 200.** The request arrived, was authorised, and was answered
correctly. The browser then threw the answer away, because the response did not
name the origin asking for it. Your server log, your uptime check and your error
tracker all show a healthy backend while the page shows nothing.

### The four settings

| what breaks | why | the setting |
| --- | --- | --- |
| a URL typed into the address bar gives 404 | the server looks for a file called `orders` | serve `index.html` for unknown paths |
| no data, "Failed to fetch" | the API allowlists the dev server's origin | allow the production origin |
| sign-in goes nowhere | the redirect was left pointing at `localhost` | set it to the production URL |
| a value is empty in production | it was added after the bundle was built | rebuild after changing it |

### The one that is not a setting

A variable added *after* the build is not in the bundle. The build inlines what it
can see at the moment it runs, so setting the variable afterwards changes nothing
until the app is built again. `run.sh` shows this by building once without it.

## The pieces

| file | what it does |
| --- | --- |
| `api.mjs` | the backend, with the CORS allowlist and the redirect it was told |
| `app/` | the app: client routing, a data fetch, a sign-in link |
| `build.mjs` | inlines the environment it can see into the bundle |
| `host.mjs` | serves the build, with or without the fallback for unknown paths |
| `probe.mjs` | drives real Chrome and reads the API's own log alongside |

## What to check before you call it deployed

1. Type a deep URL straight into the address bar and press enter.
2. Open the network tab and look for a request that succeeded but was blocked.
3. Click sign in and read where you end up.
4. Search your built bundle for the value you expect — not your config, the bundle.
