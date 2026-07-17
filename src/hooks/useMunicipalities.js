import { useEffect, useState } from 'react'
import { getMunicipalities } from '../services/municipalities'

export function useMunicipalities(state) {
  const [municipalities, setMunicipalities] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    setStatus('loading')
    setMunicipalities([])
    getMunicipalities(state, controller.signal)
      .then((items) => {
        setMunicipalities(items)
        setStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [state])

  return { municipalities, status }
}
