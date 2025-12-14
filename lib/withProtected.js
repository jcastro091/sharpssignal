import { useContext, useEffect } from 'react'
import { useRouter } from 'next/router'
import { AuthContext } from './AuthContext'

export function withProtected(WrappedComponent) {
  const ProtectedComponent = (props) => {
    const { user } = useContext(AuthContext);
    const router = useRouter();

    useEffect(() => {
      if (user === null) {
        router.replace('/signin');
      }
    }, [user, router]); // ✅ Fix warning #2 here

    if (user === null) return null;

    return <WrappedComponent {...props} />;
  };

  // ✅ Fix display name
  ProtectedComponent.displayName = `withProtected(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return ProtectedComponent;
}

WrappedComponent.displayName = 'WithProtectedPage';

