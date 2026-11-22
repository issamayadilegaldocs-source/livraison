import { ActivityIndicator } from "react-native";

import { useAuthTheme } from "@/lib/hooks/useAuthTheme";

interface IAuthSpinnerProps {
  backColor?: string;
  spinnerColor?: string;
  size?: "small" | "large";
}

// Ported from enatega-multivendor-app (components/Spinner).
export default function AuthSpinner(props: IAuthSpinnerProps) {
  const { currentTheme } = useAuthTheme();

  return (
    <ActivityIndicator
      animating={true}
      style={{
        flex: 1,
        backgroundColor: props.backColor
          ? props.backColor
          : currentTheme.newheaderColor,
      }}
      size={props.size || "large"}
      color={props.spinnerColor ? props.spinnerColor : currentTheme.white}
    />
  );
}
