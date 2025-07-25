import { AuthProvider } from '../lib/AuthContext'
import Header from '../components/Header'
import '../styles/globals.css'
import GA from '../components/GA'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <GA />
      <AuthProvider>
        <Header />
        <Component {...pageProps} />
      </AuthProvider>
    </>
  )
}

export default MyApp
