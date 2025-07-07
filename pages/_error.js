// pages/_error.js

function ErrorPage({ statusCode }) {
  return (
    <html lang="en">
      <head>
        <title>
          {statusCode
            ? `Error ${statusCode}`
            : 'An unexpected error occurred'}
        </title>
      </head>
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
        <h1 style={{ marginBottom: '1rem' }}>
          {statusCode
            ? `Error ${statusCode}`
            : 'Something went wrong'}
        </h1>
        <p>
          Sorry about that. You can go back to the home page:{' '}
          <a href="/" style={{ color: '#4f46e5', textDecoration: 'underline' }}>
            Home
          </a>
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
