import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const rootPath = fileURLToPath(new URL("../", import.meta.url));
const topLevelSlugs = [
  "produkty",
  "o-nas",
  "kontakt",
  "diskove-podmitace",
  "hloubkove-kyprice",
  "seci-kombinace",
  "lucni-brany",
  "soil-breaking",
  "deep-stubble-cultivation",
  "ploughing",
  "podmitac-3m",
  "diskovy-podmitac-bt",
  "nexion",
  "plantcare",
  "valec-wps",
];
const directoryPaths = [
  "blog",
  "blog/jak-vybrat-diskovy-podmitac",
  "blog/kdy-pouzit-hloubkovy-kypric",
  "blog/lucni-brany-regenerace-pastvin",
  "blog/diskovy-podmitac-vs-radlickovy-kypric",
  "blog/jaky-pracovni-zaber-podle-vykonu-traktoru",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectHtmlFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(relative(rootPath, fullPath).replaceAll(sep, "/"));
    }
  }

  return files;
}

function normalizeUrls(contents) {
  let normalized = contents;

  for (const slug of topLevelSlugs) {
    const escapedSlug = escapeRegex(slug);
    normalized = normalized
      .replace(
        new RegExp(`https://landstal\\.cz/${escapedSlug}(?=["<\\s?#]|$)`, "g"),
        `https://landstal.cz/${slug}.html`,
      )
      .replace(
        new RegExp(`href="/${escapedSlug}(?=["?#])`, "g"),
        `href="/${slug}.html`,
      );
  }

  for (const directoryPath of directoryPaths) {
    const escapedPath = escapeRegex(directoryPath);
    normalized = normalized
      .replace(
        new RegExp(`https://landstal\\.cz/${escapedPath}(?=["<\\s?#]|$)`, "g"),
        `https://landstal.cz/${directoryPath}/`,
      )
      .replace(
        new RegExp(`href="/${escapedPath}(?=["?#])`, "g"),
        `href="/${directoryPath}/`,
      );
  }

  return normalized;
}

const blogFiles = await collectHtmlFiles(join(rootPath, "blog"));
const publishedHtmlFiles = [
  "index.html",
  ...topLevelSlugs.map((slug) => `${slug}.html`),
  ...blogFiles,
];
const filesToNormalize = [...publishedHtmlFiles, "sitemap.xml"];
const changedFiles = [];

for (const file of filesToNormalize) {
  const path = join(rootPath, file);
  const before = await readFile(path, "utf8");
  const after = normalizeUrls(before);

  if (after !== before) {
    await writeFile(path, after, "utf8");
    changedFiles.push(file);
  }
}

console.log(`Normalized ${changedFiles.length} published files for GitHub Pages.`);
for (const file of changedFiles) {
  console.log(file);
}
