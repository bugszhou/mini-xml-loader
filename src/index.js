'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
const { existsSync, readFileSync } = require('fs');
const path = require('path'),
  isUrl = require('is-url'),
  minify = require('html-minifier').minify,
  HTML = require('html-parse-stringify2'),
  loaderUtils = require("loader-utils"),
  fallbackFn = require('./utils/index');
const { node } = require('webpack');

function miniXmlLoader(source) {
  const varInputReg = /\{\{[\s\S]*?\}\}*/gi;
  let result = [],
    miniJs = [],
    importArr = [];
  let ast = HTML.parse(source);
  const srcData = getSources(ast);
  miniJs = srcData.miniJs;
  importArr = srcData.importArr;

  const options = loaderUtils.getOptions(this) || {};

  const context = options.context || this.rootContext;

  const url = loaderUtils.interpolateName(this, path.join(getRequireDir(this.resourcePath), options.filename), {
    context,
    source,
    regExp: options.regExp,
  });

  let outputPath = url;

  if (options.outputPath) {
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    this.emitFile(outputPath, options.minimize ? setXmlMinify(source) : source);
  }
  let miniJsStr = '';
  if (miniJs.length && options.fallback) {
    const { urls } = getRequire(this.resourcePath, miniJs);
    miniJsStr = urls.map((url) => {
      return `require('${fallbackFn(url, options.fallback)}');`;
    }).join('');
  }
  return getRequire(this.resourcePath, importArr).str + miniJsStr;
};

function getRequire(resourcePath, importArr = []) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  let str = '',
    urls = [],
    urlCache = {};
  importArr.forEach(importUrl => {
    let isRootUrl = importUrl.indexOf('\/') === 0,
      sourceUrl = path.join(srcDir, importUrl);
    if (!isRootUrl) {
      sourceUrl = path.resolve(fileDir, importUrl);
    }
    if (!urlCache[sourceUrl]) {
      const relativeUrl = `./${path.relative(fileDir, sourceUrl).split(path.sep).join('/')}`;
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
    srcName = relativePath.split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}

function getNodeModulesSource(resourcePath) {
  const nodeModulesPath = path.resolve(process.cwd(), "node_modules");
  const moduleRelativePath = path.relative(nodeModulesPath, resourcePath);
  const urls = moduleRelativePath.split("/");
  let jsonData = {};
  let ind = 1;
  if (existsSync(path.resolve(nodeModulesPath, urls[0], "package.json"))) {
    try {
      jsonData = JSON.parse(readFileSync(path.resolve(nodeModulesPath, urls[0], "package.json")).toString());
      ind = 1;
    } catch (e) {
      throw e;
    }
  } else {
    try {
      jsonData = JSON.parse(readFileSync(path.resolve(nodeModulesPath, urls[0], urls[1], "package.json")).toString());
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
function setXmlMinify(content = '') {
  return minify(content, {
    keepClosingSlash: true,
    removeComments: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    sortAttributes: true,
    caseSensitive: true,
    ignoreCustomFragments: [ /\{\{[\s\S]*?\}\}/ ],
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
      if (source.type === 'js') {
        sources.miniJs.push(source.url);
      } else if(source.url) {
        sources.importArr.push(source.url);
      }
      if (node.children && Array.isArray(node.children)) {
        return forEach(node.children);
      }
    });
  }

  function getSource(node = {}) {
    switch (node.name) {
      case 'image':
      case 'cover-image':
      case 'filter':
      case 'import':
      case 'include':
      case 'wxs':
        return getValue(node.attrs.src);
        break;
      case 'import-sjs':
        return getValue(node.attrs.from);
        break;
    }
    return {
      type: '',
      url: '',
    };
  }

  function getValue(pathname = '') {
    const varInputReg = /\{\{[\s\S]*?\}\}*/gi;
    if (/^(data\:)|^(\<svg)/.test(pathname)) {
      return {
        type: '',
        url: '',
      };
    }
    if (pathname.search(varInputReg) < 0 && !isUrl(pathname)) {
      if (/\.(js)$/.test(pathname)) {
        return {
          type: 'js',
          url: pathname,
        };
      } else {
        return {
          type: 'other',
          url: pathname,
        };
      }
    }
    return {
      type: '',
      url: '',
    };
  }

  return sources;
}

exports.default = miniXmlLoader;
