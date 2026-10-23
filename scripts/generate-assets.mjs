#!/usr/bin/env node
/**
 * ULTRON // ROGUE CORE — telemetry renderer
 * Fetches public GitHub telemetry and writes theme-native SVG cards.
 *
 * Required env for a live refresh:
 *   GH_TOKEN  GitHub token with public read access (GITHUB_TOKEN works in Actions)
 * Optional:
 *   GH_LOGIN  GitHub login (defaults to mohdziauddin2006-cloud)
 *
 * If the API cannot be reached and assets/data.json exists, the last
 * snapshot is re-rendered instead of failing the workflow.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets");
const DATA_FILE = path.join(ASSETS, "data.json");
const LOGIN = process.env.GH_LOGIN || "mohdziauddin2006-cloud";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "";
const API = "https://api.github.com/graphql";

const C = {
  void: "#04060A",
  bg0: "#0B1017",
  bg1: "#070A0F",
  panel: "#0C1118",
  border: "#29333F",
  borderSoft: "#1A222C",
  steel: "#8B97A5",
  silver: "#D7DEE8",
  white: "#EEF2F6",
  dim: "#5E6A79",
  dim2: "#7C8794",
  red: "#E10600",
  redBright: "#FF2A1A",
  redDeep: "#7A0303",
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

const esc = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const fmtNum = (n) => Number(n || 0).toLocaleString("en-US");
const pad2 = (n) => String(n).padStart(2, "0");

function parseDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

function formatSync(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "AWAITING SIGNAL";
  const date = `${d.getUTCFullYear()}.${pad2(d.getUTCMonth() + 1)}.${pad2(d.getUTCDate())}`;
  return `${date} / ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function percentLabel(pct) {
  if (pct > 0 && pct < 0.1) return "<0.1";
  return pct.toFixed(1);
}

function fitSize(n, sizes) {
  const len = String(n).length;
  if (len <= 3) return sizes[0];
  if (len === 4) return sizes[1];
  return sizes[2];
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function fetchLive(attempt = 1) {
  const query = `
    query UltronTelemetry($login: String!) {
      user(login: $login) {
        login
        name
        bio
        followers { totalCount }
        following { totalCount }
        repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
          totalCount
          nodes {
            name
            stargazerCount
            forkCount
            primaryLanguage { name }
            languages(first: 10) {
              edges { size node { name color } }
            }
          }
        }
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoryContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { date contributionCount }
            }
          }
        }
      }
    }
  `;

  if (!TOKEN) throw new Error("No GH_TOKEN/GITHUB_TOKEN available for a live refresh.");

  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "User-Agent": "ultron-rogue-core-readme-sync",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
      return fetchLive(attempt + 1);
    }
    throw new Error(`GitHub GraphQL responded ${res.status}.`);
  }

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data?.user) throw new Error("GitHub returned no user payload.");
  return json.data.user;
}

function computeStreaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  let index = days.length - 1;
  if (days[index]?.date === today && days[index].contributionCount === 0) index -= 1;

  let current = 0;
  while (index >= 0 && days[index].contributionCount > 0) {
    current += 1;
    index -= 1;
  }

  let longest = 0;
  let running = 0;
  for (const day of days) {
    if (day.contributionCount > 0) {
      running += 1;
      longest = Math.max(longest, running);
    } else {
      running = 0;
    }
  }
  return { current, longest };
}

function buildPayload(user) {
  const repos = user.repositories?.nodes ?? [];
  const calendar = user.contributionsCollection?.contributionCalendar ?? {};
  const weeks = calendar.weeks ?? [];
  const days = weeks.flatMap((week) => week.contributionDays ?? []);
  const langMap = new Map();

  for (const repo of repos) {
    for (const edge of repo.languages?.edges ?? []) {
      const name = edge.node?.name;
      if (!name) continue;
      langMap.set(name, (langMap.get(name) || 0) + Number(edge.size || 0));
    }
  }

  const totalBytes = [...langMap.values()].reduce((sum, size) => sum + size, 0);
  const languages = [...langMap.entries()]
    .map(([name, size]) => ({
      name,
      size,
      percent: totalBytes ? (size / totalBytes) * 100 : 0,
    }))
    .sort((a, b) => b.size - a.size);

  const stars = repos.reduce((sum, repo) => sum + (repo.stargazerCount || 0), 0);
  const forks = repos.reduce((sum, repo) => sum + (repo.forkCount || 0), 0);
  const contributions = calendar.totalContributions || 0;
  const activeDays = days.filter((day) => day.contributionCount > 0).length;
  const { current, longest } = computeStreaks(days);
  const last14 = days.slice(-14);
  const peak = days.reduce(
    (best, day) => (day.contributionCount > best.count ? { count: day.contributionCount, date: day.date } : best),
    { count: 0, date: null },
  );

  const fingerprintSource = JSON.stringify({
    login: user.login,
    contributions,
    commits: user.contributionsCollection?.totalCommitContributions || 0,
    repos: user.repositories?.totalCount || repos.length,
    stars,
    followers: user.followers?.totalCount || 0,
    languages: languages.map((l) => [l.name, l.size]),
    days: days.map((d) => `${d.date}:${d.contributionCount}`),
  });

  return {
    login: user.login,
    generatedAt: new Date().toISOString(),
    profile: {
      name: user.name || "ZIA",
      bio: user.bio || "",
      followers: user.followers?.totalCount || 0,
      following: user.following?.totalCount || 0,
    },
    stats: {
      contributions,
      commits: user.contributionsCollection?.totalCommitContributions || 0,
      pullRequests: user.contributionsCollection?.totalPullRequestContributions || 0,
      issues: user.contributionsCollection?.totalIssueContributions || 0,
      repositories: user.repositories?.totalCount || repos.length,
      stars,
      forks,
      followers: user.followers?.totalCount || 0,
      following: user.following?.totalCount || 0,
      activeDays,
      currentStreak: current,
      longestStreak: longest,
      topLanguage: languages[0]?.name || "NONE",
      totalBytes,
      peak,
    },
    languages,
    weeks,
    last14,
    fingerprint: crypto.createHash("sha1").update(fingerprintSource).digest("hex"),
  };
}

/* ------------------------------------------------------------------ */
/* Shared SVG components                                              */
/* ------------------------------------------------------------------ */

const panelPath = (height) => `M1 1H1152L1199 48V${height - 1}H1Z`;

function commonDefs(height) {
  return `
    <linearGradient id="cardBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0D131B"/>
      <stop offset=".52" stop-color="#080C11"/>
      <stop offset="1" stop-color="#04060A"/>
    </linearGradient>
    <radialGradient id="cardHalo" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#C00606" stop-opacity=".22"/>
      <stop offset=".55" stop-color="#780202" stop-opacity=".08"/>
      <stop offset="1" stop-color="#4A0000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="numGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#F2F5F8"/>
      <stop offset=".55" stop-color="#C4CDD7"/>
      <stop offset="1" stop-color="#737F8D"/>
    </linearGradient>
    <linearGradient id="redGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5E0202"/>
      <stop offset=".45" stop-color="#C40707"/>
      <stop offset="1" stop-color="#FF2A1A"/>
    </linearGradient>
    <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#520101"/>
      <stop offset=".35" stop-color="#9D0606"/>
      <stop offset=".78" stop-color="#E40A0A"/>
      <stop offset="1" stop-color="#FF5A4A"/>
    </linearGradient>
    <linearGradient id="barGradHot" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#7A0202"/>
      <stop offset=".35" stop-color="#C40707"/>
      <stop offset=".76" stop-color="#FF1E12"/>
      <stop offset="1" stop-color="#FF9A8E"/>
    </linearGradient>
    <linearGradient id="dividerGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#38424E" stop-opacity="0"/>
      <stop offset=".5" stop-color="#46515E"/>
      <stop offset="1" stop-color="#38424E" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="redRail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E10600" stop-opacity="0"/>
      <stop offset=".28" stop-color="#E10600" stop-opacity=".8"/>
      <stop offset=".72" stop-color="#E10600" stop-opacity=".8"/>
      <stop offset="1" stop-color="#E10600" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FF2A1A" stop-opacity="0"/>
      <stop offset=".7" stop-color="#FF2A1A" stop-opacity=".06"/>
      <stop offset="1" stop-color="#FF8A7E" stop-opacity=".16"/>
    </linearGradient>
    <linearGradient id="gridSweep" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#FF2A1A" stop-opacity="0"/>
      <stop offset=".5" stop-color="#FF2A1A" stop-opacity=".25"/>
      <stop offset="1" stop-color="#FF2A1A" stop-opacity="0"/>
    </linearGradient>
    <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M24 0H0V24" fill="none" stroke="#1A222C" stroke-width=".55" opacity=".5"/>
      <circle cx="0" cy="0" r=".7" fill="#2B3541" opacity=".45"/>
    </pattern>
    <pattern id="barcode" width="32" height="12" patternUnits="userSpaceOnUse">
      <rect width="32" height="12" fill="none"/>
      <rect x="0" width="2" height="12" fill="#6A7583"/>
      <rect x="5" width="1" height="12" fill="#6A7583"/>
      <rect x="8" width="3" height="12" fill="#6A7583"/>
      <rect x="14" width="1" height="12" fill="#6A7583"/>
      <rect x="18" width="2" height="12" fill="#6A7583"/>
      <rect x="23" width="1" height="12" fill="#6A7583"/>
      <rect x="27" width="3" height="12" fill="#6A7583"/>
    </pattern>
    <filter id="redGlow" x="-120%" y="-120%" width="340%" height="340%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="cardGrain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".85 .06" numOctaves="2" seed="9" result="n"/>
      <feColorMatrix in="n" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer>
    </filter>
    <clipPath id="cardClip"><path d="${panelPath(height)}"/></clipPath>
  `;
}

const commonCss = `
  .reveal { animation: rise .9s cubic-bezier(.16,.8,.24,1) both; }
  .bar { transform-box: fill-box; transform-origin: center bottom; animation: barGrow 1.25s cubic-bezier(.2,.8,.25,1) both; }
  .fillbar { transform-box: fill-box; transform-origin: left center; animation: fillGrow 1.5s cubic-bezier(.16,.8,.24,1) both; }
  .week { animation: cellIn .5s ease both; }
  .pulse { animation: pulse 3.6s ease-in-out infinite; }
  .hot { filter: drop-shadow(0 0 3px rgba(255,42,26,.55)); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  @keyframes fillGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes cellIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pulse { 0%,100% { opacity: .4; } 45% { opacity: 1; } 55% { opacity: .8; } }
  @media (prefers-reduced-motion: reduce) {
    .reveal, .bar, .fillbar, .week, .pulse { animation: none !important; }
  }
`;

function cardShell(height, { title, desc, label, kicker, sync, index, serial, extraDefs = "", body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${height}" width="1200" height="${height}" role="img" aria-labelledby="t d">
  <title id="t">${esc(title)}</title>
  <desc id="d">${esc(desc)}</desc>
  <defs>${commonDefs(height)}${extraDefs}</defs>
  <style>${commonCss}</style>

  <rect width="1200" height="${height}" fill="${C.void}"/>
  <g clip-path="url(#cardClip)">
    <path d="${panelPath(height)}" fill="url(#cardBg)"/>
    <rect width="1200" height="${height}" fill="url(#gridPattern)" opacity=".55"/>
    <ellipse cx="1060" cy="26" rx="380" ry="240" fill="url(#cardHalo)"/>
    <g fill="none" stroke="#1D2631" opacity=".55">
      <path d="M1 92H90M1110 92H1199"/>
      <path d="M32 ${height - 46}H120M1080 ${height - 46}H1168"/>
      <circle cx="1150" cy="${height - 54}" r="24" stroke-dasharray="1 6"/>
      <path d="M1150 ${height - 88}V${height - 78}"/>
    </g>
    <rect width="1200" height="${height}" filter="url(#cardGrain)" opacity=".035"/>

    <!-- header -->
    <g>
      <rect x="32" y="27" width="7" height="7" fill="${C.red}" class="pulse"/>
      <text x="50" y="38" font-family="Arial Black, Impact, sans-serif" font-size="15" font-weight="900" letter-spacing="3.2" fill="${C.silver}">${esc(label)}</text>
      <text x="32" y="55" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2.2" fill="${C.dim}">${esc(kicker)}</text>
      <text x="1128" y="33" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="11" letter-spacing="1.6" fill="#6E7A88">${esc(sync)}</text>
      <text x="1128" y="51" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.8" fill="#7C8795">LIVE // ROGUE CORE ${esc(index)}</text>
      <path d="M1 66H1199" stroke="#232C37"/>
      <path d="M806 66H1128" stroke="url(#redRail)" stroke-width="2"/>
    </g>

    ${body}

    <!-- footer -->
    <g>
      <text x="32" y="${height - 12}" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="8" letter-spacing="2.2" fill="#46515E">ULTRON // ROGUE CORE</text>
      <rect x="1124" y="${height - 24}" width="66" height="11" fill="url(#barcode)" opacity=".55"/>
      <text x="1106" y="${height - 12}" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="8" letter-spacing="1.6" fill="#46515E">${esc(serial)}</text>
    </g>
  </g>

  <path d="${panelPath(height)}" fill="none" stroke="${C.border}"/>
  <g stroke="${C.red}" fill="none" stroke-width="2">
    <path d="M1 34V1H34"/>
    <path d="M1199 ${height - 34}V${height - 1}H1165"/>
  </g>
  <path d="M1152 1H1172L1199 28V48" fill="none" stroke="#4A5563" opacity=".8"/>
  <path d="M1180 29L1199 48" stroke="${C.red}" stroke-width="1.4" opacity=".65"/>
  <g fill="#4A5563" opacity=".7">
    <rect x="1148" y="60" width="2" height="6"/>
    <rect x="1153" y="60" width="1" height="6"/>
    <rect x="1157" y="60" width="3" height="6"/>
    <rect x="1163" y="60" width="1" height="6"/>
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Stats card                                                         */
/* ------------------------------------------------------------------ */

function renderStats(data) {
  const s = data.stats;
  const sync = formatSync(data.generatedAt);
  const density = Math.min(100, (s.contributions / 365) * 100);
  const avg = (s.contributions / 365).toFixed(2);
  const max14 = Math.max(1, ...data.last14.map((d) => d.contributionCount));
  const barX0 = 812;
  const barBase = 228;
  const barW = 20;
  const barGap = 4;
  const chartH = 72;

  const bars = data.last14
    .map((day, i) => {
      const count = day.contributionCount;
      const h = count === 0 ? 3 : Math.max(7, Math.round((count / max14) * chartH));
      const x = barX0 + i * (barW + barGap);
      const fill = count === 0 ? "#1A222C" : "url(#barGrad)";
      return `
        <rect x="${x}" y="156" width="${barW}" height="${chartH}" fill="#10161D"/>
        <rect class="bar" style="animation-delay:${(0.25 + i * 0.04).toFixed(2)}s" x="${x}" y="${barBase - h}" width="${barW}" height="${h}" fill="${fill}"/>
        ${count > 0 ? `<rect x="${x}" y="${barBase - h}" width="${barW}" height="1.4" fill="#FF7A6E" opacity=".8"/>` : ""}
      `;
    })
    .join("");

  const body = `
    <g class="reveal">
      <text x="32" y="105" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10.5" letter-spacing="2.6" fill="#798593">CONTRIBUTIONS / 365D</text>
      <text x="28" y="196" font-family="Arial Black, Impact, sans-serif" font-size="${fitSize(s.contributions, [94, 82, 66])}" font-weight="900" letter-spacing="-2" fill="url(#numGrad)">${fmtNum(s.contributions)}</text>
      <text x="33" y="220" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2.2" fill="#5E6A79">TOTAL RECORDED IMPACT</text>
      <text x="322" y="220" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.6" fill="#A50A0A">AVG ${avg} / DAY</text>
      <rect x="32" y="234" width="290" height="3" fill="#181F28"/>
      <rect x="32" y="234" width="${(density * 2.9).toFixed(1)}" height="3" fill="url(#redGrad)"/>
      <circle cx="${(32 + density * 2.9).toFixed(1)}" cy="235.5" r="2.2" fill="#FF5A4A"/>
    </g>

    <path d="M360 92V254" stroke="url(#dividerGrad)"/>

    <g class="reveal" style="animation-delay:.12s">
      <text x="394" y="107" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="11" letter-spacing="2.2" fill="#677381">COMMITS</text>
      <text x="394" y="144" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="34" font-weight="700" fill="${C.silver}">${fmtNum(s.commits)}</text>
      <rect x="386" y="115" width="2" height="32" fill="#9B0808"/>
      <text x="394" y="205" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="11" letter-spacing="2.2" fill="#677381">STARS EARNED</text>
      <text x="394" y="242" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="34" font-weight="700" fill="${C.silver}">${fmtNum(s.stars)}</text>
      <rect x="386" y="213" width="2" height="32" fill="#5E0202"/>
    </g>

    <g class="reveal" style="animation-delay:.2s">
      <text x="592" y="107" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="11" letter-spacing="2.2" fill="#677381">REPOSITORIES</text>
      <text x="592" y="144" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="34" font-weight="700" fill="${C.silver}">${fmtNum(s.repositories)}</text>
      <rect x="584" y="115" width="2" height="32" fill="#5E0202"/>
      <text x="592" y="205" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="11" letter-spacing="2.2" fill="#677381">FOLLOWERS</text>
      <text x="592" y="242" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="34" font-weight="700" fill="${C.silver}">${fmtNum(s.followers)}</text>
      <rect x="584" y="213" width="2" height="32" fill="#9B0808"/>
    </g>

    <path d="M790 92V254" stroke="url(#dividerGrad)"/>

    <g class="reveal" style="animation-delay:.28s">
      <text x="812" y="106" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2.2" fill="#677381">ACTIVITY VECTOR / 14D</text>
      <text x="1168" y="106" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.4" fill="#8F0A0A">PEAK ${fmtNum(max14)}</text>
      <path d="M812 156H1152M812 228H1152" stroke="#1A222C"/>
      <path d="M812 192H1152" stroke="#151C24" stroke-dasharray="2 7"/>
      ${bars}
      <text x="812" y="254" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.4" fill="#46515E">14 CYCLES AGO</text>
      <text x="1152" y="254" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.4" fill="#46515E">TODAY</text>
    </g>

    <path d="M1 272H1199" stroke="#232C37"/>
    <g class="reveal" style="animation-delay:.36s">
      <g font-family="Consolas, SFMono-Regular, Menlo, monospace">
        <rect x="32" y="292" width="4" height="4" fill="#9B0808"/>
        <text x="44" y="297" font-size="10" letter-spacing="1.8" fill="#677381">ACTIVE DAYS</text>
        <text x="32" y="320" font-size="20" fill="${C.silver}">${fmtNum(s.activeDays)}</text>

        <rect x="210" y="292" width="4" height="4" fill="#9B0808"/>
        <text x="222" y="297" font-size="10" letter-spacing="1.8" fill="#677381">CURRENT STREAK</text>
        <text x="210" y="320" font-size="20" fill="${C.silver}">${pad2(s.currentStreak)} <tspan font-size="10" fill="#6A7684">D</tspan></text>

        <rect x="388" y="292" width="4" height="4" fill="#9B0808"/>
        <text x="400" y="297" font-size="10" letter-spacing="1.8" fill="#677381">LONGEST STREAK</text>
        <text x="388" y="320" font-size="20" fill="${C.silver}">${pad2(s.longestStreak)} <tspan font-size="10" fill="#6A7684">D</tspan></text>

        <rect x="566" y="292" width="4" height="4" fill="#9B0808"/>
        <text x="578" y="297" font-size="10" letter-spacing="1.8" fill="#677381">TOP LANGUAGE</text>
        <text x="566" y="320" font-size="${s.topLanguage.length > 10 ? 12 : 15}" fill="${C.silver}">${esc(s.topLanguage.toUpperCase())}</text>

        <rect x="812" y="292" width="4" height="4" fill="#9B0808"/>
        <text x="824" y="297" font-size="10" letter-spacing="1.8" fill="#677381">SOURCE MASS</text>
        <text x="812" y="320" font-size="15" fill="${C.silver}">${formatBytes(s.totalBytes)}</text>
      </g>
    </g>
  `;

  return cardShell(380, {
    title: "Ultron system telemetry — animated GitHub stats",
    desc: `Live public GitHub stats for ${data.login}: ${s.contributions} contributions, ${s.commits} commits, ${s.repositories} repositories, ${s.stars} stars and ${s.followers} followers.`,
    label: "SYSTEM TELEMETRY",
    kicker: "PUBLIC SIGNAL / CONTRIBUTION DENSITY / IDENTITY VECTOR",
    sync,
    index: "02 / 06",
    serial: "UC-02 / TELEMETRY",
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Language stack card                                                */
/* ------------------------------------------------------------------ */

function renderLanguages(data) {
  const s = data.stats;
  const sync = formatSync(data.generatedAt);
  const rows = data.languages.slice(0, 6);
  const rowTop = 112;
  const rowH = 43;
  const trackX = 300;
  const trackW = 720;
  const maxPct = rows[0]?.percent || 1;

  const rowMarkup = rows
    .map((lang, i) => {
      const y = rowTop + i * rowH;
      const width = Math.max(5, (lang.percent / 100) * trackW);
      const barY = y - 8;
      const pct = percentLabel(lang.percent);
      const delay = 0.2 + i * 0.12;
      const isTop = i === 0;
      return `
        <g class="reveal" style="animation-delay:${(0.08 + i * 0.07).toFixed(2)}s">
          <text x="32" y="${y}" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1" fill="${isTop ? "#FF3B2F" : "#8D0A0A"}">${pad2(i + 1)}</text>
          <text x="66" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="1.2" fill="${C.silver}">${esc(lang.name.toUpperCase())}</text>
          <text x="280" y="${y}" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1" fill="#576271">${formatBytes(lang.size)}</text>
          <rect x="${trackX}" y="${barY}" width="${trackW}" height="10" fill="#10161D" stroke="#1B232D"/>
          <g class="fillbar" style="animation-delay:${delay.toFixed(2)}s">
            <rect x="${trackX}" y="${barY}" width="${width.toFixed(1)}" height="10" fill="url(#${isTop ? "barGradHot" : "barGrad"})"/>
            <rect x="${trackX}" y="${barY}" width="${width.toFixed(1)}" height="1.2" fill="#FF9A8E" opacity="${isTop ? ".85" : ".4"}"/>
          </g>
          <path d="M${(trackX + width).toFixed(1)} ${barY - 2}V${barY + 12}" stroke="${isTop ? "#FF6A5E" : "#7A0707"}" stroke-width="1.2"/>
          <text x="1168" y="${y}" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="20" font-weight="700" fill="${C.silver}">${esc(pct)}<tspan font-size="10" fill="#6A7684">%</tspan></text>
          <path d="M32 ${y + 21}H1168" stroke="#1A222C" stroke-width=".7" opacity=".75"/>
        </g>
      `;
    })
    .join("");

  const ticks = [0.25, 0.5, 0.75]
    .map((p) => `<path d="M${trackX + p * trackW} 150V340" stroke="#151C24" stroke-dasharray="1 7"/>`)
    .join("");

  const body = `
    <g class="reveal">
      <text x="32" y="88" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2.2" fill="#5E6A79">SOURCE COMPOSITION BY BYTES / PUBLIC REPOSITORIES ONLY</text>
      <text x="1168" y="88" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.6" fill="#A50A0A">PRIMARY / ${esc(s.topLanguage.toUpperCase())}</text>
    </g>
    ${ticks}
    ${rowMarkup}
    <g class="reveal" style="animation-delay:.8s">
      <path d="M1 370H1199" stroke="#232C37"/>
      <text x="32" y="398" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2" fill="#677381">SOURCE MASS <tspan fill="${C.silver}">${formatBytes(s.totalBytes)}</tspan></text>
      <text x="432" y="398" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2" fill="#677381">DETECTED <tspan fill="${C.silver}">${pad2(data.languages.length)}</tspan> LANGUAGES</text>
      <text x="1168" y="398" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2" fill="#5E6A79">LOADOUT INDEX 03 / 06</text>
    </g>
  `;

  return cardShell(430, {
    title: "Ultron language stack — neural loadout",
    desc: `Language composition for ${data.login}, led by ${s.topLanguage} at ${percentLabel(rows[0]?.percent ?? 0)} percent.`,
    label: "NEURAL LOADOUT",
    kicker: "LANGUAGE STACK / BYTE MASS / SOURCE COMPOSITION",
    sync,
    index: "03 / 06",
    serial: "UC-03 / LOADOUT",
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Contribution heatmap                                               */
/* ------------------------------------------------------------------ */

function renderHeatmap(data) {
  const s = data.stats;
  const sync = formatSync(data.generatedAt);
  const weeks = data.weeks;
  const gridX = 94;
  const gridY = 132;
  const cell = 14;
  const gap = 4;
  const step = cell + gap;
  const gridW = weeks.length * step - gap;
  const gridH = 7 * step - gap;
  const level = (count) => {
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 11) return 3;
    return 4;
  };
  const fills = ["#121821", "#350707", "#5C0808", "#920909", "#E00A0A"];

  let lastMonth = -1;
  let lastLabelX = -100;
  const monthLabels = [];
  for (let w = 0; w < weeks.length; w++) {
    const day = weeks[w]?.contributionDays?.[0];
    if (!day) continue;
    const date = parseDate(day.date);
    const month = date.getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      const x = gridX + w * step;
      if (x - lastLabelX >= 32) {
        monthLabels.push(`<text x="${x}" y="118" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.4" fill="#5E6A79">${MONTHS[month]}</text>`);
        lastLabelX = x;
      }
    }
  }

  const cells = weeks
    .map((week, w) => {
      const days = week.contributionDays ?? [];
      const rects = days
        .map((day, d) => {
          const x = gridX + w * step;
          const y = gridY + d * step;
          const lv = level(day.contributionCount);
          const fill = fills[lv];
          const stroke = lv === 0 ? "#1B232D" : "none";
          return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="1.6" fill="${fill}" stroke="${stroke}" class="${lv === 4 ? "hot" : ""}"><title>${day.date} — ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title></rect>`;
        })
        .join("");
      return `<g class="week" style="animation-delay:${(0.25 + w * 0.018).toFixed(3)}s">${rects}</g>`;
    })
    .join("");

  const dayLabels = [
    [1, "MON"],
    [3, "WED"],
    [5, "FRI"],
  ]
    .map(
      ([d, label]) =>
        `<text x="${gridX - 14}" y="${gridY + d * step + 10.5}" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1" fill="#5E6A79">${label}</text>`,
    )
    .join("");

  const peak = s.peak?.date ? `${fmtNum(s.peak.count)} / ${MONTHS[parseDate(s.peak.date).getUTCMonth()]} ${parseDate(s.peak.date).getUTCDate()}` : "0";
  const legend = [
    [0, "NULL"],
    [1, "TRACE"],
    [2, "LOW"],
    [3, "HIGH"],
    [4, "PEAK"],
  ]
    .map(
      ([lv, label], i) =>
        `<rect x="1080" y="${157 + i * 20}" width="11" height="11" rx="1.4" fill="${fills[lv]}" stroke="${lv === 0 ? "#1B232D" : "none"}"/><text x="1100" y="${167 + i * 20}" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="8" letter-spacing="1.3" fill="#5E6A79">${label}</text>`,
    )
    .join("");

  const extraDefs = `\n    <clipPath id="gridClip"><rect x="${gridX}" y="${gridY}" width="${gridW}" height="${gridH}"/></clipPath>`;

  const body = `
    <g class="reveal">
      <text x="32" y="88" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="2.2" fill="#5E6A79">PUBLIC ACTIVITY / TRAILING 365 DAYS / UTC</text>
      <text x="1168" y="88" text-anchor="end" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="10" letter-spacing="1.6" fill="#A50A0A">PEAK ${esc(peak)}</text>
    </g>
    <g class="reveal" style="animation-delay:.1s">
      ${monthLabels.join("")}
      ${dayLabels}
      ${cells}
      <g clip-path="url(#gridClip)">
        <rect x="${gridX - 70}" y="${gridY}" width="70" height="${gridH}" fill="url(#gridSweep)" opacity=".25">
          <animate attributeName="x" values="${gridX - 70};${gridX + gridW};${gridX + gridW}" keyTimes="0;.75;1" dur="12s" repeatCount="indefinite"/>
        </rect>
      </g>
      <rect x="${gridX - .5}" y="${gridY - .5}" width="${gridW + 1}" height="${gridH + 1}" fill="none" stroke="#202934"/>
    </g>

    <text x="1080" y="143" font-family="Consolas, SFMono-Regular, Menlo, monospace" font-size="8" letter-spacing="1.8" fill="#677381">SIGNAL DENSITY</text>
    ${legend}

    <path d="M1 286H1199" stroke="#232C37"/>
    <g class="reveal" style="animation-delay:.5s">
      <g font-family="Consolas, SFMono-Regular, Menlo, monospace">
        <text x="32" y="307" font-size="10" letter-spacing="1.8" fill="#677381">CURRENT STREAK</text>
        <text x="32" y="332" font-size="20" fill="${C.silver}">${pad2(s.currentStreak)} <tspan font-size="10" fill="#6A7684">DAYS</tspan></text>

        <text x="210" y="307" font-size="10" letter-spacing="1.8" fill="#677381">LONGEST STREAK</text>
        <text x="210" y="332" font-size="20" fill="${C.silver}">${pad2(s.longestStreak)} <tspan font-size="10" fill="#6A7684">DAYS</tspan></text>

        <text x="388" y="307" font-size="10" letter-spacing="1.8" fill="#677381">ACTIVE DAYS</text>
        <text x="388" y="332" font-size="20" fill="${C.silver}">${fmtNum(s.activeDays)} <tspan font-size="10" fill="#6A7684">/ 365</tspan></text>

        <text x="566" y="307" font-size="10" letter-spacing="1.8" fill="#677381">TOTAL CONTRIBUTIONS</text>
        <text x="566" y="332" font-size="20" fill="${C.silver}">${fmtNum(s.contributions)}</text>

        <text x="812" y="307" font-size="10" letter-spacing="1.8" fill="#677381">CYCLE</text>
        <text x="812" y="332" font-size="20" fill="${C.silver}">${weeks.length}W <tspan font-size="10" fill="#6A7684">/ 365D</tspan></text>
      </g>
    </g>
  `;

  return cardShell(400, {
    title: "Ultron contribution matrix — animated heatmap",
    desc: `Contribution heatmap for ${data.login}: ${s.contributions} contributions across the trailing year, ${s.activeDays} active days and a longest streak of ${s.longestStreak} days.`,
    label: "CONTRIBUTION MATRIX",
    kicker: "DAILY SIGNAL / 53 CYCLES / CONTRIBUTION DENSITY",
    sync,
    index: "04 / 06",
    serial: "UC-04 / MATRIX",
    extraDefs,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  await fs.mkdir(ASSETS, { recursive: true });
  const previous = await readJson(DATA_FILE);
  let data;

  try {
    const user = await fetchLive();
    data = buildPayload(user);
    if (previous?.fingerprint && previous.fingerprint === data.fingerprint && previous.generatedAt) {
      data.generatedAt = previous.generatedAt;
    }
    console.log(`Telemetry refreshed for ${data.login}.`);
  } catch (error) {
    if (!previous) {
      console.error(`Telemetry failed and no cached snapshot exists: ${error.message}`);
      process.exit(1);
    }
    console.warn(`Live telemetry unavailable — re-rendering cached snapshot. (${error.message})`);
    data = previous;
  }

  const stats = renderStats(data);
  const languages = renderLanguages(data);
  const heatmap = renderHeatmap(data);

  await Promise.all([
    fs.writeFile(path.join(ASSETS, "stats.svg"), stats, "utf8"),
    fs.writeFile(path.join(ASSETS, "languages.svg"), languages, "utf8"),
    fs.writeFile(path.join(ASSETS, "heatmap.svg"), heatmap, "utf8"),
    fs.writeFile(DATA_FILE, `${JSON.stringify(data, null, 2)}\n`, "utf8"),
  ]);

  console.log(`Rendered stats, languages and heatmap for ${fmtNum(data.stats.contributions)} contributions.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
