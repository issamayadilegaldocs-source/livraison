import React from 'react'
import { ActivityIndicator, View, TouchableOpacity, Dimensions, InteractionManager } from 'react-native'
import { Modalize } from 'react-native-modalize'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated'
import { MaterialIcons, SimpleLineIcons, Feather, Entypo } from '@expo/vector-icons'
import TextDefault from '../../Text/TextDefault/TextDefault'
import { scale } from '../../../utils/scaling'
import { useTabBarSpace } from '../../../utils/useTabBarSpace'
import styles from './styles'
import { useTranslation } from 'react-i18next'

const ACTION_WIDTH = scale(72)
// Fixed open height so Modalize can animate immediately instead of mounting the
// list, waiting for an onLayout measure pass (what `adjustToContentHeight`
// requires), and only then sliding up. Opens at (near) full height from the
// start per design.
const SHEET_HEIGHT = Math.floor(Dimensions.get('window').height * 0.92)

// Single swipe action (edit / delete) that slides + fades in as the row opens
const SwipeAction = ({ progress, index, label, icon, backgroundColor, color, onPress }) => {
  const animatedStyle = useAnimatedStyle(() => {
    const p = Math.min(progress.value, 1)
    return {
      opacity: p,
      transform: [
        { translateX: interpolate(p, [0, 1], [ACTION_WIDTH * (index + 1), 0], Extrapolation.CLAMP) },
        { scale: interpolate(p, [0, 1], [0.85, 1], Extrapolation.CLAMP) }
      ]
    }
  })
  return (
    <Animated.View style={[styles().swipeAction, { backgroundColor }, animatedStyle]}>
      <TouchableOpacity
        style={styles().swipeActionTouch}
        activeOpacity={0.7}
        onPress={onPress}
        accessibilityRole='button'
        accessibilityLabel={label}
      >
        {icon}
        <TextDefault textColor={color} small bold style={styles().swipeActionLabel}>
          {label}
        </TextDefault>
      </TouchableOpacity>
    </Animated.View>
  )
}

const MainModalize = ({
  modalRef,
  currentTheme,
  isLoggedIn,
  addressIcons,
  modalHeader,
  modalFooter,
  setAddressLocation,
  onEditAddress,
  onDeleteAddress,
  deletingAddress,
  selectingAddress,
  onClose,
  onOpen,
  onClosed,
  profile,
  location
}) => {
  const { t } = useTranslation()
  // Reserve space for the floating pill tab bar so the sheet's footer ("Add
  // address" CTA) and last rows are not hidden under it. The floating bar is
  // absolutely positioned and paints over the sheet, so the scrollable content
  // must clear it itself. Falls back to the home-indicator inset on screens
  // pushed without the tab bar (e.g. Menu).
  const tabBarSpace = useTabBarSpace()
  const [selectingAddressId, setSelectingAddressId] = React.useState(null)
  // Modalize renders nothing while closed, so `open()` mounts the whole sheet
  // (incl. every address row's ReanimatedSwipeable + gesture handler) in one
  // synchronous commit before it can animate — the real "slow to show up" cost.
  // We mount the sheet empty (just the light header/footer buttons) so it pops
  // up instantly, then add the heavy address rows once the open interaction
  // settles. `rowsReady` gates the FlatList data.
  const [rowsReady, setRowsReady] = React.useState(false)
  const interactionRef = React.useRef(null)

  const handleOpen = React.useCallback(() => {
    interactionRef.current = InteractionManager.runAfterInteractions(() => setRowsReady(true))
    onOpen?.()
  }, [onOpen])

  const handleClosed = React.useCallback(() => {
    interactionRef.current?.cancel?.()
    setRowsReady(false)
    onClosed?.()
  }, [onClosed])

  // `styles()` runs StyleSheet.create on every call; build once per render and
  // reuse instead of rebuilding dozens of stylesheets per row / per swipe.
  const s = React.useMemo(() => styles(currentTheme), [currentTheme])
  const sBase = React.useMemo(() => styles(), [])

  const handleSelectAddress = (address) => {
    if (deletingAddress || selectingAddress || selectingAddressId) return

    setSelectingAddressId(address._id)
    try {
      Promise.resolve(setAddressLocation(address))
        .catch((error) => console.log(error))
        .finally(() => {
          setSelectingAddressId((currentId) => currentId === address._id ? null : currentId)
        })
    } catch (error) {
      console.log(error)
      setSelectingAddressId(null)
    }
  }

  const ModalHeaderBar = () => (
    <View style={s.headerBar}>
      <TextDefault H4 bolder textColor={currentTheme.darkBgFont} style={s.headerTitle}>
        {t('deliveryAddress')}
      </TextDefault>
      <TouchableOpacity
        onPress={() => (onClose ? onClose() : modalRef.current?.close())}
        activeOpacity={0.7}
        accessibilityRole='button'
        accessibilityLabel={t('close')}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={s.headerClose}
      >
        <MaterialIcons name='close' size={scale(22)} color={currentTheme.darkBgFont} />
      </TouchableOpacity>
    </View>
  )

  // eslint-disable-next-line react/display-name
  const renderRightActions = (address) => (progress, _translation, methods) => (
    <View style={s.swipeActionsWrap}>
      <SwipeAction
        progress={progress}
        index={1}
        label={t('edit')}
        backgroundColor={'#1A1A1A'}
        color={'#FFFFFF'}
        icon={<SimpleLineIcons name='pencil' size={scale(16)} color={'#FFFFFF'} />}
        onPress={() => {
          methods.close()
          onEditAddress?.(address)
        }}
      />
      <SwipeAction
        progress={progress}
        index={0}
        label={t('delete')}
        backgroundColor={currentTheme.textErrorColor || '#DE1135'}
        color={'#FFFFFF'}
        icon={<Feather name='trash-2' size={scale(16)} color={'#FFFFFF'} />}
        onPress={() => {
          methods.close()
          onDeleteAddress?.(address)
        }}
      />
    </View>
  )

  const SavedAddressDivider = () => (
    <View style={s.savedDividerRow}>
      <View style={sBase.savedDividerLine} />
      <TextDefault bold textColor={currentTheme.fontSecondColor} style={sBase.savedDividerText}>
        {t('savedAddresses', { defaultValue: 'SAVED ADDRESSES' })}
      </TextDefault>
      <View style={sBase.savedDividerLine} />
    </View>
  )

  // Placeholder rows shown while the real address rows are deferred (rowsReady
  // === false) so the sheet never looks empty on open.
  const placeholderColor = currentTheme.horizontalLine || currentTheme.borderColor || '#E6E6E6'
  const AddressSkeleton = () => (
    <View style={sBase.addressSkeletonWrap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[s.addressbtn, sBase.addressSkeletonRow]}>
          <View style={[sBase.addressSkeletonIcon, { backgroundColor: placeholderColor }]} />
          <View style={sBase.addressSkeletonText}>
            <View style={[sBase.addressSkeletonLineShort, { backgroundColor: placeholderColor }]} />
            <View style={[sBase.addressSkeletonLineLong, { backgroundColor: placeholderColor }]} />
          </View>
        </View>
      ))}
    </View>
  )

  return (
    <Modalize
      ref={modalRef}
      modalHeight={SHEET_HEIGHT}
      disableScrollIfPossible={false}
      modalStyle={s.modal}
      overlayStyle={s.overlay}
      handleStyle={s.handle}
      handlePosition='inside'
      HeaderComponent={ModalHeaderBar}
      onOpen={handleOpen}
      onClosed={handleClosed}
      openAnimationConfig={{
        timing: { duration: 240 }
      }}
      closeAnimationConfig={{
        timing: { duration: 200 }
      }}
      flatListProps={{
        // Rows deferred until the open interaction settles (see rowsReady) so
        // the sheet mounts light and animates up immediately.
        data: rowsReady && isLoggedIn && profile ? profile.addresses : [],
        ListHeaderComponent: (
          <>
            {modalHeader()}
            <SavedAddressDivider />
          </>
        ),
        ListFooterComponent: modalFooter(),
        // While rows are deferred, show skeleton placeholders instead of an
        // empty gap. Once rowsReady is true this renders nothing for a genuinely
        // empty address list (the footer "Add address" CTA still shows).
        ListEmptyComponent: !rowsReady ? <AddressSkeleton /> : null,
        keyExtractor: (item) => item._id,
        contentContainerStyle: [s.listContent, { paddingBottom: tabBarSpace + scale(8) }],
        showsVerticalScrollIndicator: false,
        renderItem: ({ item: address }) => {
          const isSelecting = selectingAddressId === address?._id
          const isSelectionDisabled =
            deletingAddress || selectingAddress || selectingAddressId !== null
          const isSelected =
            address?._id === location?._id &&
            ![t('currentLocation'), t('selectedLocation')].includes(location.label)
          const renderSelectionStatus = () => {
            if (isSelecting) {
              return (
                <ActivityIndicator size='small' color={currentTheme.iconColorPink} />
              )
            }

            if (isSelected) {
              return (
                <MaterialIcons name='check' size={scale(22)} color={currentTheme.black} />
              )
            }

            return (
              <Entypo
                name='dots-three-vertical'
                size={scale(16)}
                color={currentTheme.fontSecondColor}
                style={s.swipeHint}
              />
            )
          }
          return (
            <View style={s.swipeRowWrap}>
              <ReanimatedSwipeable
                friction={2}
                rightThreshold={ACTION_WIDTH}
                dragOffsetFromLeftEdge={scale(24)}
                dragOffsetFromRightEdge={scale(24)}
                overshootRight={false}
                enabled={!deletingAddress && !selectingAddress && !selectingAddressId}
                containerStyle={s.swipeContainer}
                renderRightActions={renderRightActions(address)}
              >
                <TouchableOpacity
                  style={[
                    s.addressbtn,
                    isSelecting && s.addressbtnSelecting
                  ]}
                  activeOpacity={0.7}
                  disabled={isSelectionDisabled}
                  onPress={() => handleSelectAddress(address)}
                  accessibilityRole='button'
                  accessibilityLabel={`${t(address.label)}, ${address?.deliveryAddress}`}
                >
                  <View style={s.addressRowContent}>
                    <View style={[s.homeIcon]}>
                      {addressIcons[address.label]
                        ? React.createElement(addressIcons[address.label], {
                          fill: currentTheme.darkBgFont,
                          width: scale(20),
                          height: scale(20)
                        })
                        : React.createElement(addressIcons.Other, {
                          fill: currentTheme.darkBgFont,
                          width: scale(20),
                          height: scale(20)
                        })}
                    </View>
                    <View style={s.addressInfo}>
                      <View style={sBase.titleAddress}>
                        <TextDefault textColor={currentTheme.darkBgFont} style={s.labelStyle}>
                          {t(address.label)}
                        </TextDefault>
                      </View>
                      <TextDefault textColor={currentTheme.fontSecondColor} small numberOfLines={2}>
                        {address?.deliveryAddress}
                      </TextDefault>
                    </View>
                    {renderSelectionStatus()}
                  </View>
                </TouchableOpacity>
              </ReanimatedSwipeable>
            </View>
          )
        }
      }}
    ></Modalize>
  )
}

export default MainModalize
