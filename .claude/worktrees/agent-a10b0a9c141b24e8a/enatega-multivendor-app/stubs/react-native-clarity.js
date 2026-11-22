// CJS stub for @microsoft/react-native-clarity on web — uses NativeModules at module load time
const LogLevel = { None: 0, Verbose: 1, Warning: 2, Error: 3 };
const noop = () => Promise.resolve();
module.exports = {
  LogLevel,
  initialize: noop,
  pause: noop,
  resume: noop,
  isPaused: noop,
  getCurrentSessionId: noop,
  getCurrentSessionUrl: noop,
  setCustomTag: noop,
  setCustomTags: noop,
  setCustomUserId: noop,
  setCustomSessionId: noop,
  setCurrentScreenName: noop,
  sendCustomEvent: noop,
  startNewSession: noop,
  setOnSessionStartedCallback: noop,
};
