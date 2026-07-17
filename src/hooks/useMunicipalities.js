import { useEffect, useState } from 'react'
import { getMinasGeraisMunicipalities } from '../services/municipalities'

export function useMunicipalities() {
  const [municipalities, setMunicipalities] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    getMinasGeraisMunicipalities(controller.signal)
      .then((items) => {
        setMunicipalities(items)
        setStatus('ready')
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('error')
      })

    return () => controller.abort()
  }, [])

  return { municipalities, status }
}
