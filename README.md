# No Redirect (Detect Automatic)

<p align="center">
  <img src="icons/Logo.png" alt="No Redirect Detect Automatic Logo" width="350px" style="border-radius: 24px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
  <img src="https://img.shields.io/badge/Google_Chrome-4285F4?style=for-the-badge&logo=google-chrome&logoColor=white" alt="Google Chrome" />
  <img src="https://img.shields.io/badge/Manifest_V3-Check-green?style=for-the-badge" alt="Manifest V3" />
</p>

Uma extensao abrangente para o navegador Google Chrome construida em Manifest V3 projetada para bloquear redirecionamentos indesejados e sequestros de abas. O sistema monitora de forma proativa as tentativas de redirecionamento em cinco camadas principais do navegador, prevenindo o clickjacking, form hijacking e execucoes maliciosas de scripts de anuncios.

---

## Estrutura do Projeto

```
No-Redirect-Detect-Automatic/
├── 📁 icons/                  # Ícones da extensão e logotipo do projeto
│   ├── 📄 Logo.png            # 🆕 Logotipo do projeto (exibição no README)
│   ├── 📄 icon16.png
│   ├── 📄 icon48.png
│   └── 📄 icon128.png
├── 📁 doc/                    # 🆕 Documentação detalhada
│   ├── arquitetura.md         # Detalhes de arquitetura Manifest V3
│   ├── funcionalidades.md     # Detalhes das camadas de proteção
│   └── readme_standards.md    # Padrões de documentação e estilo do repositório
├── 📄 manifest.json            # Configuração da extensão Chrome
├── 📄 background.js            # Service worker (Camada 2: webNavigation)
├── 📄 content.js               # Content script isolado (Monitoramento DOM)
├── 📄 content_main.js          # Content script principal (Interceptação JS)
├── 📄 product_prerenderer.js   # Sistema de pre-rendering de produtos
├── 📄 rules.json               # Regras do declarativeNetRequest (Camada 1)
├── 📄 popup.html               # Interface popup da extensão
├── 📄 popup.js                 # Lógica e animações do popup
├── 📄 popup.css                # Estilização do popup (Dark Mode)
├── 📄 generate_icons.ps1       # Script de geração de ícones
├── 📄 README.md                 # Este arquivo (Hub)
└── 📄 .gitignore                # Arquivos ignorados pelo Git
```

---

## Hub de Documentacao

A documentacao tecnica detalhada sobre engenharia, camadas de protecao e configuracoes esta organizada na pasta [doc/](doc/):

* **[Camadas de Protecao e Funcionalidades](doc/funcionalidades.md)**: Detalhamento tecnico sobre as cinco camadas do escudo de protecao, recursos visuais do popup e historico de versoes.
* **[Arquitetura e Permissoes](doc/arquitetura.md)**: Especificacoes tecnicas sobre Manifest V3, isolamento de escopo (Main World vs Isolated World), privacidade e guias de customizacao dos seletores de pre-carregamento.
* **[Padroes de Documentacao e Estilo](doc/readme_standards.md)**: Manual de estilo corporativo sobre estrutura de arquivos, regras de logo, badges e autor.

---

## Instalacao

### Do Codigo Fonte (Modo Desenvolvedor)

1. Faca o download ou clone este repositorio em sua maquina
2. Abra o navegador Google Chrome e acesse `chrome://extensions/`
3. Ative a opcao **Modo do desenvolvedor** (canto superior direito)
4. Clique no botao **Carregar sem compactacao** (Load unpacked)
5. Selecione a pasta raiz deste repositorio clonado
6. O icone da extensao estara ativo e pronto para uso no navegador

### Geracao de Icones
Se precisar regenerar os tamanhos dos icones da extensao para empacotamento, execute o script PowerShell na pasta raiz:
```powershell
.\generate_icons.ps1
```

---

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
