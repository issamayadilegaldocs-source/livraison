/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-require-imports */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

// eslint-disable-next-line no-undef
const config = getDefaultConfig(__dirname);
const originalResolveRequest = config.resolver.resolveRequest;

const webModuleOverrides = {
  "react-native-maps": path.resolve(__dirname, "stubs/react-native-maps.js"),
  "react-native-maps-directions": path.resolve(
    __dirname,
    "stubs/react-native-maps-directions.js"
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && webModuleOverrides[moduleName]) {
    return { filePath: webModuleOverrides[moduleName], type: "sourceFile" };
  }

  // RN 0.76+ removed the ReactNative renderer shim — redirect to ReactFabric
  if (moduleName === "react-native/Libraries/Renderer/shims/ReactNative") {
    return {
      filePath: path.resolve(
        __dirname,
        "node_modules/react-native/Libraries/Renderer/shims/ReactFabric.js"
      ),
      type: "sourceFile",
    };
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

// config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });
