function getMunicipalitiesUrl(state) {
  return `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios`
}

export async function getMunicipalities(state, signal) {
  const response = await fetch(getMunicipalitiesUrl(state), { signal })

  if (!response.ok) {
    throw new Error('Não foi possível carregar os municípios.')
  }

  const municipalities = await response.json()
  return municipalities
    .map(({ id, nome }) => ({ id: String(id), name: nome }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
