const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Forces Kotlin stdlib to the latest cached version (2.2.20) to avoid
 * downloading 2.2.21 which fails due to SSL certificate issues on this machine.
 * AGP 8.12.0 resolves kotlin-stdlib:2.2.21 transitively, but 2.2.20 is compatible.
 */
const withKotlinResolution = (config) => {
  return withAppBuildGradle(config, (config) => {
    const resolutionBlock = `
configurations.all {
  resolutionStrategy.eachDependency { details ->
    if (details.requested.group == 'org.jetbrains.kotlin' && details.requested.name.startsWith('kotlin-')) {
      def cached = ['2.2.20', '2.1.21', '2.1.20']
      if (cached.any { details.requested.version == '2.2.21' }) {
        details.useVersion '2.2.20'
        details.because 'kotlin-stdlib 2.2.21 unavailable locally due to SSL; 2.2.20 is ABI-compatible'
      }
    }
  }
}
`;
    if (!config.modResults.contents.includes("resolutionStrategy.eachDependency")) {
      config.modResults.contents = config.modResults.contents.replace(
        "android {",
        resolutionBlock + "\nandroid {"
      );
    }
    return config;
  });
};

module.exports = withKotlinResolution;
