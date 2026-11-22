const React = require('react');
const { Text } = require('react-native');
function Icon(props) {
  return React.createElement(Text, { style: props.style }, '');
}
Icon.getImageSource = () => Promise.resolve(null);
Icon.loadFont = () => Promise.resolve();
Icon.hasIcon = () => true;
module.exports = { __esModule: true, default: Icon };
