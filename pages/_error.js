// pages/_error.js
import Head from 'next/head'
import Link from 'next/link'

function ErrorPage({ statusCode }) {
  return (
    <html lang="en">
      <Head>
        <title>
          {statusCode
            ? `Error ${statusCode}`
            : 'An unexpected error occurred'}
        </title>
      </Head>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>
          {statusCode
            ? `Error ${statusCode}`
            : 'Something went wrong'}
        </h1>
        <p>
          Sorry about that. You can go back to the home page:{' '}
          <Link href="/" style={{ color: '#4f46e5', textDecoration: 'underline' }}>
            Home
          </Link>
        </p>
      </body>
    </html>
  )
}

ErrorPage.getInitialProps = ({ res, err }) => {
  const statusCode   = res?.statusCode ?? err?.statusCode ?? 404
  return { statusCode }
}

export default ErrorPage
