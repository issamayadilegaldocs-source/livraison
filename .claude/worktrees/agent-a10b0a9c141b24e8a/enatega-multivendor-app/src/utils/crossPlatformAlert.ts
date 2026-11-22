import { Alert, Platform } from 'react-native'

interface ConfirmActionOptions {
  title?: string
  message: string
  confirmText: string
  cancelText: string
  onConfirm: () => void
  onCancel?: () => void
  /** Style the confirm button as destructive on native (e.g. "clear the cart"). */
  destructive?: boolean
}

/**
 * Confirmation dialog that works on every platform.
 *
 * `Alert.alert` is a silent no-op on react-native-web, which turns any
 * confirm-gated action into a button that appears to do nothing (same class of
 * bug as the rider app's COD confirmation). On web we fall back to
 * `window.confirm`; native keeps the regular two-button Alert.
 */
export function confirmAction({ title, message, confirmText, cancelText, onConfirm, onCancel, destructive }: ConfirmActionOptions): void {
  if (Platform.OS === 'web') {
    const text = [title, message].filter(Boolean).join('\n\n')
    const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(text) : true
    if (accepted) onConfirm()
    else onCancel?.()
    return
  }
  Alert.alert(
    title ?? '',
    message,
    [
      { text: cancelText, onPress: () => onCancel?.(), style: 'cancel' },
      { text: confirmText, onPress: () => onConfirm(), style: destructive ? 'destructive' : 'default' }
    ],
    { cancelable: false }
  )
}

/** One-button informational alert that is also visible on web. */
export function showAlert(title: string, message?: string, onDismiss?: () => void): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert([title, message].filter(Boolean).join('\n\n'))
    }
    onDismiss?.()
    return
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: () => onDismiss?.() }])
}
