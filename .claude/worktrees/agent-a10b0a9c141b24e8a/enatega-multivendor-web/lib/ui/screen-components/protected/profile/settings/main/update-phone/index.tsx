"use client";
import {
  IUpdateUserPhoneArguments,
  IUpdateUserResponse,
  ISendOtpToPhoneResponse,
  IPhoneExistsResponse,
} from "@/lib/utils/interfaces";

import { useEffect, useState } from "react";
import useVerifyOtp from "@/lib/hooks/useVerifyOtp";
import { useTranslations } from "next-intl";

import useToast from "@/lib/hooks/useToast";
import CustomDialog from "@/lib/ui/useable-components/custom-dialog";
import PhoneEntry from "./phone";
import VerificationPhone from "./verification-phone";

import { GET_USER_PROFILE, UPDATE_USER, SENT_OTP_TO_PHONE, PHONE_EXISTS } from "@/lib/api/graphql";
import { ApolloError, useLazyQuery, useMutation } from "@apollo/client";
import useDebounceFunction from "@/lib/hooks/useDebounceForFunction";
import useUser from "@/lib/hooks/useUser";

export interface IUpdatePhoneModalProps {
  isUpdatePhoneModalVisible: boolean;
  handleUpdatePhoneModal: () => void;
  ActiveStep?: number;
  setActiveStep: (step: number) => void;
  userPhone?: string;
}

export default function UpdatePhoneModal({
  isUpdatePhoneModalVisible,
  handleUpdatePhoneModal,
  ActiveStep,
  setActiveStep,
  userPhone,
}: IUpdatePhoneModalProps) {
  const [phoneOtp, setPhoneOtp] = useState("");
  // Local phone value for editing — initialised from the prop, updated on change.
  const [phoneValue, setPhoneValue] = useState(userPhone ?? "");

  const { profile } = useUser();
  const { showToast } = useToast();
  const { verifyOTP, error } = useVerifyOtp();
  const t = useTranslations();

  const [fetchProfile] = useLazyQuery(GET_USER_PROFILE, {
    fetchPolicy: "network-only",
  });

  const [updateUser] = useMutation<IUpdateUserResponse, undefined | IUpdateUserPhoneArguments>(
    UPDATE_USER,
    {
      onError: (error: ApolloError) => {
        showToast({
          type: "error",
          title: t("update_phone_name_update_error_title"),
          message: error.cause?.message || t("update_phone_name_update_error_msg"),
        });
      },
    }
  );

  const [checkPhoneExistsMutation] = useMutation<IPhoneExistsResponse, { phone: string }>(
    PHONE_EXISTS
  );

  const [sendOtpToPhone] = useMutation<ISendOtpToPhoneResponse, { phone: string }>(
    SENT_OTP_TO_PHONE
  );

  // Sync with external prop changes
  useEffect(() => {
    if (userPhone) setPhoneValue(userPhone);
  }, [userPhone]);

  const handleChange = (val: string) => {
    setPhoneValue(val);
  };

  const handleSubmit = useDebounceFunction(async () => {
    try {
      if (!phoneValue || phoneValue.length < 7) {
        showToast({
          type: "error",
          title: t("update_phone_name_update_error_title"),
          message: t("update_phone_name_invalid_number"),
        });
        return;
      }

      const existsResp = await checkPhoneExistsMutation({ variables: { phone: phoneValue } });
      const alreadyExists = Boolean(existsResp.data?.phoneExist?._id);

      if (alreadyExists) {
        showToast({
          type: "error",
          title: t("phone_check_error"),
          message: t("phone_number_already_associated_with_different_account"),
        });
        return;
      }

      const otpResp = await sendOtpToPhone({ variables: { phone: phoneValue } });
      if (otpResp.data?.sendOtpToPhoneNumber?._id) {
        setActiveStep(1);
      } else {
        showToast({
          type: "error",
          title: t("update_phone_name_update_error_title"),
          message: t("update_phone_name_send_otp_error"),
        });
      }
    } catch {
      showToast({
        type: "error",
        title: t("update_phone_name_update_error_title"),
        message: t("update_phone_name_send_otp_error"),
      });
    }
  }, 500);

  const handleSubmitAfterVerification = useDebounceFunction(async () => {
    try {
      const otpResponse = await verifyOTP({
        variables: { verifyOtpInput: { code: phoneOtp, destination: phoneValue } },
      });

      if (otpResponse.data?.verifyOtp?.verified && !!phoneValue) {
        await updateUser({
          variables: {
            phone: phoneValue,
            name: profile?.name ?? "",
            phoneIsVerified: true,
          },
        });

        setPhoneOtp("");
        setActiveStep(0);
        handleUpdatePhoneModal();
        fetchProfile();

        showToast({
          type: "success",
          title: t("update_phone_name_verification_success_title"),
          message: t("update_phone_name_verification_success_msg"),
        });
      } else {
        showToast({
          type: "error",
          title: t("update_phone_name_otp_error_title"),
          message: t("update_phone_name_otp_error_msg"),
        });
      }
    } catch (error) {
      console.error("Error while updating user and phone otp verification:", error);
    }
  }, 500);

  const handleResendPhoneOtp = useDebounceFunction(() => {
    if (phoneValue) {
      sendOtpToPhone({ variables: { phone: phoneValue } });
    } else {
      showToast({
        type: "error",
        title: t("update_phone_name_update_error_title"),
        message: t("update_phone_name_resend_error_msg"),
      });
    }
  }, 500);

  useEffect(() => {
    if (error) {
      showToast({
        type: "error",
        title: t("otp_error_label"),
        message: t("invalid_otp"),
      });
    }
  }, [error]);

  // Expose a user-like shape to child components that expect user.phone / user.name.
  const localUser = { phone: phoneValue, name: profile?.name };

  return (
    <CustomDialog visible={isUpdatePhoneModalVisible} onHide={handleUpdatePhoneModal} width="600px">
      {ActiveStep === 0 ? (
        <PhoneEntry
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          user={localUser}
          userPhone={userPhone}
          handleUpdatePhoneModal={handleUpdatePhoneModal}
        />
      ) : (
        <VerificationPhone
          handleSubmitAfterVerification={handleSubmitAfterVerification}
          handleResendPhoneOtp={handleResendPhoneOtp}
          phoneOtp={phoneOtp}
          setPhoneOtp={setPhoneOtp}
          user={localUser}
          showToast={showToast}
        />
      )}
    </CustomDialog>
  );
}
