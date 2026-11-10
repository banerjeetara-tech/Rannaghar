# Rannaghar

Weekly family meal planner: a day-wise menu (breakfast, lunch, dinner), cooking instructions for the cook, and separate bazaar and online shopping lists you can send on WhatsApp.

Single HTML file. Your menu and dishes are saved in Chrome on your phone; use **Menu > Settings > Save backup file** now and then.

Open the app in Chrome and choose **Add to Home screen**.

## New dish ideas (Claude API)

The **Get 5 new ideas** button on the Dishes tab asks Claude Haiku 5.5 for dishes you don't have yet. Your API key stays in a Cloudflare Worker, never in the app or on GitHub. Each request costs well under ₹1.

1. **API key.** At console.anthropic.com, add a small credit, set a monthly spend limit, and create an API key.
2. **Worker.** In the Cloudflare dashboard, go to Workers & Pages > Create > Create Worker. Name it `rannaghar`, deploy, then choose **Edit code**. Replace everything with the contents of `worker/rannaghar-worker.js` and deploy.
3. **Secrets.** In the Worker, open Settings > Variables and Secrets and add two **Secrets**:
   - `ANTHROPIC_API_KEY`: your key from step 1
   - `APP_TOKEN`: any passcode you choose
4. **Connect the app.** Open the app, go to Menu > Settings and new week, and paste the Worker link (for example `https://rannaghar.<your-subdomain>.workers.dev`) and the same passcode.

The app shows roughly what you have spent this month under Settings.
