import { useContext, useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthContext } from './AuthContext'

export function withProtected(WrappedComponent) {
  return (props) => {
    const { user } = useContext(AuthContext)
    const router = useRouter()

    // If no user, redirect to sign-in
    useEffect(() => {
      if (user === null) {
        router.replace('/signin')
      }
    }, [user])

    // While we’re checking session, render nothing (or a loader)
    if (user === null) return null

    // Once we have a user, render the protected page
    return <WrappedComponent {...props} />
  }
}
