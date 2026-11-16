# Rannaghar

Weekly family meal planner: a day-wise menu (breakfast, lunch, dinner), cooking instructions for the cook, and separate bazaar and online shopping lists you can send on WhatsApp.

Single HTML file with about 2,500 built-in dishes and 32 ready-made menu lists (Bengali, home-style Chinese, breakfasts, veg). Your menu and own dishes are saved in Chrome on your phone. Use **Settings > Save backup file** now and then.

Open the app in Chrome and choose **Add to Home screen**.

## How a week works

The menu is grouped by **cook visit**. Set the days the cook comes in Settings (default Fri, Sat, Sun, Mon, Wed evenings). An evening visit cooks that night's dinner and every meal until the next visit, so Monday evening covers Monday dinner, all of Tuesday, and Wednesday breakfast and lunch.

1. **Menu**: each card is one cook visit. Tap a dish to swap it, or **Ideas** on a meal for veg and non-veg suggestions. Tap **Approve this visit** when it looks right.
2. **Shop** and **Cook** show only approved visits, and update when you change a dish. Shop can show one visit at a time.
3. On **Cook**, tap two or three visits to club their instructions into one WhatsApp message, the same way Shop clubs visits into one trip.
4. **Ideas with Claude** suggests new dishes by meal and by veg and non-veg. It costs about 10 paise a time; web search (about ₹3) is off unless you switch it on in Settings.

## Adding your own

Every tab takes your own entries:

- **Menu**: tap **+ add** on a meal, then **Add my own item** (or build it from ingredients).
- **Cook**: under each visit, **My own items for this visit** adds anything outside the menu for the cook, with a tick to include it in the message.
- **Shop**: **Add my own item** puts anything on the bazaar or online list. It stays until you remove it.
- **Ideas**: **Add my own dish** saves your idea with your dishes and shows it at the top.
- **Calories**: **Add my own** logs anything you ate.

## Diet plan with Claude

On the **Ideas** tab, **Diet plan with Claude** prepares a full week for a chosen diet: Low calorie, Vegetarian, Intermittent fasting 16:8, Keto or High protein. Set the calories a day, tick Veg only if you want, and add anything else for Claude. You see the week first with calories and protein per day, then choose **Use for this week** or **Use for next week**. The dishes are also saved as a list under My lists. It costs about 30 paise and needs Worker version 7 or later to follow the diet strictly. These are general meal ideas, not medical advice.

## Look and theme

**Settings > Look and theme** changes the colour (Terracotta, Mustard, Leaf green, Indigo, Rose, Slate), light or dark mode, and text size. The choice is saved on that phone.

## Calories tab

Every dish shows an estimated kcal per serving, worked out from its ingredients and oil. The Menu tab shows planned calories per meal and per day. In the **Calories** tab you log servings eaten each day, add extras, enter your weekly weight and an optional daily target, and see which dishes add the most calories with lighter swaps. **Plan next week** archives the week under Earlier weeks.

## Menu lists (Ideas tab)

A list is a set of dishes. Pick one to follow and the next **Shuffle** and **Plan next week** use only those dishes. 32 ready-made lists are included, such as Classic Bengali week, Winter specials, Vegetarian week, Prawn specials and Kids' favourites. You can create your own lists, or copy a ready-made one and change it.

## New dish ideas (Claude API)

On the Ideas tab, **Ideas** is free and picks from your saved dishes. **Ideas through web** asks Claude Haiku 5.5 to search the web for new dishes you don't have yet. Your API key stays in a Cloudflare Worker, never in the app or on GitHub. Each request costs about 10 paise with web search off.

1. **API key.** At console.anthropic.com, add a small credit, set a monthly spend limit, and create an API key.
2. **Worker.** In the Cloudflare dashboard, go to Workers & Pages > Create > Create Worker. Name it `rannaghar`, deploy, then choose **Edit code**. Replace everything with the contents of `worker/rannaghar-worker.js` and deploy.
3. **Secrets.** In the Worker, open Settings > Variables and Secrets and add two **Secrets**:
   - `ANTHROPIC_API_KEY`: your key from step 1
   - `APP_TOKEN`: any passcode you choose
4. **Connect the app.** Open the app, go to the **Settings** tab, paste the Worker link (for example `https://rannaghar.<your-subdomain>.workers.dev`) and the same passcode, then tap **Save connection** and **Test connection**.

If you change the worker code later, paste the new `worker/rannaghar-worker.js` into Cloudflare and deploy again.

The app shows roughly what you have spent this month in the Settings tab.

## Automatic Worker updates

`.github/workflows/deploy-worker.yml` deploys `worker/rannaghar-worker.js` to Cloudflare whenever it changes. It needs two repository secrets (Settings > Secrets and variables > Actions):

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token made from the **Edit Cloudflare Workers** template
- `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID

The Worker name in `wrangler.toml` must match the Worker's name in Cloudflare (`rannaghar`). Your API key and passcode secrets stay as they are.
