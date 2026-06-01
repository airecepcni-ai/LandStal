import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);
const base = "https://landstal.cz";
const runLive = process.argv.includes("--live");
const requiredLandingPages = [
  "diskove-podmitace.html",
  "hloubkove-kyprice.html",
  "seci-kombinace.html",
  "lucni-brany.html",
];
const requiredLandingPaths = requiredLandingPages.map((file) => `/${file.replace(/\.html$/, "")}`);

const failures = [];
const ok = [];

function pass(message) {
  ok.push(message);
}

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function canonicalForHtmlFile(file) {
  if (file === "index.html") return `${base}/`;
  return `${base}/${file.replace(/\.html$/, "")}`;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pathToHtmlFile(pathname) {
  if (pathname === "/") return "index.html";
  return `${pathname.replace(/^\/+/, "").replace(/\/$/, "")}.html`;
}

const files = await readdir(rootPath);
const htmlFiles = files.filter((file) => file.endsWith(".html")).sort();

for (const file of requiredLandingPages) {
  assert(htmlFiles.includes(file), `${file}: required SEO landing page exists`);
}

for (const file of htmlFiles) {
  const html = await readFile(join(rootPath, file), "utf8");
  const canonicalMatches = [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]+)"\s*\/?>/gi)];
  const ogUrlMatches = [...html.matchAll(/<meta\s+property="og:url"\s+content="([^"]+)"\s*\/?>/gi)];
  const titleMatches = [...html.matchAll(/<title>([^<]+)<\/title>/gi)];
  const descriptionMatches = [...html.matchAll(/<meta\s+name="description"\s+content="([^"]+)"\s*\/?>/gi)];
  const h1Matches = [...html.matchAll(/<h1\b[^>]*>/gi)];

  assert(/<html\s+lang="cs"/i.test(html), `${file}: html lang is cs`);
  assert(canonicalMatches.length === 1, `${file}: exactly one canonical tag`);
  assert(titleMatches.length === 1 && titleMatches[0][1].trim().length > 0, `${file}: has one non-empty title`);
  assert(descriptionMatches.length === 1 && descriptionMatches[0][1].trim().length > 0, `${file}: has one meta description`);
  assert(ogUrlMatches.length === 1, `${file}: exactly one og:url`);
  if (requiredLandingPages.includes(file)) {
    assert(h1Matches.length === 1, `${file}: required landing page has exactly one H1`);
  }

  if (canonicalMatches.length === 1) {
    const canonical = canonicalMatches[0][1];
    assert(canonical === canonicalForHtmlFile(file), `${file}: canonical matches clean landstal.cz URL`);
    assert(!/landstal\.(pl|eu)/i.test(canonical), `${file}: canonical does not point to .pl or .eu`);
    assert(canonical === canonical.toLowerCase(), `${file}: canonical URL is lowercase`);
  }

  if (ogUrlMatches.length === 1 && canonicalMatches.length === 1) {
    assert(ogUrlMatches[0][1] === canonicalMatches[0][1], `${file}: og:url matches canonical`);
  }
}

const robots = await readFile(join(rootPath, "robots.txt"), "utf8").catch(() => "");
assert(robots.includes("Sitemap: https://landstal.cz/sitemap.xml"), "robots.txt includes canonical sitemap URL");
assert(!/Disallow:\s*\/\s*$/m.test(robots), "robots.txt does not block the whole site");

const sitemap = await readFile(join(rootPath, "sitemap.xml"), "utf8").catch(() => "");
assert(/^<\?xml/.test(sitemap.trim()), "sitemap.xml starts with XML declaration");
assert(/<urlset[\s>]/.test(sitemap), "sitemap.xml has urlset root");

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
assert(sitemapUrls.length > 0, "sitemap.xml contains URLs");
assert(new Set(sitemapUrls).size === sitemapUrls.length, "sitemap.xml has no duplicate URLs");
assert(sitemapUrls.every((url) => url.startsWith(`${base}/`)), "all sitemap URLs use https://landstal.cz");
assert(sitemapUrls.every((url) => !/[?#]/.test(url)), "sitemap.xml excludes parameter and fragment URLs");
assert(sitemapUrls.every((url) => !/landstal\.(pl|eu)|www\.landstal\.cz/i.test(url)), "sitemap.xml excludes foreign and www URLs");

for (const file of htmlFiles) {
  const expected = canonicalForHtmlFile(file);
  assert(sitemapUrls.includes(expected), `sitemap.xml includes ${expected}`);
}

for (const path of requiredLandingPaths) {
  assert(sitemapUrls.includes(`${base}${path}`), `sitemap.xml includes new landing URL ${base}${path}`);
}

const existingHtmlFiles = new Set(htmlFiles);
for (const file of htmlFiles) {
  const html = await readFile(join(rootPath, file), "utf8");
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/gi)].map((match) => match[1]);
  for (const href of hrefs) {
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const pathname = href.split(/[?#]/)[0];
    const targetFile = pathToHtmlFile(pathname);
    assert(existingHtmlFiles.has(targetFile), `${file}: internal link ${href} resolves to ${targetFile}`);
  }
}

for (const file of ["index.html", "produkty.html"]) {
  const html = await readFile(join(rootPath, file), "utf8");
  for (const path of requiredLandingPaths) {
    const pattern = new RegExp(`href="${escapeRegex(path)}(?:[?#][^"]*)?"`, "i");
    assert(pattern.test(html), `${file}: links to new landing page ${path}`);
  }
}

const vercel = JSON.parse(await readFile(join(rootPath, "vercel.json"), "utf8"));
const wwwRedirect = vercel.redirects?.some((redirect) => {
  return redirect.permanent === true
    && redirect.destination === "https://landstal.cz/:path*"
    && redirect.has?.some((has) => has.type === "host" && has.value === "www.landstal.cz");
});
assert(Boolean(wwwRedirect), "vercel.json has permanent www.landstal.cz to https://landstal.cz redirect");

if (runLive) {
  const liveChecks = [
    ["http apex redirects to https apex", "http://landstal.cz/", "https://landstal.cz/"],
    ["http www redirects to https apex", "http://www.landstal.cz/", "https://landstal.cz/"],
    ["https www redirects to https apex", "https://www.landstal.cz/", "https://landstal.cz/"],
  ];

  for (const [label, input, expected] of liveChecks) {
    const response = await fetch(input, { redirect: "manual" });
    assert([301, 308].includes(response.status), `${label}: permanent redirect status`);
    assert(response.headers.get("location") === expected, `${label}: redirects directly to ${expected}`);
  }

  for (const path of ["/robots.txt", "/sitemap.xml"]) {
    const response = await fetch(`${base}${path}`);
    assert(response.status === 200, `${path} returns 200`);
    if (path === "/sitemap.xml") {
      const body = await response.text();
      assert(/<urlset[\s>]/.test(body), "/sitemap.xml returns valid-looking XML");
    }
  }
}

for (const message of ok) {
  console.log(`PASS ${message}`);
}

if (failures.length) {
  for (const message of failures) {
    console.error(`FAIL ${message}`);
  }
  process.exit(1);
}

console.log(`SEO validation passed (${ok.length} checks).`);
