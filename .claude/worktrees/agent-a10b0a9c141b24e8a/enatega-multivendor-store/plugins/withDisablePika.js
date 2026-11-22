const { withGradleProperties } = require("expo/config-plugins");

/**
 * 1. Disables pika compile-time optimization to prevent LazyKType NoClassDefFoundError.
 *    When pika's Kotlin IR plugin runs but fails to generate LazyKType, the compiled
 *    bytecode has unresolvable references. The fallback typeOf<T>() path is safe.
 *
 * 2. Switches the Gradle JVM to use the Windows system SSL trust store so that
 *    antivirus SSL inspection doesn't break Maven/Gradle dependency downloads.
 *    Windows-ROOT includes every CA cert trusted by the OS, including any cert
 *    injected by Kaspersky / Avast / etc.
 */
const withDisablePika = (config) => {
  return withGradleProperties(config, (config) => {
    // --- pika fix ---
    config.modResults = config.modResults.filter(
      (item) => item.key !== "expo.enableCompileTimeOptimization"
    );
    config.modResults.push({
      type: "property",
      key: "expo.enableCompileTimeOptimization",
      value: "false",
    });

    // --- SSL fix: patch org.gradle.jvmargs to add Windows trust store ---
    const jvmArgsEntry = config.modResults.find(
      (item) => item.key === "org.gradle.jvmargs"
    );
    const SSL_FLAG = "-Djavax.net.ssl.trustStoreType=Windows-ROOT";
    if (jvmArgsEntry) {
      if (!jvmArgsEntry.value.includes(SSL_FLAG)) {
        jvmArgsEntry.value = jvmArgsEntry.value + " " + SSL_FLAG;
      }
    } else {
      config.modResults.push({
        type: "property",
        key: "org.gradle.jvmargs",
        value: SSL_FLAG,
      });
    }

    return config;
  });
};

module.exports = withDisablePika;
