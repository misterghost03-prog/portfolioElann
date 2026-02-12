// import dotenv
import "dotenv/config";
//import products from "./src/_data/products.js"; // Use ES module import
import slugify from "slugify";
//for image optimization
import Image from "@11ty/eleventy-img"; 
//node path module
import path from "path";

export default async function (eleventyConfig) {
  // Projects collection
  eleventyConfig.addCollection("projects", function (collectionApi) {
    return collectionApi.getFilteredByGlob("./src/projects/*.md");
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

  // avoid processing and watching files
  eleventyConfig.ignores.add("./src/assets/**/*");
  eleventyConfig.watchIgnores.add("./src/assets/**/*");

  // make sure files are physically copied with --serve
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  // copy files
  eleventyConfig.addPassthroughCopy("./src/assets/fonts");
  //eleventyConfig.addPassthroughCopy("./src/assets/medias"); //-- we don't want to copy all medias unoptimized
  eleventyConfig.addPassthroughCopy("./src/assets/medias/video");

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
