import { useState } from 'react'
import LeadForm from './components/LeadForm'
import PrivacyPolicyModal from './components/PrivacyPolicyModal'

const assets = {
  orangeTexture: '/Sem título - 17 de julho de 2026 às 10.15.56-1.webp',
  blueTexture: '/Sem título - 17 de julho de 2026 às 10.15.56-2.webp',
  orangeDots: '/Sem título - 17 de julho de 2026 às 10.15.56-4.webp',
  blueDots: '/Sem título - 17 de julho de 2026 às 10.15.56-5.webp',
  greenDots: '/Sem título - 17 de julho de 2026 às 10.15.56-6.webp',
  yellowDots: '/Sem título - 17 de julho de 2026 às 10.15.56-7.webp',
  sun: '/Sem título - 17 de julho de 2026 às 10.15.56-16.webp',
  sunFine: '/Sem título - 17 de julho de 2026 às 10.15.56-17.webp',
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
        <button type="button" onClick={scrollToForm}>Assine o manifesto <span aria-hidden="true">↘</span></button>
      </header>
      <main id="inicio">
        <section className="hero texture-orange">
          <img className="hero-sun" src={assets.sunFine} alt="" aria-hidden="true" />
          <div className="hero-inner">
            <p className="eyebrow">Manifesto em defesa da chapa</p>
            <h1>Patrus,<br />Áurea<br /><em>e Marília</em></h1>
            <p className="hero-lead">Uma chance única para Minas Gerais.</p>
            <button className="hero-cta" type="button" onClick={scrollToForm}>Veja quem já assinou e assine também <span aria-hidden="true">↓</span></button>
          </div>
        </section>

        <section className="opening blue-section dots-blue" hidden>
          <div className="content-narrow">
            <p className="section-kicker">MINAS PRECISA ESCOLHER UM NOVO CAMINHO</p>
            <h2>Minas é gigante.<br /><em>O nosso futuro também precisa ser.</em></h2>
            <p>Chegou a hora de construir uma chapa que enfrente os desafios do nosso estado com coragem, compromisso e lado.</p>
          </div>
        </section>

        <section className="manifesto">
          <img className="manifesto-sun" src={assets.sun} alt="" aria-hidden="true" loading="lazy" />
          <div className="manifesto-content">
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
            <LeadForm onOpenPrivacy={() => setIsPrivacyOpen(true)} />
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-center">
            <p>Assinado por Iza Lourença, Duda Salabert, Ana Pimentel, Bruno Pedralva, Bella Gonçalves e Célia Xakriabá.</p>
            <button className="privacy-link" type="button" onClick={() => setIsPrivacyOpen(true)}>Política de privacidade</button>
          </div>
        </div>
      </footer>
      <PrivacyPolicyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} />
    </>
  )
}
