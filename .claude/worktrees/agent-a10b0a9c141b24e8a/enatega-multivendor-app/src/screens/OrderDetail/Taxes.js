import React, { useContext } from 'react'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import { alignment } from '../../utils/alignment'
import { formatMoneyModel } from '../../utils/formatCurrency'

const Taxes = ({
  tax,
  deliveryCharges,
  tip,
  discountAmount,
  serviceFee,
  taxationAmountMoney,
  deliveryChargesMoney,
  tippingMoney,
  discountAmountMoney,
  serviceFeeMoney,
  currencyCode,
  decimals
}) => {
  const themeContext = useContext(ThemeContext)
  const { t, i18n } = useTranslation()
  const currentTheme = {
    isRTL: i18n.dir() === 'rtl',
    ...theme[themeContext.ThemeValue]
  }

  const data = [
    { amount: tax, money: taxationAmountMoney, title: 'taxFee' },
    { amount: deliveryCharges, money: deliveryChargesMoney, title: 'delvieryCharges' },
    { amount: tip, money: tippingMoney, title: 'tip' },
    // Only show the service fee when it was actually charged.
    ...(serviceFee > 0
      ? [{ amount: serviceFee, money: serviceFeeMoney, title: 'serviceFee' }]
      : []),
    { amount: discountAmount, money: discountAmountMoney, title: 'voucherDiscount' }
  ]

  const renderItem = (item) => {
    return (
      <View
        key={item.title}
        style={{
          flexDirection: currentTheme?.isRTL ? 'row-reverse' : 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <TextDefault H5 style={{ ...alignment.Mmedium, textAlign: 'center' }} textColor={currentTheme.gray900} bolder isRTL>
          {' '}
          {t(item?.title)}
        </TextDefault>
        <TextDefault H5 bolder style={{ ...alignment.Mmedium }}>
          {' '}
          {item?.title === 'voucherDiscount' && '-'}
          {formatMoneyModel(item?.money, item?.amount, {
            suffix: currencyCode,
            decimals
          })}{' '}
        </TextDefault>
      </View>
    )
  }

  return (
    <View>
      {data.map(renderItem)}
    </View>
  )
}

export default Taxes
