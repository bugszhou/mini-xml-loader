"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true,
});
const { existsSync, readFileSync } = require("fs");
const path = require("path"),
  isUrl = require("is-url"),
  minify = require("html-minifier").minify,
  HTML = require("html-parse-stringify2"),
  loaderUtils = require("loader-utils"),
  fallbackFn = require("./utils/index");

const configPath = path.join(process.cwd(), "src/templates.json");
const root = path.join(process.cwd(), "src");

function miniXmlLoader(source) {
  const varInputReg = /\{\{[\s\S]*?\}\}*/gi;
  let result = [],
    miniJs = [],
    importArr = [];

  const options = loaderUtils.getOptions(this) || {};

  const context = options.context || this.rootContext;

  const url = loaderUtils.interpolateName(
    this,
    path.join(getRequireDir(this.resourcePath), options.filename),
    {
      context,
      source,
      regExp: options.regExp,
    },
  );

  let config = Object.create(null);
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath).toString() || "{}");
  }

  const templates =
    config.ignore === true ? "" : addGlobalTemplates(this.resourcePath, config);

  source = `${source}\n${templates}`;

  let ast = HTML.parse(source);
  const srcData = getSources(ast);
  miniJs = srcData.miniJs;
  importArr = srcData.importArr;

  let outputPath = url;

  if (options.outputPath) {
    if (typeof options.outputPath === "function") {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  if (typeof options.emitFile === "undefined" || options.emitFile) {
    this.emitFile(outputPath, options.minimize ? setXmlMinify(source) : source);
  }
  let miniJsStr = "";
  if (miniJs.length && options.fallback) {
    const { urls } = getRequire(this.resourcePath, miniJs);
    miniJsStr = urls
      .map((url) => {
        return `require('${fallbackFn(url, options.fallback)}');`;
      })
      .join("");
  }
  return getRequire(this.resourcePath, importArr).str + miniJsStr;
}

/**
 * @param {sring} pathUrl
 * @param {{loaders: {test: string, templates: {path:string}[]}[]}} config
 * @return {string}
 */
function addGlobalTemplates(pathUrl, config) {
  if (!config || !Array.isArray(config.loaders)) {
    return [];
  }

  /** @type {{path: string}[]} */
  let configTemplates = [];
  config.loaders
    .filter((item) => {
      /** @type {string[]} */
      const testes = Array.isArray(item.test) ? item.test : [item.test];

      return testes.every((test) => {
        const isNot = startWith(test, "!");
        const regStr = isNot ? test.replace("!", "") : test;
        const reg = new RegExp(regStr);

        return isNot ? !reg.test(pathUrl) : reg.test(pathUrl);
      });
    })
    .forEach((item) => {
      configTemplates = configTemplates.concat(item.templates);
    });

  const templates = configTemplates
    .map((item) => {
      if (!item || !item.path) {
        return "";
      }

      if (startWith(item.path, ".")) {
        return item.path.replace(".", "");
      }

      if (!startWith(item.path, "/")) {
        return `/${item.path}`;
      }

      return item.path;
    })
    .filter((item) => item && item !== pathUrl)
    .map((item) => {
      return `<include src="${item}" ></include>`;
    });

  return templates.join("\n") || "";
}

/** @param {string} source @param {string} str */
function startWith(source, str) {
  const index = source.indexOf(str);

  return index === 0;
}

function getRequire(resourcePath, importArr = []) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || "src",
    srcDir = path.resolve(process.cwd(), srcName);

  let str = "",
    urls = [],
    urlCache = {};
  importArr.forEach((importUrl) => {
    let isRootUrl = importUrl.indexOf("/") === 0,
      sourceUrl = path.join(srcDir, importUrl);
    if (!isRootUrl) {
      sourceUrl = path.resolve(fileDir, importUrl);
    }
    if (!urlCache[sourceUrl]) {
      const relativeUrl = `./${path
        .relative(fileDir, sourceUrl)
        .split(path.sep)
        .join("/")}`;
      urls.push(relativeUrl);
      str += `require('${relativeUrl}');`;
      urlCache[sourceUrl] = true;
    }
  });
  urlCache = {};
  return {
    str,
    urls,
  };
}

function getRequireDir(resourcePath) {
  let tmpPath = resourcePath;
  if (tmpPath.includes("node_modules")) {
    tmpPath = getNodeModulesSource(resourcePath);
  }
  const fileDir = path.dirname(tmpPath),
    relativePath = path.relative(process.cwd(), fileDir),
    srcName = relativePath.split(path.sep)[0] || "src",
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}

function getNodeModulesSource(resourcePath) {
  const nodeModulesPath = path.resolve(process.cwd(), "node_modules");
  const moduleRelativePath = path.normalize(
    path.relative(nodeModulesPath, resourcePath),
  );
  const urls = moduleRelativePath.split(path.sep);
  let jsonData = {};
  let ind = 1;
  if (existsSync(path.resolve(nodeModulesPath, urls[0], "package.json"))) {
    try {
      jsonData = JSON.parse(
        readFileSync(
          path.resolve(nodeModulesPath, urls[0], "package.json"),
        ).toString(),
      );
      ind = 1;
    } catch (e) {
      throw e;
    }
  } else {
    try {
      jsonData = JSON.parse(
        readFileSync(
          path.resolve(nodeModulesPath, urls[0], urls[1], "package.json"),
        ).toString(),
      );
      ind = 2;
    } catch (e) {
      throw e;
    }
  }
  if (!jsonData.miniprogram && !jsonData.files) {
    return resourcePath;
  }
  let libNames = [];
  if (Array.isArray(jsonData.files)) {
    libNames = [...jsonData.files, jsonData.miniprogram || ""];
  } else {
    libNames = [jsonData.files, jsonData.miniprogram || ""];
  }

  // if (libNames.includes(urls[ind])) {
  //   return path.resolve(nodeModulesPath, urls.join("/"));
  // }
  urls.splice(ind, 1, "");
  return path.resolve(nodeModulesPath, urls.join("/"));
}

/**
 * xml minifier
 */
function setXmlMinify(content = "") {
  return minify(content, {
    keepClosingSlash: true,
    removeComments: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    sortAttributes: true,
    caseSensitive: true,
    ignoreCustomFragments: [/\{\{[\s\S]*?\}\}/],
  });
}

/**
 * 获取静态资源
 */
function getSources(ast = []) {
  if (!ast) {
    ast = [];
  }
  const sources = {
    importArr: [],
    miniJs: [],
  };
  forEach(ast);
  function forEach(ast) {
    ast.forEach((node) => {
      const source = getSource(node);
      if (source.type === "js") {
        sources.miniJs.push(source.url);
      } else if (source.url) {
        sources.importArr.push(source.url);
      }
      if (node.children && Array.isArray(node.children)) {
        return forEach(node.children);
      }
    });
  }

  function getSource(node = {}) {
    switch (node.name) {
      case "image":
      case "cover-image":
      case "filter":
      case "import":
      case "include":
      case "wxs":
        return getValue(node.attrs.src);
        break;
      case "import-sjs":
        return getValue(node.attrs.from);
        break;
    }
    return {
      type: "",
      url: "",
    };
  }

  function getValue(pathname = "") {
    const varInputReg = /\{\{[\s\S]*?\}\}*/gi;
    if (/^(data\:)|^(\<svg)/.test(pathname)) {
      return {
        type: "",
        url: "",
      };
    }
    if (pathname.search(varInputReg) < 0 && !isUrl(pathname)) {
      if (/\.(js)$/.test(pathname)) {
        return {
          type: "js",
          url: pathname,
        };
      } else {
        return {
          type: "other",
          url: pathname,
        };
      }
    }
    return {
      type: "",
      url: "",
    };
  }

  return sources;
}

exports.default = miniXmlLoader;
