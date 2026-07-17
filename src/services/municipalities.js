const IBGE_MG_MUNICIPALITIES_URL =
  'https://servicodados.ibge.gov.br/api/v1/localidades/estados/MG/municipios'

export async function getMinasGeraisMunicipalities(signal) {
  const response = await fetch(IBGE_MG_MUNICIPALITIES_URL, { signal })

  if (!response.ok) {
    throw new Error('Não foi possível carregar os municípios.')
  }

  const municipalities = await response.json()
  return municipalities
    .map(({ id, nome }) => ({ id: String(id), name: nome }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
