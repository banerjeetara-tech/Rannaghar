# Rannaghar

Weekly family meal planner: a day-wise menu (breakfast, lunch, dinner), cooking instructions for the cook, and separate bazaar and online shopping lists you can send on WhatsApp.

Single HTML file with about 240 built-in dishes (Bengali, home-style Chinese, breakfasts, veg). Your menu and own dishes are saved in Chrome on your phone. Use **Settings > Save backup file** now and then.

Open the app in Chrome and choose **Add to Home screen**.

## How a week works

1. **Menu**: the app fills breakfast, lunch and dinner for 7 days. Tap a dish to swap it, or **Ideas for lunch** (etc.) for suggestions split into veg and non-veg. Tap **Approve** on each day you are happy with.
2. **Shop** and **Cook** show only approved days, and update as soon as you change a dish.
3. **Ideas with Claude** (Ideas tab, a meal's Ideas sheet, or a dish's sheet) finds new dishes on the web, sorted by breakfast, lunch and dinner and by veg and non-veg.

## Menu lists (Ideas tab)

A list is a set of dishes. Pick one to follow and the next **Shuffle** and **Plan next week** use only those dishes. Six ready-made lists are included: Classic Bengali week, Light and healthy, Fish lover's week, Winter specials, Quick weekday and Summer cooling. You can create your own lists, or copy a ready-made one and change it.

## New dish ideas (Claude API)

On the Ideas tab, **Ideas** is free and picks from your saved dishes. **Ideas through web** asks Claude Haiku 5.5 to search the web for new dishes you don't have yet. Your API key stays in a Cloudflare Worker, never in the app or on GitHub. Each web request costs about ₹2-3.

1. **API key.** At console.anthropic.com, add a small credit, set a monthly spend limit, and create an API key.
2. **Worker.** In the Cloudflare dashboard, go to Workers & Pages > Create > Create Worker. Name it `rannaghar`, deploy, then choose **Edit code**. Replace everything with the contents of `worker/rannaghar-worker.js` and deploy.
3. **Secrets.** In the Worker, open Settings > Variables and Secrets and add two **Secrets**:
   - `ANTHROPIC_API_KEY`: your key from step 1
   - `APP_TOKEN`: any passcode you choose
4. **Connect the app.** Open the app, go to the **Settings** tab, paste the Worker link (for example `https://rannaghar.<your-subdomain>.workers.dev`) and the same passcode, then tap **Save connection** and **Test connection**.

If you change the worker code later, paste the new `worker/rannaghar-worker.js` into Cloudflare and deploy again.

The app shows roughly what you have spent this month in the Settings tab.
