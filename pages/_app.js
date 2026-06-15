import { AuthProvider } from '../lib/AuthContext'
import Header from '../components/Header'
import Footer from '../components/Footer'
import '../styles/globals.css'
import GA from '../components/GA'
import FunnelTracker from '../components/FunnelTracker'

function MyApp({ Component, pageProps }) {
  return (
    <>
      <GA />
      <FunnelTracker />
      <AuthProvider>
        <Header />
        <Component {...pageProps} />
        <Footer />
      </AuthProvider>
    </>
  )
}

export default MyApp
