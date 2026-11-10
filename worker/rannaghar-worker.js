// Rannaghar ideas worker (Cloudflare Workers), version 3
// Holds your Anthropic API key so it never sits in the app or on GitHub.
//
// Secrets to set in Cloudflare (Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY  your key from console.anthropic.com
//   APP_TOKEN          any passcode you choose; type the same one in the app
// Optional plain variable:
//   ALLOWED_ORIGIN     defaults to https://banerjeetara-tech.github.io

const VERSION = 3;
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
  if (end < 0) return [];
  for (let i = text.lastIndexOf("[", end); i >= 0; i = text.lastIndexOf("[", i - 1)) {
    try { const v = JSON.parse(text.slice(i, end + 1)); if (Array.isArray(v) && v.length && typeof v[0] === "object") return v; } catch {}
    if (i === 0) break;
  }
  return [];
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

    const have = (Array.isArray(input.have) ? input.have : []).slice(0, 400).map(s => String(s).slice(0, 60));
    const wish = String(input.wish || "").slice(0, 300);
    const count = Math.min(8, Math.max(1, parseInt(input.count, 10) || 6));
    const search = input.search === true; // web search costs about 30 times more, so it is off unless the app asks
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
      `Bengali home food first, with the occasional home-made Chinese dish. Every dish must use very little oil and no deep frying.\n` +
      `${mealRule} ${vegRule}\n` +
      (wish ? `The family also asked for: ${wish}\n` : "") +
      `Put your final answer between <dishes> and </dishes> as a JSON array, and nothing else inside the tags. Each element: ` +
      `{"name":string, "meal":"breakfast"|"lunch"|"dinner", "type":one of ${TYPES.join("|")}, "veg":boolean, ` +
      `"ing":[{"n":ingredient name, "q":number for 4 people (0 for spices), "u":"g"|"ml"|"pc"|"bunch"|"pack", ` +
      `"c":"F" fish or meat|"E" eggs|"V" vegetables and fruit|"G" grocery|"P" spices and pantry}], ` +
      `"note":one short sentence telling the cook how to make it with less oil}. Main ingredients only, at most 7 per dish. ` +
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
        max_tokens: withSearch ? 4000 : 2500,
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
      stop: data.stop_reason,
      text: dishes.length ? undefined : text.slice(0, 3000),
    });
  },
};
