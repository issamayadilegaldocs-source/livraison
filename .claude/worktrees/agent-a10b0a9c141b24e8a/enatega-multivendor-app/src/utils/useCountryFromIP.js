import { useEffect, useState, useRef } from 'react'
import { Platform } from 'react-native'
import countryCallingCodes from '../screens/PhoneNumber/countryCodes'


export const useCountryFromIP = () => {
  const [country, setCountry] = useState({
    callingCode: ['216'],
    cca2: 'TN',
    currency: ['TND'],
    flag: 'flag-tn',
    name: 'Tunisia',
    region: 'Africa',
    subregion: 'Northern Africa'
  })
  const [currentCountry, setCurrentCountry] = useState('TN')
  const [ipAddress, setIpAddress] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const retryCount = 3
  const currentRetry = useRef(0)
  const [trigger, setTrigger] = useState(0) 

  const fetchIpAddress = async () => {
    if (Platform.OS === 'web') {
      // ipinfo.io rejects browser-origin requests (no CORS headers), so this
      // always fails on the web preview — skip it and keep the default country.
      return null
    }
    try {
      const response = await fetch('https://api.ipify.org/?format=json')
      const data = await response.json()
      setIpAddress(data.ip)

      const response2 = await fetch(`https://ipinfo.io/${data.ip}/json`)
      const data2 = await response2.json()
      setCurrentCountry(data2.country)
      return data2.country
    } catch (err) {
      console.error('Error fetching IP or country:', err)
      if (currentRetry.current < retryCount) {
        currentRetry.current++
        return fetchIpAddress()
      } else {
        setError('Failed to get IP address or country.')
        return null
      }
    }
  }

  const initializeCountry = async () => {
    setIsLoading(true)
    try {
      const code = await fetchIpAddress()
      if (code) {
        const callingCode = countryCallingCodes[code]
        if (callingCode) {
          setCountry({
            callingCode: [callingCode.toString()],
            cca2: code,
            currency: ['PKR'], 
            flag: 'flag-' + code,
            name: code,
            region: '',
            subregion: '',
          })
        } else {
          console.warn('Unknown country code:', code)
        }
      }
    } catch (err) {
      console.error('Error initializing country:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    initializeCountry()
  }, [trigger])

  const refetch = () => {
    currentRetry.current = 0
    setTrigger(prev => prev + 1)
  }

  return {
    country,
    currentCountry,
    setCurrentCountry,
    ipAddress,
    isLoading,
    error,
    refetch,
    setCountry
  }
}
