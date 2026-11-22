import { ORDER_STATUS_ENUM } from './enums'

function calculateDistance(latS, lonS, latD, lonD) {
  var R = 6371 // km
  var dLat = toRad(latD - latS)
  var dLon = toRad(lonD - lonS)
  var lat1 = toRad(latS)
  var lat2 = toRad(latD)

  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2)
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  var d = R * c
  return d
}

// Converts numeric degrees to radians
function toRad(Value) {
  return (Value * Math.PI) / 180
}

/* const calulateRemainingTime = (order) => {



  // console.log({id: order?._id, preparationTime: order.preparationTime, completionTime: order?.completionTime})

  const expectedTime = [ORDER_STATUS_ENUM.PENDING].includes(order?.orderStatus)
    ? order?.preparationTime : order?.completionTime

  console.log({local: new Date(order?.preparationTime)})

  const remainingTime = Math.floor((new Date(expectedTime) - Date.now()) / 1000 / 60)
  return remainingTime > 0 ? remainingTime : 0
} */

const calulateRemainingTime = (order) => {
  // pick preparation or completion
  const expectedTimeUTC = [ORDER_STATUS_ENUM.PENDING].includes(order?.orderStatus) ? order?.preparationTime : order?.completionTime

  // convert UTC string → Date object → Local time
  const targetLocal = new Date(expectedTimeUTC) // JS automatically shifts this to local tz

  // difference in ms (uses local epoch under the hood)
  const diffMs = targetLocal.getTime() - Date.now()

  // convert ms → minutes
  const remainingTime = Math.floor(diffMs / 1000 / 60)

  return remainingTime > 0 ? remainingTime : 0
}

const calculateDaysAgo = (timestamp) => {
  const currentDate = new Date()
  const pastDate = new Date(Number(timestamp)) // Convert timestamp to Date
  const timeDifference = currentDate - pastDate

  const seconds = Math.floor(timeDifference / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(days / 30)
  const years = Math.floor(months / 12)

  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${years} year${years > 1 ? 's' : ''} ago`
}

function groupAndCount(array = [], key) {
  const result = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0
  }
  return array.reduce((updated, item) => {
    const propertyValue = item[key]

    if (!result[propertyValue === 0 ? 1 : propertyValue]) {
      updated[propertyValue === 0 ? 1 : propertyValue] = 1
    } else {
      updated[propertyValue === 0 ? 1 : propertyValue]++
    }

    return updated
  }, result)
}

function sortReviews(reviews, sortBy) {
  if (sortBy === 'newest') {
    return reviews.sort((a, b) => b.createdAt - a.createdAt)
  } else if (sortBy === 'highest') {
    return reviews.sort((a, b) => b.rating - a.rating)
  } else if (sortBy === 'lowest') {
    return reviews.sort((a, b) => a.rating - b.rating)
  }
}

// Apply round-to-nearest then floor/cap. Mirrors the API's
// delivery-fee.ts#normalizeFee so the quote equals what the server will charge.
function normalizeDeliveryFee(raw, { min = 0, max = 0, round = 0 } = {}) {
  let fee = Number.isFinite(raw) && raw > 0 ? raw : 0
  if (round > 0) fee = Math.round(fee / round) * round
  if (min > 0) fee = Math.max(fee, min)
  if (max > 0) fee = Math.min(fee, max)
  return fee
}

function calculateAmount(
  costType,
  deliveryRate,
  distance,
  baseFee = 0,
  baseDistance = 0,
  shaping = {}
) {
  let raw
  if (costType === 'fixed') {
    raw = deliveryRate
  } else if (costType === 'tiered') {
    raw = baseFee + Math.max(0, Math.ceil(distance) - baseDistance) * deliveryRate
  } else if (costType === 'linear') {
    raw = baseFee + deliveryRate * distance
  } else {
    raw = Math.ceil(distance) * deliveryRate
  }
  return normalizeDeliveryFee(raw, shaping)
}

// Customer service fee: percentage of the discounted food amount, clamped to a
// floor and (optional) cap. Mirrors the API's computeServiceFeeMoney. rate is a
// fraction (0.07 = 7%); cap 0 = uncapped. Disabled or zero rate → 0.
function calculateServiceFee(
  { serviceFeeEnabled, serviceFeeRate, serviceFeeMinimum, serviceFeeMaximum } = {},
  foodAmount
) {
  const rate = Number(serviceFeeRate)
  if (!serviceFeeEnabled || !Number.isFinite(rate) || rate <= 0) return 0
  const base = Number.isFinite(foodAmount) && foodAmount > 0 ? foodAmount : 0
  let fee = Math.max(base * rate, Number(serviceFeeMinimum) || 0)
  const cap = Number(serviceFeeMaximum)
  if (Number.isFinite(cap) && cap > 0) fee = Math.min(fee, cap)
  return fee
}

const timeToMinutes = (time) => {
  if (!time) return null

  const parts = Array.isArray(time) ? time : String(time).split(':')
  if (parts.length < 2) return null

  const hours = Number(parts[0])
  const minutes = Number(parts[1])

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null

  return hours * 60 + minutes
}

// Formats an opening-time value for display. Accepts the API's canonical
// "HH:MM" string (TimeValue scalar) and the legacy ["HH","MM"] array —
// indexing a string ("09:00"[0] === "0", [1] === "9") used to render
// opening hours as "0:9 – 2:3" on the About/Restaurant screens.
const formatTimeSlot = (time) => {
  const parts = Array.isArray(time) ? time : String(time ?? '').split(':')
  const h = String(parts[0] ?? '00').padStart(2, '0')
  const m = String(parts[1] ?? '00').padStart(2, '0')
  return `${h}:${m}`
}

const isOpen = (restaurant) => {
  // Prefer the server-computed, timezone-correct status (single source of truth).
  // This local computation is now only an offline fallback for older cached data.
  if (typeof restaurant?.isOpen === 'boolean') return restaurant.isOpen
  if (restaurant?.openingTimes?.length < 1 || !restaurant?.isAvailable) return false
  const date = new Date()
  const day = date.getDay()
  const currentTime = date.getHours() * 60 + date.getMinutes()
  const todaysTimings = restaurant?.openingTimes?.find((o) => o.day === ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][day])
  if (!todaysTimings?.times?.length) return false

  // Check all time slots for today's timings
  return todaysTimings.times.some((t) => {
    const startTime = timeToMinutes(t.startTime)
    const endTime = timeToMinutes(t.endTime)

    if (startTime === null || endTime === null) return false
    return currentTime >= startTime && currentTime <= endTime
  })
}

// Function to sort restaurants based on their open status
const sortRestaurantsByOpenStatus = (restaurants) => {
  return [...restaurants].sort((a, b) => {
    const isOpenA = isOpen(a) ? 1 : 0 // 1 if open, 0 if closed
    const isOpenB = isOpen(b) ? 1 : 0 // 1 if open, 0 if closed
    return isOpenB - isOpenA // Sort open restaurants to the top
  })
}

const truncateText = (limit, text) => {
  if (typeof text !== 'string') return ''
  if (text.length <= limit) return text
  return text.slice(0, limit) + '...'
}

const getErrorMessage = (error) => {
  if (!error) return null

  // Check for the specific 429 status
  const status = error.networkError?.statusCode

  switch (status) {
    case 400:
      return 'Invalid request.'
    case 401:
      return 'Session expired. Please login.'
    case 403:
      return 'Access denied.'
    case 429:
      return 'Too many requests. Try later.'
    case 500:
      return 'Server error. Try again.'
    default:
      return 'Connection failed.'
  }
}

export { calculateDistance, calulateRemainingTime, calculateDaysAgo, groupAndCount, sortReviews, calculateAmount, calculateServiceFee, isOpen, sortRestaurantsByOpenStatus, truncateText, getErrorMessage, timeToMinutes, formatTimeSlot }
