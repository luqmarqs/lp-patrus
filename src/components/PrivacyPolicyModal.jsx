import { useEffect } from 'react'

export default function PrivacyPolicyModal({ isOpen, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="privacy-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="privacy-header">
          <h2 id="privacy-title">Política de privacidade</h2>
          <button type="button" aria-label="Fechar política de privacidade" onClick={onClose}>×</button>
        </header>
        <div className="privacy-content">
          <p>Esta Política de Privacidade explica como o Manifesto em defesa da chapa Patrus, Áurea e Marília coleta, utiliza e protege as informações pessoais fornecidas neste site, em conformidade com a Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018).</p>

          <h3>1. Coleta de dados</h3>
          <p>Coletamos os dados que você informa voluntariamente ao assinar o manifesto: nome completo, WhatsApp, e-mail, data de nascimento, município e estado. Podemos também registrar informações técnicas de navegação e origem de acesso, como parâmetros de URL, para compreender o alcance das comunicações.</p>

          <h3>2. Uso das informações</h3>
          <p>Os dados são usados para registrar sua adesão ao manifesto e para comunicar informações relacionadas à mobilização e à construção política da chapa Patrus, Áurea e Marília, inclusive por WhatsApp e e-mail.</p>

          <h3>3. Compartilhamento de dados</h3>
          <p>Os dados não serão vendidos ou alugados. O acesso é limitado à equipe responsável pela mobilização e, quando necessário, a fornecedores tecnológicos que operam a infraestrutura do site e tratam os dados conforme as instruções da organização.</p>

          <h3>4. Segurança e retenção</h3>
          <p>São adotadas medidas técnicas e organizacionais adequadas para proteger os dados contra acessos, alterações, divulgações ou destruições não autorizadas. As informações são mantidas apenas pelo tempo necessário às finalidades descritas ou para o cumprimento de obrigações legais.</p>

          <h3>5. Seus direitos</h3>
          <p>Você pode solicitar confirmação de tratamento, acesso, correção, atualização, anonimização ou exclusão de seus dados, observadas as hipóteses legais aplicáveis. Também pode pedir o cancelamento do recebimento de comunicações a qualquer momento.</p>
        </div>
        <footer className="privacy-footer"><button type="button" onClick={onClose}>Entendi</button></footer>
      </section>
    </div>
  )
}
