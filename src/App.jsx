import { useState } from 'react'
import LeadForm from './components/LeadForm'
import PrivacyPolicyModal from './components/PrivacyPolicyModal'

const assets = {
  orangeTexture: '/Sem título - 17 de julho de 2026 às 10.15.56-1.png',
  blueTexture: '/Sem título - 17 de julho de 2026 às 10.15.56-2.png',
  orangeDots: '/Sem título - 17 de julho de 2026 às 10.15.56-4.png',
  blueDots: '/Sem título - 17 de julho de 2026 às 10.15.56-5.png',
  greenDots: '/Sem título - 17 de julho de 2026 às 10.15.56-6.png',
  yellowDots: '/Sem título - 17 de julho de 2026 às 10.15.56-7.png',
  sun: '/Sem título - 17 de julho de 2026 às 10.15.56-16.png',
  sunFine: '/Sem título - 17 de julho de 2026 às 10.15.56-17.png',
}

const manifestoParagraphs = [
  'Minas Gerais é o estado que decide presidentes. Desde 1989, todo presidente eleito venceu aqui, e quem ganha em Minas Gerais, ganha o Brasil.',
  'Por isso, 2026 é mais do que uma eleição. É a disputa pelo destino de um estado que tem 21 milhões de habitantes, que concentra a maior parte das riquezas minerais do país, que tem uma das maiores redes de educação pública do Brasil. Mas que, ao mesmo tempo, convive com o segundo maior índice de feminicídios do país, com serras e comunidades ameaçadas pela mineração e com periferias que o Estado abandonou. Minas Gerais carrega em si todas as contradições do Brasil e precisa, urgentemente, de uma saída à altura desse desafio.',
  'Essa saída não virá da direita. Os oito anos de Romeu Zema foram de desmontes: da Copasa privatizada, do Pacto Nacional Contra o Feminicídio recusado, dos territórios entregues às mineradoras, dos direitos dos servidores públicos achatados, da precarização das políticas culturais, da negligência com as questões do campo, do aumento da dívida do Estado.',
  'Zema deixa Minas Gerais mais desigual, mais violenta e mais dependente do que encontrou, e o projeto que quer continuar esse legado se materializa nas figuras de Mateus Simões, Cleitinho Azevedo e Flávio Bolsonaro, representantes da extrema direita golpista, que foi ao governo dos Estados Unidos pedir que Trump atacasse o Brasil e que trata Minas Gerais como palanque para um projeto nacional de destruição da democracia. Nunca houve saída para Minas Gerais nessa direção.',
  'A saída tem nome e começa com um gesto de generosidade política rara. Patrus Ananias, o prefeito que criou o Orçamento Participativo e os Restaurantes Populares em BH, o ministro do Fome Zero e que implementou o Bolsa Família, disponibilizou seu nome para enfrentar o maior desafio eleitoral de Minas Gerais em décadas. Seu gesto merece ser correspondido à altura.',
  'No mesmo palanque, Marília Campos, ex-prefeita de Contagem e uma das lideranças mais reconhecidas do campo progressista mineiro, traz para a disputa ao Senado uma trajetória de compromisso com o povo. Minas Gerais precisa de Marília no Senado.',
  'E é aqui que a construção dessa chapa ganha seu significado mais profundo.',
  'Minas Gerais nunca elegeu um senador de esquerda desde a redemocratização. São 36 anos de eleições, e o Senado sempre ficou com a direita e a centro-direita. Também porque a esquerda, nas disputas majoritárias, quase sempre cedeu a segunda vaga ao centro ou à direita em nome de uma aliança que nunca valeu o que custou.',
  'Neste ano, é a primeira vez que temos condições reais de ocupar as duas cadeiras com candidatas genuinamente progressistas. Áurea Carolina, a mulher que ousou fazer diferente na política mineira, a deputada federal mais votada em MG no ano de sua eleição e uma das vozes mais reconhecidas da esquerda brasileira, tem defendido publicamente que o campo progressista pode e deve disputar as duas vagas. Abrir mão dessa possibilidade, entregar uma das cadeiras para o centro ou para a direita por comodidade ou por falta de ousadia, seria desperdiçar uma janela histórica que pode não se abrir de novo tão cedo.',
  'A chapa Patrus, Áurea e Marília é a mais corajosa e honesta politicamente. É a que diz claramente de que lado está, o que defende e para quem governa. É a chapa do Fome Zero e do Bolsa Família, das mulheres que chegaram para ficar, da esquerda que não pede licença para disputar Minas Gerais.',
]

function scrollToForm() {
  document.querySelector('#assine')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function App() {
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)

  return (
    <>
      <header className="site-header">
        <a className="wordmark" href="#inicio" aria-label="Manifesto Minas Gerais"><span>MINAS</span><span>GERAIS</span></a>
        <button type="button" onClick={scrollToForm}>Assine o manifesto <span aria-hidden="true">↘</span></button>
      </header>
      <main id="inicio">
        <section className="hero texture-orange">
          <img className="hero-sun" src={assets.sunFine} alt="" aria-hidden="true" />
          <div className="hero-inner">
            <p className="eyebrow">Manifesto em defesa da chapa</p>
            <h1>Patrus,<br />Áurea<br /><em>e Marília</em></h1>
            <p className="hero-lead">Uma chance única para Minas Gerais.</p>
            <button className="hero-cta" type="button" onClick={scrollToForm}>Quero assinar <span aria-hidden="true">↓</span></button>
          </div>
        </section>

        <section className="opening blue-section dots-blue">
          <div className="content-narrow">
            <p className="section-kicker">MINAS PRECISA ESCOLHER UM NOVO CAMINHO</p>
            <h2>Minas é gigante.<br /><em>O nosso futuro também precisa ser.</em></h2>
            <p>Chegou a hora de construir uma chapa que enfrente os desafios do nosso estado com coragem, compromisso e lado.</p>
          </div>
        </section>

        <section className="manifesto" aria-labelledby="manifesto-title">
          <img className="manifesto-sun" src={assets.sun} alt="" aria-hidden="true" loading="lazy" />
          <div className="manifesto-content">
            <p className="section-kicker">POR UMA MINAS GERAIS PARA TODA GENTE</p>
            <h2 id="manifesto-title">Uma chance única para Minas Gerais</h2>
            {manifestoParagraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            <p className="closing">Minas Gerais tem uma chance única. E chances assim não se desperdiçam.</p>
          </div>
        </section>

        <section className="form-section green-section dots-green" id="assine" aria-labelledby="form-title">
          <img className="form-sun" src={assets.sunFine} alt="" aria-hidden="true" loading="lazy" />
          <div className="form-layout">
            <div className="form-copy">
              <p className="section-kicker">FAÇA PARTE DESTA CONSTRUÇÃO</p>
              <h2 id="form-title">Assine este manifesto.</h2>
              <p>Sua assinatura é um gesto por uma Minas Gerais mais justa, democrática e corajosa.</p>
            </div>
            <LeadForm />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <img className="iza-logo" src="/LOGO.webp" alt="Logo Iza Lourença" loading="lazy" />
          <div className="footer-center">
            <nav className="social-links" aria-label="Redes sociais">
              <a href="#inicio" aria-label="Instagram">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.8" r="1" className="filled" /></svg>
              </a>
              <a href="#inicio" aria-label="Facebook">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.45-3H14V8.1c0-.87.28-1.46 1.55-1.46H17.6V3.95c-.35-.05-1.5-.15-2.83-.15-2.8 0-4.72 1.7-4.72 4.85V10H7v3h3.05v8H14Z" className="filled" /></svg>
              </a>
              <a href="#inicio" aria-label="X">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.25 2.5h3.15l-6.88 7.87 8.1 10.72h-6.34l-4.95-6.48-5.68 6.48H2.5l7.35-8.4L1.99 2.5h6.4l4.47 5.91 5.39-5.91Zm-1.1 16.99h1.75L7.44 4.02H5.56l11.59 15.47Z" className="filled" /></svg>
              </a>
              <a href="#inicio" aria-label="TikTok">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 5.62c1.1.8 2.32 1.25 3.73 1.3v3.46c-1.35-.04-2.62-.35-3.73-.9v5.52a5.33 5.33 0 1 1-7.22-4.98v3.7a1.86 1.86 0 1 0 2.65 1.68V2.75h4.3v2.87Z" className="filled" /></svg>
              </a>
            </nav>
            <p>© 2026 IZA LOURENÇA - Pré-candidata a Deputada Estadual pelo PSOL. Todos os direitos reservados.</p>
            <button className="privacy-link" type="button" onClick={() => setIsPrivacyOpen(true)}>Política de privacidade</button>
          </div>
          <img className="psol-logo" src="/psol-logo.webp" alt="PSOL" loading="lazy" />
        </div>
      </footer>
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </>
  )
}
