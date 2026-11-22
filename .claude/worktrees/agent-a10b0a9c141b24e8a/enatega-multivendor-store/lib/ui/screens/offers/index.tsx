// Context
import { useApptheme } from "@/lib/context/theme.context";

// Components
import { CustomContinueButton } from "@/lib/ui/useable-components";

// GraphQL
import { MY_OFFERS } from "@/lib/api/graphql/query/offer";
import { CREATE_OFFER, CANCEL_OFFER } from "@/lib/api/graphql/mutation/offer";

// Hooks
import { useMutation, useQuery } from "@apollo/client";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// Core
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { showMessage } from "react-native-flash-message";

interface IStoreOffer {
  _id: string;
  title?: string;
  type: string;
  value: number;
  startsAt: string;
  endsAt: string;
  scope?: string;
  minOrderAmount?: number;
  maxDiscount?: number;
  enabled?: boolean;
  active?: boolean;
}

// Lightweight UUID v4 for the create Idempotency-Key (dedupes double-taps).
function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatWindow(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  return `${s.toLocaleString()} → ${e.toLocaleString()}`;
}

export default function OffersScreen() {
  // Hooks
  const { appTheme } = useApptheme();
  const { t } = useTranslation();

  // Form state
  const [type, setType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [durationHours, setDurationHours] = useState("6");
  const [title, setTitle] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxDiscount, setMaxDiscount] = useState("");
  const idempotencyKey = useRef(uuidv4());

  // Data
  const { data, loading } = useQuery(MY_OFFERS, {
    fetchPolicy: "cache-and-network",
  });

  const [createOffer, { loading: creating }] = useMutation(CREATE_OFFER, {
    refetchQueries: [{ query: MY_OFFERS }],
    onCompleted: () => {
      showMessage({ message: t("offerCreatedSuccessfully"), type: "success" });
      setValue("");
      setTitle("");
      setMinOrderAmount("");
      setMaxDiscount("");
      idempotencyKey.current = uuidv4();
    },
    onError: (err) =>
      showMessage({
        message: err.message || t("somethingWentWrongPleaseTryAgain"),
        type: "danger",
      }),
  });

  const [cancelOffer] = useMutation(CANCEL_OFFER, {
    refetchQueries: [{ query: MY_OFFERS }],
    onCompleted: () =>
      showMessage({ message: t("offerCancelled"), type: "success" }),
    onError: (err) =>
      showMessage({
        message: err.message || t("somethingWentWrongPleaseTryAgain"),
        type: "danger",
      }),
  });

  const handleSubmit = async () => {
    const numValue = Number(value);
    const hours = Number(durationHours);
    if (!numValue || numValue <= 0)
      return showMessage({ message: t("valueMustBePositive"), type: "danger" });
    if (type === "PERCENTAGE" && numValue > 100)
      return showMessage({
        message: t("percentageOfferCannotExceed100"),
        type: "danger",
      });
    if (!hours || hours <= 0)
      return showMessage({
        message: t("durationMustBePositive"),
        type: "danger",
      });

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + hours * 3600 * 1000);

    await createOffer({
      variables: {
        offerInput: {
          title: title || undefined,
          type,
          value: numValue,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          scope: "CART",
          minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
          maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
        },
      },
      context: { headers: { "Idempotency-Key": idempotencyKey.current } },
    });
  };

  const confirmCancel = (offer: IStoreOffer) => {
    Alert.alert(t("cancelOffer"), t("areYouSureToCancelThisOffer"), [
      { text: t("No"), style: "cancel" },
      {
        text: t("Yes"),
        style: "destructive",
        onPress: () => cancelOffer({ variables: { id: offer._id } }),
      },
    ]);
  };

  const offers: IStoreOffer[] = data?.myOffers ?? [];

  const inputClass =
    "min-w-[100%] rounded-md border border-2 border-gray-300 p-3 my-1";

  const renderLabel = (label: string) => (
    <Text
      className="text-base font-normal mt-2"
      style={{ color: appTheme.fontMainColor }}
    >
      {label}
    </Text>
  );

  return (
    <ScrollView
      className="w-[95%] mx-auto"
      style={{ backgroundColor: appTheme.themeBackground }}
      contentContainerClassName="pb-10"
    >
      <Text
        className="text-lg font-bold my-3"
        style={{ color: appTheme.fontMainColor }}
      >
        {t("createAnOffer")}
      </Text>

      {/* Type toggle */}
      {renderLabel(t("Type"))}
      <View className="flex flex-row gap-3 my-1">
        {(["PERCENTAGE", "FIXED"] as const).map((opt) => {
          const selected = type === opt;
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => setType(opt)}
              className="flex-1 rounded-md border-2 p-3 items-center"
              style={{
                borderColor: selected ? appTheme.primary : appTheme.borderLineColor,
                backgroundColor: selected ? appTheme.primary : "transparent",
              }}
            >
              <Text
                className="font-semibold"
                style={{ color: selected ? appTheme.black : appTheme.fontMainColor }}
              >
                {opt === "PERCENTAGE" ? t("Percentage") : t("Fixed")}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {renderLabel(
        type === "PERCENTAGE" ? t("Value") + " (%)" : t("Value")
      )}
      <TextInput
        className={inputClass}
        value={value}
        keyboardType="number-pad"
        placeholder={type === "PERCENTAGE" ? "20" : "5"}
        placeholderTextColor={appTheme.fontSecondColor}
        style={{ color: appTheme.fontSecondColor }}
        onChangeText={setValue}
      />

      {renderLabel(t("durationHours"))}
      <TextInput
        className={inputClass}
        value={durationHours}
        keyboardType="number-pad"
        placeholder="6"
        placeholderTextColor={appTheme.fontSecondColor}
        style={{ color: appTheme.fontSecondColor }}
        onChangeText={setDurationHours}
      />

      {renderLabel(t("Title") + " (" + t("optional") + ")")}
      <TextInput
        className={inputClass}
        value={title}
        placeholder={t("happyHour")}
        placeholderTextColor={appTheme.fontSecondColor}
        style={{ color: appTheme.fontSecondColor }}
        onChangeText={setTitle}
      />

      <View className="flex flex-row gap-3">
        <View className="flex-1">
          {renderLabel(t("minOrder") + " (" + t("optional") + ")")}
          <TextInput
            className={inputClass}
            value={minOrderAmount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={appTheme.fontSecondColor}
            style={{ color: appTheme.fontSecondColor }}
            onChangeText={setMinOrderAmount}
          />
        </View>
        <View className="flex-1">
          {renderLabel(t("maxDiscount") + " (" + t("optional") + ")")}
          <TextInput
            className={inputClass}
            value={maxDiscount}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={appTheme.fontSecondColor}
            style={{ color: appTheme.fontSecondColor }}
            onChangeText={setMaxDiscount}
          />
        </View>
      </View>

      <View className="my-3">
        <CustomContinueButton
          title={creating ? t("pleaseWait") : t("createAnOffer")}
          onPress={handleSubmit}
        />
      </View>

      {/* My offers list */}
      <Text
        className="text-lg font-bold mt-4 mb-2"
        style={{ color: appTheme.fontMainColor }}
      >
        {t("myOffers")}
      </Text>

      {loading && offers.length === 0 ? (
        <ActivityIndicator color={appTheme.primary} />
      ) : offers.length === 0 ? (
        <Text style={{ color: appTheme.fontSecondColor }}>
          {t("noOffersYet")}
        </Text>
      ) : (
        offers.map((offer) => (
          <View
            key={offer._id}
            className="rounded-md border-2 p-3 my-1"
            style={{ borderColor: appTheme.borderLineColor }}
          >
            <View className="flex flex-row justify-between items-center">
              <Text
                className="font-bold"
                style={{ color: appTheme.fontMainColor }}
              >
                {offer.type === "PERCENTAGE"
                  ? `${offer.value}% ${t("off")}`
                  : `${offer.value} ${t("off")}`}
                {offer.title ? ` — ${offer.title}` : ""}
              </Text>
              <Text
                className="text-xs font-semibold"
                style={{ color: offer.active ? "#16a34a" : appTheme.fontSecondColor }}
              >
                {offer.active ? t("Active") : t("Inactive")}
              </Text>
            </View>
            <Text
              className="text-xs mt-1"
              style={{ color: appTheme.fontSecondColor }}
            >
              {formatWindow(offer.startsAt, offer.endsAt)}
            </Text>
            {offer.enabled !== false && (
              <TouchableOpacity
                className="mt-2 self-start"
                onPress={() => confirmCancel(offer)}
              >
                <Text className="font-semibold text-red-600">
                  {t("cancelOffer")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
