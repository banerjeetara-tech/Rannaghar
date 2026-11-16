// Rannaghar ideas worker (Cloudflare Workers), version 8
// Holds your Anthropic API key so it never sits in the app or on GitHub.
//
// Secrets to set in Cloudflare (Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY  your key from console.anthropic.com
//   APP_TOKEN          any passcode you choose; type the same one in the app
// Optional plain variable:
//   ALLOWED_ORIGIN     defaults to https://banerjeetara-tech.github.io

const VERSION = 8;
const MODEL = "claude-haiku-5-5";
// USD per million tokens for prompts under 100k tokens. Edit if Anthropic changes prices.
const PRICE_IN = 0.10;
const PRICE_OUT = 0.50;
const PRICE_SEARCH = 0.01; // USD per web search
const MAX_SEARCHES = 3;
const TYPES = ["bf", "dal", "side", "fish", "chicken", "egg", "mutton", "vegmain", "cncarb", "cnmain"];

function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "https://banerjeetara-tech.github.io",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-rannaghar-token",
    "Access-Control-Max-Age": "86400",
  };
}
function reply(env, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(env) },
  });
}

// Find the JSON array of dishes in Claude's answer, even if there is other text around it.
function findDishes(text) {
  const tries = [];
  const tag = text.match(/<dishes>([\s\S]*?)<\/dishes>/i);
  if (tag) tries.push(tag[1]);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) tries.push(fence[1]);
  for (const t of tries) {
    try { const v = JSON.parse(t.trim()); if (Array.isArray(v)) return v; } catch {}
  }
  // Try each "[" from the end, so citation brackets earlier in the text do not break parsing.
  const end = text.lastIndexOf("]");
  if (end < 0) return salvage(text);
  for (let i = text.lastIndexOf("[", end); i >= 0; i = text.lastIndexOf("[", i - 1)) {
    try { const v = JSON.parse(text.slice(i, end + 1)); if (Array.isArray(v) && v.length && v[0] && v[0].name) return v; } catch {}
    if (i === 0) break;
  }
  return salvage(text);
}
// Pull every complete {...} dish out of an answer that was cut off.
function salvage(t) {
  const out = []; let depth = 0, start = -1, inStr = false, esc = false;
  const from = Math.max(0, t.search(/<dishes>|\[\s*\{/));
  for (let i = from; i < t.length; i++) {
    const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "{") { if (depth === 0) start = i; depth++; }
    else if (c === "}" && depth > 0) { depth--; if (depth === 0 && start >= 0) { try { const o = JSON.parse(t.slice(start, i + 1)); if (o && o.name) out.push(o); } catch {} start = -1; } }
  }
  return out;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return reply(env, 405, { error: "Use POST" });
    if (!env.APP_TOKEN || request.headers.get("x-rannaghar-token") !== env.APP_TOKEN)
      return reply(env, 401, { error: "Wrong passcode" });
    if (!env.ANTHROPIC_API_KEY) return reply(env, 500, { error: "ANTHROPIC_API_KEY is not set on the Worker" });

    let input;
    try { input = await request.json(); } catch { return reply(env, 400, { error: "Bad request" }); }
    if (input.ping) return reply(env, 200, { ok: true, version: VERSION, model: MODEL });

    // Free-text question: "make a low calorie plan for this week", "what can I cook with paneer", anything.
    if (input.ask) {
      const ask = String(input.ask).slice(0, 1500);
      const context = String(input.context || "").slice(0, 4000);
      const askPrompt =
        `You are the kitchen helper inside Rannaghar, a weekly meal planner used by a Bengali family in Kolkata. ` +
        `Answer the family's request. Home-style Bengali and Indian food first, little oil, no deep frying, unless they ask otherwise.\n` +
        (context ? `What you know about them:\n${context}\n` : "") +
        `Their request: ${ask}\n\n` +
        `Reply in exactly this shape.\n` +
        `<answer>Plain friendly text, at most 150 words, no markdown, no tables. Say what you prepared or answer the question.</answer>\n` +
        `If the request needs dishes, a menu or a diet plan, add after it: <dishes>JSON array</dishes> and nothing else inside the tags. Each element: ` +
        `{"name":string, "day":number 1 to 7 (only for a plan across days; 1 is the first day of their week), "meal":"breakfast"|"lunch"|"dinner", ` +
        `"type":one of ${TYPES.join("|")}, "veg":boolean, "k":kcal per serving (number), "pr":protein grams per serving (number), ` +
        `"ing":[{"n":ingredient name, "q":number for 4 people (0 for spices), "u":"g"|"ml"|"pc"|"bunch"|"pack", ` +
        `"c":"F" fish or meat|"E" eggs|"V" vegetables and fruit|"G" grocery|"P" spices and pantry}], "note":one short sentence for the cook}. ` +
        `At most 5 main ingredients per dish. For a week plan cover every day 1 to 7 with breakfast, lunch and dinner ` +
        `(leave out breakfast only for a fasting plan), each as one complete plate; the same dish may be used on two days. ` +
        `If no dishes are needed, leave out the <dishes> block.`;
      const ar = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: MODEL, max_tokens: 9000, messages: [{ role: "user", content: askPrompt }] }),
      });
      const ad = await ar.json().catch(() => ({}));
      if (!ar.ok) return reply(env, 502, { error: "Claude API: " + ((ad.error && ad.error.message) || "error " + ar.status) });
      const atext = (ad.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
      const am = atext.match(/<answer>([\s\S]*?)(<\/answer>|<dishes>|$)/i);
      const hasDishes = /<dishes>/i.test(atext);
      const answer = (am ? am[1] : atext.replace(/<dishes>[\s\S]*$/i, "")).trim().slice(0, 3000);
      const au = ad.usage || {};
      return reply(env, 200, {
        answer, dishes: hasDishes ? findDishes(atext.slice(atext.search(/<dishes>/i))) : [], version: VERSION,
        usd: ((au.input_tokens || 0) * PRICE_IN + (au.output_tokens || 0) * PRICE_OUT) / 1e6,
        tin: au.input_tokens || 0, tout: au.output_tokens || 0, stop: ad.stop_reason,
      });
    }

    const have = (Array.isArray(input.have) ? input.have : []).slice(0, 600).map(s => String(s).slice(0, 60));
    // A diet plan (low calorie, keto, fasting and so on) replaces the usual free-text wish.
    const diet = String(input.diet || "").slice(0, 700);
    const wish = diet ? "" : String(input.wish || "").slice(0, 300);
    const count = Math.min(25, Math.max(1, parseInt(input.count, 10) || 6));
    const search = input.search === true && !diet; // web search costs about 30 times more, so it is off unless the app asks
    const meal = ["breakfast", "lunch", "dinner"].includes(input.meal) ? input.meal : "any";
    const veg = ["veg", "non"].includes(input.veg) ? input.veg : "both";

    const mealRule = meal === "any"
      ? "Spread them across meals: about a third breakfast, a third lunch and a third dinner."
      : `All of them must suit ${meal}.`;
    const vegRule = veg === "veg" ? "All must be vegetarian (no fish, meat or egg)."
      : veg === "non" ? "All must be non-vegetarian (fish, chicken, egg or mutton)."
      : "Make about half vegetarian and half non-vegetarian.";

    const prompt =
      (search ? "Search the web (Bengali food blogs and recipe sites) and suggest " : "Suggest ") + `${count} home-style dishes for a Bengali family in Kolkata (3-4 people). ` +
      `They must NOT be in this list the family already has: ${have.join("; ")}.\n` +
      (diet
        ? `The family is following this diet plan, and every dish must fit it strictly: ${diet}\nBengali and Indian home food. No deep frying.\n`
        : `Bengali home food first, with the occasional home-made Chinese dish. Every dish must use very little oil and no deep frying.\n`) +
      `${mealRule} ${vegRule}\n` +
      (wish ? `The family also asked for: ${wish}\n` : "") +
      `Put your final answer between <dishes> and </dishes> as a JSON array, and nothing else inside the tags. Each element: ` +
      `{"name":string, "meal":"breakfast"|"lunch"|"dinner", "type":one of ${TYPES.join("|")}, "veg":boolean, ` +
      `"ing":[{"n":ingredient name, "q":number for 4 people (0 for spices), "u":"g"|"ml"|"pc"|"bunch"|"pack", ` +
      `"c":"F" fish or meat|"E" eggs|"V" vegetables and fruit|"G" grocery|"P" spices and pantry}], ` +
      (diet ? `"k":kcal per serving (number), "pr":protein grams per serving (number), "note":one short sentence telling the cook how to make it}. ` : `"note":one short sentence telling the cook how to make it with less oil}. `) +
      `Main ingredients only, at most 7 per dish. ` +
      `Types: bf breakfast, dal, side vegetable side, fish, chicken, egg, mutton, vegmain vegetarian main, cncarb Chinese rice or noodles, cnmain Chinese side dish.`;

    const call = (withSearch) => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: count > 10 ? 9000 : (withSearch ? 5000 : 4000),
        messages: [{ role: "user", content: prompt }],
        ...(withSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }] } : {}),
      }),
    });

    let searched = search;
    let r = await call(search);
    let data = await r.json().catch(() => ({}));
    // If web search is not available for this key or model, still return ideas without it.
    if (!r.ok && r.status === 400 && search) {
      searched = false;
      r = await call(false);
      data = await r.json().catch(() => ({}));
    }
    if (!r.ok) return reply(env, 502, { error: "Claude API: " + ((data.error && data.error.message) || "error " + r.status) });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n");
    const dishes = findDishes(text);

    const u = data.usage || {};
    const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const usd = ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6 + searches * PRICE_SEARCH;
    return reply(env, 200, {
      dishes, usd, searched, searches, version: VERSION,
      tin: u.input_tokens || 0, tout: u.output_tokens || 0,
      stop: data.stop_reason,
      text: dishes.length ? undefined : text.slice(0, 12000),
    });
  },
};
