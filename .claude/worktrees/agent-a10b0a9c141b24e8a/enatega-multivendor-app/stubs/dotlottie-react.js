const React = require('react');
const { View } = require('react-native');
function DotLottieReact(props) {
  return React.createElement(View, { style: [{ width: 200, height: 200 }, props.style] });
}
module.exports = { __esModule: true, default: DotLottieReact, DotLottieReact };
