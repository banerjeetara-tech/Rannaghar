// Rannaghar ideas worker (Cloudflare Workers)
// Holds your Anthropic API key so it never sits in the app or on GitHub.
//
// Secrets to set in Cloudflare (Settings > Variables and Secrets):
//   ANTHROPIC_API_KEY  your key from console.anthropic.com
//   APP_TOKEN          any passcode you choose; type the same one in the app
// Optional plain variable:
//   ALLOWED_ORIGIN     defaults to https://banerjeetara-tech.github.io

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

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(env) });
    if (request.method !== "POST") return reply(env, 405, { error: "Use POST" });
    if (!env.APP_TOKEN || request.headers.get("x-rannaghar-token") !== env.APP_TOKEN)
      return reply(env, 401, { error: "Wrong passcode" });
    if (!env.ANTHROPIC_API_KEY) return reply(env, 500, { error: "API key not set on the worker" });

    let input;
    try { input = await request.json(); } catch { return reply(env, 400, { error: "Bad request" }); }
    const have = (Array.isArray(input.have) ? input.have : []).slice(0, 300).map(s => String(s).slice(0, 60));
    const wish = String(input.wish || "").slice(0, 200);
    const count = Math.min(8, Math.max(1, parseInt(input.count, 10) || 5));

    const prompt =
      `Search the web (Bengali food blogs and recipe sites) and suggest ${count} home-style dishes for a Bengali family in Kolkata (3-4 people) that are NOT already in this list: ${have.join("; ")}.\n` +
      `Mostly non-vegetarian Bengali food, with an occasional home-made Chinese or vegetarian dish. Every dish must use very little oil and no deep frying.\n` +
      (wish ? `The family asked for: ${wish}\n` : "") +
      `Return ONLY a JSON array, no other text. Each element: {"name":string, "type":one of ${TYPES.join("|")}, "veg":boolean, ` +
      `"ing":[{"n":ingredient name, "q":number for 4 people (0 for spices), "u":"g"|"ml"|"pc"|"bunch"|"pack", ` +
      `"c":"F" fish or meat|"E" eggs|"V" vegetables and fruit|"G" grocery|"P" spices and pantry}], ` +
      `"note":one or two short sentences telling the cook how to make it with less oil}. Main ingredients only, at most 7 per dish. ` +
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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        ...(withSearch ? { tools: [{ type: "web_search_20250305", name: "web_search", max_uses: MAX_SEARCHES }] } : {}),
      }),
    });
    let searched = true;
    let r = await call(true);
    let data = await r.json().catch(() => ({}));
    // If web search is switched off for this API key, still return ideas without it.
    if (!r.ok && r.status === 400 && /tool|search/i.test((data.error && data.error.message) || "")) {
      searched = false;
      r = await call(false);
      data = await r.json().catch(() => ({}));
    }
    if (!r.ok) return reply(env, 502, { error: (data.error && data.error.message) || "Claude API error " + r.status });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    const m = text.match(/\[[\s\S]*\]/);
    let dishes = [];
    try { dishes = m ? JSON.parse(m[0]) : []; } catch { dishes = []; }

    const u = data.usage || {};
    const searches = (u.server_tool_use && u.server_tool_use.web_search_requests) || 0;
    const usd = ((u.input_tokens || 0) * PRICE_IN + (u.output_tokens || 0) * PRICE_OUT) / 1e6 + searches * PRICE_SEARCH;
    return reply(env, 200, { dishes, usd, searched, searches });
  },
};
