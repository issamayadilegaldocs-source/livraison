import { useMutation } from "@apollo/client";
import { Alert, Platform } from "react-native";
import { MARK_ORDER_PREPARED } from "../api/graphql/mutation/order";

export default function useMarkOrderPrepared() {
  const [mutate, { loading, error }] = useMutation(MARK_ORDER_PREPARED, {
    // A silent failure here left the order visually stuck on ACCEPTED with no
    // feedback — always surface the error (Alert.alert is a no-op on web).
    onError: (e) => {
      if (Platform.OS === "web") {
        (globalThis as any).alert?.(`Erreur: ${e.message}`);
      } else {
        Alert.alert("Erreur", e.message);
      }
    },
  });

  const markPrepared = (_id: string) => mutate({ variables: { _id } });

  return { loading, error, markPrepared };
}
