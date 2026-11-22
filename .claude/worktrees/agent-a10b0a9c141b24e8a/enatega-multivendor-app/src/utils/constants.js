import { Easing } from 'react-native-reanimated'

export const IMAGE_LINK =
  'https://res.cloudinary.com/do1ia4vzf/image/upload/v1714636036/food/z3woendyhtelzarcmdcm.jpg'

export const SLIDE_UP_RIGHT_ANIMATION = {
  cardStyleInterpolator: ({ current, layouts }) => {
    const translateX = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [layouts.screen.width, 0]
    })

    const translateY = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-layouts.screen.height, 0]
    })

    return {
      cardStyle: {
        transform: [{ translateX }, { translateY }]
      }
    }
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.inOut(Easing.ease)
      }
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200
      }
    }
  }
}

// Clean horizontal slide. Previously this stacked a 380ms 3D rotateY +
// perspective + scale(1.4→1) "curve" effect on every push, which forced the
// incoming screen to render oversized and tilted, then settle — expensive and
// laggy. Now a single GPU-cheap translateX with a light parallax dim on the
// outgoing screen, at standard durations.
export const SLIDE_RIGHT_WITH_CURVE_ANIM = {
  cardStyleInterpolator: ({ current, next, layouts }) => {
    const translateX = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [layouts.screen.width, 0]
    })

    // Slight parallax: the screen being covered eases left a touch and dims.
    const outgoingTranslateX = next
      ? next.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, layouts.screen.width * -0.25]
        })
      : 0
    const outgoingOpacity = next
      ? next.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.85]
        })
      : 1

    return {
      cardStyle: {
        transform: [{ translateX: outgoingTranslateX }, { translateX }],
        opacity: outgoingOpacity
      }
    }
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 240,
        easing: Easing.out(Easing.poly(4))
      }
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
        easing: Easing.in(Easing.ease)
      }
    }
  }
}

export const FAST_PROFILE_NAVIGATION_ANIMATION = {
  gestureDirection: 'horizontal',
  cardStyleInterpolator: ({ current, layouts }) => {
    const translateX = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [layouts.screen.width * 0.08, 0]
    })

    const opacity = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.92, 1]
    })

    return {
      cardStyle: {
        opacity,
        transform: [{ translateX }]
      }
    }
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 160,
        easing: Easing.out(Easing.ease)
      }
    },
    close: {
      animation: 'timing',
      config: {
        duration: 120,
        easing: Easing.in(Easing.ease)
      }
    }
  }
}

// Used by the Restaurant screen (and grocery detail). Previously scaled the
// whole screen up from a zero-size dot (scale 0→1) in the centre, which fought
// the instant-header paint and looked janky on a heavy-mounting screen. Now a
// fast "fade through": subtle scale-up from 0.96 + opacity fade, so the header
// (already rendered from route params) is visible almost immediately.
export const AIMATE_FROM_CENTER = {
  cardStyleInterpolator: ({ current }) => {
    const opacity = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1]
    })
    const scale = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.96, 1]
    })

    return {
      cardStyle: {
        opacity,
        transform: [{ scale }]
      }
    }
  },
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 180,
        easing: Easing.out(Easing.ease)
      }
    },
    close: {
      animation: 'timing',
      config: {
        duration: 140,
        easing: Easing.in(Easing.ease)
      }
    }
  }
}

// NEW: Cart-specific animation - same as SLIDE_UP_RIGHT but with fixed header opacity
export const SLIDE_UP_RIGHT_ANIMATION_FIXED_HEADER = {
  cardStyleInterpolator: ({ current, layouts }) => {
    const translateX = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [layouts.screen.width, 0]
    })

    const translateY = current.progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-layouts.screen.height, 0]
    })

    return {
      cardStyle: {
        transform: [{ translateX }, { translateY }]
      }
    }
  },
  // This is the key addition - prevents header from fading during transition
  headerStyleInterpolator: ({ current }) => ({
    headerStyle: {
      opacity: 1 // Keep header fully opaque throughout the animation
    }
  }),
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
        easing: Easing.inOut(Easing.ease)
      }
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200
      }
    }
  }
}
