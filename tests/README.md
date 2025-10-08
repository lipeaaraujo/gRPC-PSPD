# Guia para Executar Testes com K6

## Pré-requisitos
- Instalar o K6: https://k6.io/docs/get-started/installation/
- **Ter a aplicação executando** (versão REST ou gRPC conforme o teste desejado)

## Como executar os testes

1. **Navegue até o diretório de testes:**
   ```bash
   cd tests/
   ```

2. **Execute salvando os resultados em JSON:**
   ```bash
   k6 run --out json=resultados.json k6_test.js
   ```

## Arquivo de teste

O arquivo principal de teste é o `k6_test.js`, que contém os cenários de carga para testar a aplicação.