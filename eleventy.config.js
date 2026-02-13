// import dotenv
import "dotenv/config";
//import products from "./src/_data/products.js"; // Use ES module import
import slugify from "slugify";
//for image optimization
import Image from "@11ty/eleventy-img";
//node path module
import path from "path";
import fs from "fs/promises";
import { access } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

function loadPdfPoppler() {
  if (process.platform === "linux") {
    return null;
  }

  try {
    return require("pdf-poppler");
  } catch {
    return null;
  }
}

const pdfPoppler = loadPdfPoppler();

const PDF_SRC_DIR = "./src/assets/medias/pdf";
const PDF_PREGENERATED_SRC_DIR = "./src/assets/medias/pdf-pages";
const PDF_OUTPUT_DIR = "./dist/assets/medias/pdf-pages";
const PDF_OUTPUT_URL = "/assets/medias/pdf-pages";

function normalizePdfFileName(pdfFile, fallbackTag = "") {
  let fileName = pdfFile || fallbackTag || "";
  fileName = String(fileName).trim().replace(/^\/+/, "");

  if (fileName.startsWith("assets/medias/pdf/")) {
    fileName = fileName.replace(/^assets\/medias\/pdf\//, "");
  }

  if (fileName.startsWith("src/assets/medias/pdf/")) {
    fileName = fileName.replace(/^src\/assets\/medias\/pdf\//, "");
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    fileName = `${fileName}.pdf`;
  }

  return fileName;
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectGeneratedPages(outputDir, baseName) {
  const files = await fs.readdir(outputDir).catch(() => []);
  const pageFiles = files
    .filter((file) => file.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return pageFiles.map((file) => `${PDF_OUTPUT_URL}/${baseName}/${file}`);
}

async function collectAvailablePageUrls(baseName) {
  const distPages = await collectGeneratedPages(path.join(PDF_OUTPUT_DIR, baseName), baseName);
  if (distPages.length) {
    return distPages;
  }

  const sourcePages = await collectGeneratedPages(path.join(PDF_PREGENERATED_SRC_DIR, baseName), baseName);
  if (sourcePages.length) {
    return sourcePages;
  }

  return [];
}

async function convertPdfToImages(fileName, options = {}) {
  const scale = options.scale || 1700;

  const pdfInputPath = path.join(PDF_SRC_DIR, fileName);
  const baseName = path.parse(fileName).name;
  const outputDir = path.join(PDF_OUTPUT_DIR, baseName);

  if (!(await fileExists(pdfInputPath))) {
    return collectAvailablePageUrls(baseName);
  }

  await fs.mkdir(outputDir, { recursive: true });
  const existingPages = await collectAvailablePageUrls(baseName);
  if (existingPages.length) {
    return existingPages;
  }

  try {
    if (pdfPoppler && process.platform !== "linux") {
      await pdfPoppler.convert(path.resolve(pdfInputPath), {
        format: "png",
        scale,
        out_dir: path.resolve(outputDir),
        out_prefix: "page",
        page: null,
      });
    } else {
      const outputPrefix = path.resolve(path.join(outputDir, "page"));
      await execFileAsync("pdftocairo", [
        "-png",
        "-scale-to",
        String(scale),
        path.resolve(pdfInputPath),
        outputPrefix,
      ]);
    }

    return collectGeneratedPages(outputDir, baseName);
  } catch (error) {
    console.warn(`[pdfGallery] Conversion impossible for "${fileName}".`);
    if (error instanceof Error) {
      console.warn(`[pdfGallery] Root cause: ${error.message}`);
    }
    return [];
  }
}

export default async function (eleventyConfig) {
  const pdfGalleryCache = new Map();

  // Projects collection
  eleventyConfig.addCollection("projects", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/**/*.md");
  });

  // Optional: separate collections by subfolder
  eleventyConfig.addCollection("projectsDev", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/dev/*.md");
  });
  eleventyConfig.addCollection("projectsDevWeb", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/dev_web/*.md");
  });
  eleventyConfig.addCollection("projectsGraphisme", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/graphisme/*.md");
  });
  eleventyConfig.addCollection("projectsProd", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/prod/*.md");
  });

  // Skills collection
  eleventyConfig.addCollection("skills", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/skills/**/*.md");
  });

  // Add slug filter to slugify product names for URLs
  eleventyConfig.addFilter("slug", (str) => {
    if (!str) return "";
    return slugify(str, {
      lower: true,
      strict: true, // remove special chars
    });
  });

  // Add groupby filter (returns array of [key, items])
  eleventyConfig.addNunjucksFilter("groupby", (array, key) => {
    const map = array.reduce((result, item) => {
      const keyValue = key.split('.').reduce((obj, k) => (obj && obj[k] !== undefined) ? obj[k] : undefined, item);
      const kStr = keyValue == null ? '' : String(keyValue);
      if (!result[kStr]) result[kStr] = [];
      result[kStr].push(item);
      return result;
    }, {});
    return Object.keys(map).map(k => {
      const maybeNum = Number(k);
      return [Number.isNaN(maybeNum) ? k : maybeNum, map[k]];
    });
  });

  // Format month name in French (e.g. "janvier")
  eleventyConfig.addNunjucksFilter("monthFrench", (dateInput, capitalize = false) => {
    const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
    if (isNaN(d)) return "";
    let m = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(d);
    if (capitalize) m = m.charAt(0).toUpperCase() + m.slice(1);
    return m;
  });

  eleventyConfig.addNunjucksAsyncShortcode("img", async function (src, alt, className ="", sizes = "100vw") {
    if (!alt) {
      throw new Error(`Missing ALT text on image: ${src}`);
    }

    const fullSrc = `./${src}`;
    const nameWithoutExt = path.parse(src).name;

    // Each image gets its own folder in dist
    const outputDir = `./dist/assets/medias/img/${nameWithoutExt}/`;
    const urlPath = `/assets/medias/img/${nameWithoutExt}/`;

    let metadata = await Image(fullSrc, {
      widths: [360, 768, 1024, 1440],
      formats: ["webp"],
      outputDir,
      urlPath
    });

    let imageAttributes = {
      alt,
      sizes,
      class: className,
      loading: "lazy",
      decoding: "async",
    };

    return Image.generateHTML(metadata, imageAttributes);
  });

  eleventyConfig.addNunjucksAsyncShortcode(
    "pdfGallery",
    async function (pdfFile, fallbackTag = "", altBase = "Project page") {
      const normalizedName = normalizePdfFileName(pdfFile, fallbackTag);
      const defaultPdf = "test.pdf";

      if (!pdfGalleryCache.has(normalizedName)) {
        pdfGalleryCache.set(normalizedName, convertPdfToImages(normalizedName));
      }

      let pageUrls = await pdfGalleryCache.get(normalizedName);

      if (!pageUrls.length && normalizedName !== defaultPdf) {
        if (!pdfGalleryCache.has(defaultPdf)) {
          pdfGalleryCache.set(defaultPdf, convertPdfToImages(defaultPdf));
        }
        pageUrls = await pdfGalleryCache.get(defaultPdf);
      }

      if (!pageUrls.length) {
        const requestedPdfPath = path.join(PDF_SRC_DIR, normalizedName);
        const hasPdfFile = await fileExists(requestedPdfPath);
        if (hasPdfFile) {
          return `<p class="gallery__empty">PDF trouve mais conversion impossible: ${normalizedName}. Verifie pdf-poppler (win/mac) ou pdftocairo (linux).</p>`;
        }
      return `<p class="gallery__empty">PDF introuvable: ${normalizedName}</p>`;
      }

      return pageUrls
        .map(
          (pageUrl, index) =>
            `<img class="gallery__page" src="${pageUrl}" alt="${altBase} - page ${index + 1}" loading="lazy" decoding="async">`
        )
        .join("");
    }
  );

  // avoid processing and watching files
  eleventyConfig.ignores.add("./src/assets/**/*");
  eleventyConfig.watchIgnores.add("./src/assets/**/*");

  // make sure files are physically copied with --serve
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  // copy files
  eleventyConfig.addPassthroughCopy("./src/assets/fonts");
  //eleventyConfig.addPassthroughCopy("./src/assets/medias"); //-- we don't want to copy all medias unoptimized
  eleventyConfig.addPassthroughCopy("./src/assets/medias/pdf");
  eleventyConfig.addPassthroughCopy("./src/assets/medias/pdf-pages");

  // Eleventy dev server config
  eleventyConfig.setServerOptions({
    port: 3000,
    watch: ["./dist/assets/css/**/*.css", "./dist/assets/js/**/*.js"],
  });
}

export const config = {
  dir: {
    input: "src",
    output: "dist",
  },
};
