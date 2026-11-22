module.exports = {
  dependencies: {
    // Pulled in transitively by react-native-star-rating (itself only used via a
    // commented-out import). Its 2017-era build.gradle uses jcenter()/compile and
    // breaks under modern Gradle. The app uses @expo/vector-icons instead, so
    // exclude this native module from autolinking.
    'react-native-vector-icons': {
      platforms: {
        android: null,
        ios: null,
      },
    },
    'react-native-star-rating': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
