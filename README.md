# Manual da Vida Adulta (Flutter Web)

Plataforma interativa de educação prática e tradução de burocracia, alinhada à **ODS 4 (Meta 4.4)** da ONU.
Design minimalista em **Roxo (`#6A1B9A`) e Branco (`#FFFFFF`)**.

## Estrutura de Pastas (Arquitetura Modular)

```text
lib/
├── main.dart                                 # Ponto de entrada da aplicação
├── core/
│   ├── auth/
│   │   └── auth_service.dart                 # Gerenciamento simples de sessão (ChangeNotifier)
│   ├── router/
│   │   └── app_router.dart                   # Rotas protegidas e públicas com GoRouter
│   └── theme/
│       └── app_theme.dart                    # Identidade visual em Roxo e Branco
└── features/
    ├── landing/
    │   └── landing_page.dart                 # Página inicial pública
    ├── auth/
    │   └── login_page.dart                   # Tela de Login e Cadastro rápido
    ├── dashboard/
    │   └── dashboard_page.dart               # Painel principal com os módulos separados
    ├── emprego/                              # Módulo 1: Primeiro Emprego & CLT
    │   ├── logic/
    │   │   └── holerite_calculator.dart      # Lógica de cálculo de INSS, IRRF, VT e FGTS
    │   └── presentation/
    │       └── holerite_page.dart            # Simulador de Holerite Interativo (Raio-X)
    ├── financas/
    │   └── presentation/
    │       └── financas_page.dart            # Módulo 2: Juros do Cartão e Imposto de Renda
    ├── carreira/
    │   └── presentation/
    │       └── curriculo_page.dart           # Módulo 3: Gerador de Currículo ATS
    └── moradia/
        └── presentation/
            └── contrato_page.dart            # Módulo 4: Scanner de Contrato de Aluguel
```

## Como rodar o projeto

1. Certifique-se de ter o **Flutter SDK** instalado.
2. Crie um projeto web ou copie a pasta `lib/` e o `pubspec.yaml` para seu diretório:
   ```bash
   flutter create manual_vida_adulta --platforms=web
   ```
3. Substitua o `pubspec.yaml` e a pasta `lib/` pelos arquivos deste ZIP.
4. Instale as dependências e execute no navegador:
   ```bash
   flutter pub get
   flutter run -d chrome
   ```
