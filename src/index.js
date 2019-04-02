'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
const path = require('path'),
  minify = require('html-minifier').minify,
  loaderUtils = require("loader-utils");

function miniXmlLoader(source) {
  const importReg = /<[(import|include|wxs|import\-sjs)][\s\S]*?src=[\"|\']([^\"]*?)[\"|\'][\s\S]*?>/gi,
    varInputReg = /\{\{[\s\S]*?\}\}/gi;
  let result = [],
    importArr = [];
  while (result = importReg.exec(source)) {
    let pathurl = result[1];
    if (pathurl.search(varInputReg) < 0) {
      importArr.push(pathurl);
    }
  }

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
  return getRequire(this.resourcePath, importArr);
};

function getRequire(resourcePath, importArr = []) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  let str = '',
    urlCache = {};
  importArr.forEach(importUrl => {
    let isRootUrl = importUrl.indexOf('\/') === 0,
      sourceUrl = path.join(srcDir, importUrl);
    if (!isRootUrl) {
      sourceUrl = path.resolve(fileDir, importUrl);
    }
    if (!urlCache[sourceUrl]) {
      str += `require('./${path.relative(fileDir, sourceUrl).split(path.sep).join('/')}');`;
      urlCache[sourceUrl] = true;
    }
  });
  urlCache = {};
  return str;
}

function getRequireDir(resourcePath) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}
/**
 * xml minifier
 */
function setXmlMinify(content = '') {
  return minify(content, {
    removeComments: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    sortAttributes: true
  });
}

exports.default = miniXmlLoader;
