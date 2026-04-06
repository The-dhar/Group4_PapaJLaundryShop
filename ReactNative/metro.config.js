// Force jspdf to the browser ESM build. Expo Router web + SSR can resolve the
// package "node" export (jspdf.node.min.js) and fail on dynamic require(["html2canvas"], …).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const jspdfEsMin = path.resolve(projectRoot, "node_modules/jspdf/dist/jspdf.es.min.js");

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "jspdf") {
    return { filePath: jspdfEsMin, type: "sourceFile" };
  }
  // Some graphs request the node file by full package subpath
  if (
    moduleName === "jspdf/dist/jspdf.node.min.js" ||
    moduleName === "jspdf/dist/jspdf.node.min"
  ) {
    return { filePath: jspdfEsMin, type: "sourceFile" };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
