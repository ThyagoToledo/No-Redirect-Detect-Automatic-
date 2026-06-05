# Padroes de Documentacao e Estilo do Repositorio

Este documento define as diretrizes permanentes de estilo, layout e organizacao de arquivos para este e futuros repositorios desenvolvidos. Estas regras garantem uma apresentacao profissional e padronizada.

---

## Diretrizes Gerais

### 1. Logo e Imagem Representativa
- Todo README principal deve ter um espaco dedicado a imagem ou logotipo que represente o projeto.
- A imagem deve ser centralizada no topo do arquivo utilizando a tag HTML `<p align="center">`.
- Para imagens locais servidas diretamente pelo repositorio, a largura maxima deve ser obrigatoriamente configurada como `width="250px"` para evitar distorcoes de layout.
- Exemplo:
  ```html
  <p align="center">
    <img src="Icons/Logo.png" alt="Logo do Projeto" width="250px" />
  </p>
  ```

### 2. Badges de Tecnologias (Icones Profissionais)
- O inicio do README principal, logo abaixo do logo do projeto, deve conter badges profissionais gerados pelo Shields.io listando as tecnologias e linguagens chaves utilizadas.
- Os badges devem ser centralizados e organizados lado a lado de forma harmonica.
- Exemplo de sintaxe:
  ```markdown
  <p align="center">
    <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
    <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  </p>
  ```

### 3. Pasta de Documentacao (doc) e Hub
- Toda explicacao detalhada, guias passo a passo, requisitos de entrega, configuracoes de deploy especificas ou manuais tecnicos devem ser extraidos do README principal e armazenados em arquivos Markdown especificos dentro da pasta `doc/`.
- O README principal deve atuar como um portal/hub simplificado e conceitual, apresentando apenas os objetivos do projeto, a estrutura de diretorios e um **Hub de Documentacao**.
- O Hub de Documentacao consiste em uma lista de links diretos e claros para os arquivos contidos em `doc/`.
- Todos os caminhos de arquivos devem ser referenciados usando links markdown relativos.

### 4. Uso de Emojis
- Emojis unicode sao terminantemente proibidos em documentos tecnicos (arquivos na pasta `doc/`) e no corpo geral do README.md.
- A **unica excecao** e a secao "Estrutura do Projeto" no README principal, onde emojis podem ser utilizados nos blocos de codigo ou listas para representar graficamente pastas (pastas representadas por emojis como pasta/arquivo) e arquivos, facilitando a leitura da arvore de diretorios.

### 5. Dados de Contato e Email
- O email institucional ou de contato pessoal do desenvolvedor deve ser configurado e padronizado em todas as paginas e documentos do projeto como `thyagotoledoassis@gmail.com`.
- Nenhum outro endereco de email antigo ou pessoal deve constar na documentacao ou nos arquivos HTML publicos.

### 6. Secao do Autor no Rodape
- Todo README principal deve finalizar com a secao do autor formatada em uma tabela HTML centralizada contendo a foto de perfil oficial do GitHub do desenvolvedor e o link para seu perfil.
- Exemplo de formato estrutural:
  ```html
  ## Autor

  <table>
    <tr>
      <td align="center">
        <a href="https://github.com/ThyagoToledo">
          <img src="https://github.com/ThyagoToledo.png" width="100px;" alt="Thyago Toledo"/>
          <br />
          <sub><b>Thyago Toledo</b></sub>
        </a>
      </td>
    </tr>
  </table>

  ---

  Este projeto e disponibilizado sob os termos da licenca MIT. Para mais detalhes consulte o arquivo de licenca do repositorio.
  ```
