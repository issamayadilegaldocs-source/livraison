// CJS stub for expo-notifications on web — native module unavailable on web
const React = require('react');

const noSub = { remove: () => {} };
const noop = () => Promise.resolve(null);

module.exports = {
  // Handler
  setNotificationHandler: () => {},
  // Listeners
  addNotificationReceivedListener: () => noSub,
  addNotificationResponseReceivedListener: () => noSub,
  addNotificationsDroppedListener: () => noSub,
  removeNotificationSubscription: () => {},
  // Last response hook
  useLastNotificationResponse: () => null,
  // Scheduling
  scheduleNotificationAsync: noop,
  cancelScheduledNotificationAsync: noop,
  cancelAllScheduledNotificationsAsync: noop,
  getAllScheduledNotificationsAsync: () => Promise.resolve([]),
  // Permissions
  getPermissionsAsync: () => Promise.resolve({ status: 'denied', granted: false }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'denied', granted: false }),
  // Token
  getExpoPushTokenAsync: noop,
  getDevicePushTokenAsync: noop,
  // Badge
  getBadgeCountAsync: () => Promise.resolve(0),
  setBadgeCountAsync: noop,
  // Channels (Android)
  setNotificationChannelAsync: noop,
  getNotificationChannelsAsync: () => Promise.resolve([]),
  deleteNotificationChannelAsync: noop,
  // Misc
  dismissAllNotificationsAsync: noop,
  getPresentedNotificationsAsync: () => Promise.resolve([]),
  AndroidImportance: { DEFAULT: 3, HIGH: 4, LOW: 2, MAX: 5, MIN: 1, NONE: 0, UNSPECIFIED: -1 },
};
