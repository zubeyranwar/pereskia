import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('http://localhost:3000/')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error(err))
  }, [])

  return (
    <div>
      <h1>Fullstack Elysia & React</h1>
      <p>Backend says: {message || 'Loading...'}</p>
    </div>
  )
}

export default App
