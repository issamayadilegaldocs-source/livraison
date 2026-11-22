import React from 'react'
import { useAuth } from '@clerk/clerk-expo'

const AuthContext = React.createContext()

export const AuthProvider = ({ children }) => {
  const { isSignedIn, getToken, signOut } = useAuth()

  return (
    <AuthContext.Provider value={{ isSignedIn, getToken, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const AuthConsumer = AuthContext.Consumer
export default AuthContext
