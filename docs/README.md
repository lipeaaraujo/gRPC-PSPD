# Monitoramento/observabilidade de aplicações em clusters K8S

**Disciplina:** FGA0244 - Programação para Sistemas Paralelos e Distribuídos<br>
**Turma:** 02<br>
**Data:** 07/12/2025<br>
**Semestre:** 2025.2

## Integrantes:

| Nome | Matrícula |
|------|-----------|
| Felipe Amorim de Araújo | 221022275 |
| Gabryel Nicolas Soares de Sousa | 221022570 |
| Julio Roberto da Silva Neto | 221022041 |
| Pablo Serra Carvalho | 221008679 |
| Raquel Ferreira Andrade | 211062437 |

## 1. Introdução

O presente relatório documenta o projeto de pesquisa desenvolvido no âmbito da disciplina de Programação para Sistemas Paralelos e Distribuídos. O trabalho tem como foco central a exploração de estratégias de monitoramento e observabilidade em aplicações distribuídas, utilizando o Kubernetes.

A aplicação escolhida foi o sistema distribuído de transações financeiras implementado previamente na atividade extraclasse. O sistema é dividido em três serviços principais, o Client Server responsável pelo gerenciamento de clientes, o Transaction Server que realiza o processamento de transações, e o stub Web Servers sendo o gateway HTTP que expõe APIs REST.

Este documento está organizado de forma a detalhar a descrever a experiência técnica de montagem da infraestrutura e apresentar os resultados obtidos nos testes comparativos e posteriormente descrever as conclusões obtidas a partir do experimento.

## 2. Metodologia

<!-- A metodologia utilizada (como cada grupo se organizou para realizar a atividade, incluindo um roteiro
sobre os encontros realizados e o que ficou resolvido em cada encontro) -->
    
### Encontros

| Data | Resumo da reunião |
| ---- | ----------------- |
| 01/12 | Os integrantes se reuniram para baixar as ferramentas a serem utilizadas e definir a estrátegia de desenvolvimento do trabalho. |
| 02/12 | Começamos a escrever a estrutura base do relatório, definindo os principais tópicos. |
| 03/12 | Criação do cluster kubernetes, utilizando o kind; configuração do Kubernets Dashboard, interface para monitoramento web das métricas; estudo e instalação do Prometheus e Grafana |
| 05/12 | Implementação das métricas na API; criação dos scripts de testes de carga; criação dos cenários |
| 06/12 | Conexão da aplicação com o Prometheus para coletar as métricas; realização dos testes |


## 3. Montagem do cluster Kubernetes

> Observação: Deixamos todos os arquivos de configuração do Kubernetes na pasta `grpc/k8s/`. Portanto, todos os comandos de `kubectl apply -f <nome-do-arquivo>.yaml` devem ser executados a partir dessa pasta.

### Configuração do Kind

No trabalho anterior, utilizamos o Minikube para criação do cluster Kubernetes. Porém, para esse trabalho decidimos utilizar o Kind (Kubernetes IN Docker), que é uma ferramenta para rodar clusters Kubernetes locais usando contêineres Docker como nós do cluster. Decidimos utilizar o Kind por sua facilidade de configuração e leveza, especialmente para ambientes de desenvolvimento e testes locais.

Primeiro, instalamos o Kind seguindo as instruções oficiais do repositório do [Kind no GitHub](https://kind.sigs.k8s.io/docs/user/quick-start/). Depois criamos um arquivo de configuração `config.yaml` para definir o master e os worker nodes do nosso cluster:

```yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```
Para criar o cluster, executamos o comando `kind create cluster --name app-transacoes-cluster --config config.yaml`.

Com isso, criamos um cluster Kubernetes chamado `app-transacoes-cluster` com 1 master node e 2 worker nodes. Para verificar se o cluster foi criado corretamente, utilizamos o comando `kind get clusters`.

Devemos ver o nome do cluster listado. Também podemos verificar os pods e nós criados com os comandos `kubectl get pods -n kube-system` e `kubectl get nodes`, respectivamente.

Para a definição dos deployments e services, reutilizamos os arquivos `.yaml` criados no trabalho anterior (`db-deployment.yaml` e `deployment.yaml`) que definem os volumes, deployments e services correspondentes dos bancos de dados, dos serviços gRPC e da nossa Web API Gateway. Aplicamos os deployments com o comando `kubectl apply -f <nome-do-arquivo>.yaml`.

E para conferir, usamos o comando `kubectl get pods -owide`, que também mostra a distribuição dos pods nos worker nodes, ou `kubectl get svc` que mostra os serviços criados. Ao executar devemos ver os seguintes pods em execução:

```
NAME                       READY   STATUS    RESTARTS   AGE
db-client-xxxxxx           1/1     Running   0          2m3s
db-transaction-xxxxxx      1/1     Running   0          2m3s
client-grpc-server-xxxxxx  1/1     Running   0          2m3s
transaction-grpc-server-xxxxxx 1/1     Running   0          2m3s
web-grpc-server-xxxxxx     1/1     Running   0          2m3s
```
Para acesso da aplicação via localhost, utilizamos o port-forward do serviço `web-grpc-server` para a porta `8080`:

```bash
kubectl port-forward svc/web-grpc-server 8080:8080
```

### Interface de Monitoramento Web

Para interface de monitoramento web, usamos o Kubernetes Dashboard. Para fazer sua instalação, utilizamos o [Helm](https://helm.sh/docs/intro/install/) para adicionar o repositório do Kubernetes Dashboard:

```bash
helm repo add kubernetes-dashboard https://kubernetes.github.io/dashboard
```
E instanciar os recursos do dashboard em um novo namespace chamado `kubernetes-dashboard`.

```bash
helm upgrade --install kubernetes-dashboard kubernetes-dashboard/kubernetes-dashboard --create-namespace --namespace kubernetes-dashboard
```
Com isso, podemos verificar se todos os recursos foram instânciados com o comando `kubectl get all -n kubernetes-dashboard`. Depois precisamos fazer o port-forward do serviço para acessar pelo localhost na porta `8443`.

```bash
kubectl -n kubernetes-dashboard port-forward svc/kubernetes-dashboard-kong-proxy 8443:443
```

Assim, conseguimos acessar no https://localhost:8443.

Para geração do token precisamos gerar um recurso `ServiceAccount` definido no arquivo `service-account.yml`:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: admin-user
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: admin-user
  namespace: kubernetes-dashboard
---
apiVersion: v1
kind: Secret
metadata:
  name: admin-user
  namespace: kubernetes-dashboard
  annotations:
    kubernetes.io/service-account.name: "admin-user"   
type: kubernetes.io/service-account-token  
```
Aplicando o recurso com `kubectl apply -f service-account.yml`. Podemos então gerar o token para acessar o Kubernetes Dashboard, com o comando `kubectl get secret admin-user -n kubernetes-dashboard -o jsonpath="{.data.token}" | base64 -d`.

### Setup do Metrics Server

Após a instalação do Kubernetes Dashboard, percebemos que as métricas dos pods não estavam sendo exibidas corretamente. Isso ocorreu porque o Metrics Server, que é responsável por coletar e agregar métricas de recursos do cluster, não estava instalado.

Para visualizarmos as métricas de cada pod no Kubernetes Dashboard também fizemos a instalação do Metrics Server por meio do Helm:

```bash
helm repo add metrics-server https://kubernetes-sigs.github.io/metrics-server/
```
Após adicionar o repositório, fazemos a instalação:
```bash
helm upgrade --install metrics-server metrics-server/metrics-server
```
Depois da instalação tivemos que lidar com um erro no deployment e no replicaset do metrics-server. Para corrigir, editamos diretamente o deployment pelo comando `kubectl -n default edit deployment metrics-server`. procurando a seguinte seção e adicionando as seguintes linhas:

```yaml
spec:
    containers:
    - args:
      - --cert-dir=/tmp
      - --secure-port=4443
      - --kubelet-preferred-address-types=InternalIP,ExternalIP,Hostname
      - --kubelet-use-node-status-port
      - --metric-resolution=15s
      command: # linha nova
      - /metrics-server # linha nova
      - --kubelet-insecure-tls # linha nova
      - --kubelet-preferred-address-types=InternalIP # linha nova
```
Após isso conseguimos visualizar as métricas no Kubernetes Dashboard corretamente.

![kubernetes-dashboard-metrics](assets/kubernetes-dashboard-metrics.png)

No decorrer do trabalho, porém, acabamos não utilizando o Kubernetes Dashboard para monitoramento, optando por utilizar o Prometheus e os dashboards disponíveis no Grafana que nos forneceram as informações que nos forão necessárias para análise de desempenho da aplicação.

## 4. Monitoramento e observabilidade

### Setup do Prometheus e Grafana

<!-- Utilizamos o prometheus em conjunto com o grafana para fazer o monitoramento do cluster. -->

Para monitoramento das métricas do cluster e da aplicação, utilizamos o Prometheus em conjunto com o Grafana (uma ferramenta de criação de dashboards para visualização de métricas). Para facilitar a instalação, utilizamos o Helm para instalar o chart `kube-prometheus-stack`, que inclui tanto o Prometheus quanto o Grafana, além de outros componentes úteis para monitoramento em clusters Kubernetes.

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install prometheus prometheus-community/kube-prometheus-stack
```
Após instalar o chart, devemos fazer port forwards para conseguirmos acessar o Prometheus e o Grafana:

```bash
kubectl port-forward svc/prometheus-kube-prometheus-prometheus 9090:9090
kubectl port-forward svc/prometheus-grafana 3000:80
```
Para fazer login no grafana é necessário conseguir a senha de acesso, rodando o comando `kubectl get secret --namespace default prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode ; echo`. O user padrão é o admin.

Após a instânciação do Prometheus e do Grafana, tivemos que fazer modificações na aplicação original, especificamente no Web API Gateway, para expor métricas que pudessem ser coletadas pelo Prometheus. Para isso, utilizamos a biblioteca `prometheus-client` para Python, que nos permitiu criar um endpoint `/metrics` no web server que expõe as métricas no formato esperado pelo Prometheus.

Após isso instanciamos um `ServiceMonitor` para o Prometheus coletar as métricas específicamente do web server. O arquivo `service-monitor.yaml` é o seguinte:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: web-grpc-server-monitor
  labels:
    release: prometheus
spec:
  selector:
    matchLabels:
      app: web-grpc-server
  endpoints:
  - port: metrics
    interval: 15s
```
Aplicamos o arquivo com o comando `kubectl apply -f webserver-monitor.yaml`.

Após todo o setup, conseguimos ter então o Prometheus coletando as métricas do cluster e do web server, e o Grafana exibindo essas métricas em dashboards customizados.

Em relação aos dashboards do Grafana, utilizamos um dashboard pré-existente para monitoramento de clusters Kubernetes, disponível no [Grafana Labs](https://grafana.com/grafana/dashboards/15661-k8s-dashboard-en-20250125/) ou no arquivo JSON exportado `dashboard-cluster.json`. Esse dashboard nos forneceu uma visão abrangente do desempenho do cluster e dos pods, incluindo métricas como uso de CPU, memória, rede e armazenamento.

Para o monitoramento específico da aplicação, criamos um dashboard customizado no Grafana `dashboard-k6.json`, focado nas métricas expostas pelo web server, como requisições por segundo, latência e taxa de erros. Com esses dashboards, conseguimos monitorar o desempenho da aplicação em tempo real durante os testes de carga.

## 5. Aplicação de transações financeiras

A aplicação consiste em um sistema de gerenciamento de transações financeiras, utilizando uma arquitetura de microsserviços que se comunicam via gRPC. A base desta comunicação é definida no arquivo de contrato .proto, que estabelece os serviços e as mensagens trocadas entre eles:

```proto
syntax = "proto3";
package manager;

service ClientService{
    rpc RegisterClient (RegisterClientRequest) returns (Client);
    rpc ConsultClient (ConsultClientRequest) returns (Client);
}

message Client {
    string id = 1;
    string name = 2;
    string credit_limit = 3;
    double balance = 4;
}

message RegisterClientRequest {
    string name= 1;
    double credit_limit= 2;
}

message ConsultClientRequest {
    string id = 1;
}

// -------------------------------------------------------

service TransactionService {
    rpc RequestTransaction (PerformTransaction) returns (TransactionResponse);
    rpc ConsultTransaction (ConsultClientRequest) returns (stream Transaction);
}

message PerformTransaction {
    string client_id = 1;
    double value = 2;
    string type = 3;
    string description = 4;
}

message TransactionResponse {
    bool success = 1;
    string message = 2;
    double balance = 3;
}

message Transaction {
    string id = 1;
    string client_id = 2;
    double value = 3;
    string type = 4;
    string description = 5;
    string date = 6;
}
```

No núcleo do sistema, o **Serviço de Cliente (ClientService)** é o 
responsável por toda a gestão dos dados dos clientes, incluindo seus limites de crédito e saldos. Ele expõe, através de gRPC, as operações para registrar um novo cliente e consultar os dados de um cliente existente.

Em paralelo, o **Serviço de Transação (TransactionService)** lida com a lógica financeira, processando as transações de crédito e débito. Este serviço oferece uma função para solicitar novas transações, outra para consultar o histórico de transações de um cliente, que retorna os resultados em modo stream para maior eficiência e uma terceira função para obter o extrato consolidado do cliente. Essa última operação também se comunica com o Serviço de Cliente diretamente para obter informações atualizadas do cliente.

Para interagir com o mundo exterior, uma **API Gateway** desenvolvida em Python com FastAPI atua como a fachada HTTP do sistema. Ela traduz as requisições web para chamadas gRPC internas. Para o gerenciamento de clientes, a API expõe os endpoints POST e GET Para as operações financeiras. Os endpoints desse serviço são:
- `POST /clients`: Cria um novo cliente.
- `GET /clients/{client_id}`: Recupera os dados de um cliente específico.
- `POST /transactions`: Registra uma nova transação (crédito ou débito).
- `GET /transactions/{client_id}`: Retorna o histórico de transações de um cliente em modo stream.
- `GET /extrato/{client_id}`: Fornece o extrato consolidado do cliente.

### Modificações para Monitoramento

<!-- - Criamos endpoint para métricas usando bibliotecas do Prometheus no web server, e com isso tivemos que atualizar a imagem docker do web server e subir para o Docker Hub.
- Criamos ServiceMonitor para o Prometheus coletar as métricas do web server -->

Para integrar o monitoramento via Prometheus, fizemos algumas modificações na API Gateway. Implementamos um endpoint `/metrics` utilizando a biblioteca `prometheus-client` para Python, que expõe métricas como contagem de requisições, latência e taxa de erros. Para isso também atualizamos a imagem Docker do web server e a subimos para o Docker Hub.

![endpoint-metrics](assets/endpoint-metrics.png)

Após isso, criamos um `ServiceMonitor` no Kubernetes para que o Prometheus pudesse coletar essas métricas do web server conforme descrito na seção de monitoramento.

## 6. Testes feitos

<!-- Em qualquer cenário de teste, é importante:
- Documentar os atributos/métricas que serão testados
- Uso do Prometheus para monitorar/observar a aplicação e o ambiente testado
- Uso de ferramental de teste para submissão da aplicação a diferentes cargas de trabalho (demandas)
- Garantir as mesmas condições de teste de infraestrutura para os testes de modo a não contaminar
os resultados
- Para cada cenário montado, fazer teste de carga, observar o comportamento da aplicação e anotar
as conclusões -->

<!-- Além das alternativas de variação da associação da aplicação em contêiners, é possível alterar (i) a quantidade de instâncias de cada módulo da aplicação, (ii) a quantidade de contêineres nos worker nodes, (iii) o número de worker nodes disponibilizados no cluster, (iv) a variação da carga de trabalho submetida, entre outros. A escolha deve ser feita de modo a garantir osrequisitos de monitoramento e observabilidade da aplicação. -->

### Ferramental de Teste

Para os testes de carga, utilizamos a ferramenta [K6](https://k6.io/), que é uma ferramenta de código aberto para testes de carga e desempenho. Ela permite simular múltiplos usuários virtuais (VUs) realizando requisições à aplicação, possibilitando a avaliação do desempenho sob diferentes cargas de trabalho.

> Observação: O guia para instalação e configuração da ferramenta está no arquivo ![Guia para Executar Testes com K6](tests/README.md).

Com ela criamos um script de teste em JavaScript (`k6_test.js`) que simula uma série de operações típicas realizadas pelos usuários da aplicação, incluindo o registro de clientes, a realização de transações e a consulta de extratos. O script também coleta métricas importantes como tempo de resposta, taxa de erros e throughput.

No script definimos 5 fluxos de testes diferentes, cada um com diferentes níveis de carga (número de usuários virtuais e duração do teste), tivemos que realizar vários testes para definir os valores ideais para cada fluxo de forma que fossem representativos do comportamento da aplicação sob diferentes condições de carga e que pudessem retratar os limites da aplicação. Os fluxos definidos foram:
- Fluxo 1: warm-up (5 VUs por 60 segundos) acionando apenas o endpoint base do web server.
- Fluxo 2: carga leve (10 VUs por 120 segundos) realizando operações de registro e consulta de clientes.
- Fluxo 3: picos de demanda (50 VUs por 10 segundos depois 30 segundos em 100 VUs e 10 segundos em 0 VUs) simulando picos de demanda.
- Fluxo 4: estresse (aumento gradativo de 20 a 80 VUs por 300 segundos) para identificar os limites da aplicação.
- Fluxo 5: carga de leitura intensiva (20 VUs pré-alocadas e 50 VUs máximas por 60 segundos) focando em consultas de extrato.

### Configuração base

A infrastrutura base utilizada para os testes consistiu em um cluster contendo 1 master node e 2 worker nodes. Cada módulo da aplicação (Client Service, Transaction Service e Web API Gateway) foi implantado em pods separados, com uma única réplica de cada serviço e sem escalonamento automático habilitado.

### Cenários de testes

**Cenário Base (Baseline)**

Este cenário estabelece o desempenho inicial da aplicação na configuração mais simples, servindo como referência para todas as comparações de teste. Ele foi feito instanciando a aplicação na configuração base descrita acima, executando os testes de carga com a ferramenta k6 com o objetivo de medir:

1. O **tempo médio de resposta** por requisição;  
2. A **quantidade máxima de requisições processadas por segundo** . 

Após a execução dos testes, coletamos os seguintes resultados de utilização de CPU:

![grafico-pods-cpu](assets/base-case-cpu.png)

Os seguintes resultados de tempo de resposta e throughput:

![grafico-base-case](assets/base-case-requests.png)

### Cenários de Variação (Otimização e Elasticidade)

Estes cenários focam em comparar resultados variando as características do cluster K8S e da aplicação para otimizar desempenho e elasticidade.

#### Cenário 2.1: Teste de Limite de Estresse (*Stress Test*)

**Objetivo:** Simular uma grande quantidade de requisições para "estressar" a aplicação e identificar seus limites antes de falhas ou degradação do serviço.

* **Variação:** Aumento progressivo e significativo da carga de trabalho submetida.
* **Carga:** Iniciar com uma carga alta (Ex: 50 VUs) e aumentar gradativamente (Ex: 100 VUs, 200 VUs) até a aplicação atingir uma taxa de erro (>5%) ou latência inaceitável.
* **Foco:**
    * Identificar o gargalo (qual módulo P, A ou B atinge 100% de CPU/Memória).
    * Correlacionar métricas de *throughput* e latência com o uso de recursos do *Pod* (via Prometheus).
* **Métricas:** Tempo de resposta (avg e p95), Taxa de Erros, Uso de CPU/Memória do *Pod* crítico.

#### Cenário 2.2: Otimização por Paralelização (Aumento de Réplicas)

**Objetivo:** Verificar como o escalonamento horizontal (aumento de instâncias) de um microsserviço impacta o desempenho sob carga elevada.

* **Variação:** Alterar a quantidade de instâncias (`replicas`) de um ou mais módulos da aplicação.
    * **Exemplo 1:** Aumentar o `Deployment` do `TransactionService` (B) para 3 réplicas.
    * **Exemplo 2:** Aumentar o `Deployment` do `WEB API` (P) para 3 réplicas.
* **Carga:** Aplicar a carga de estresse do Cenário 2.1 (ou uma carga constante alta) em cada variação.
* **Foco:** Comparar o *throughput* e a latência com o Cenário 2.1 e Cenário Base. Identificar a configuração que oferece o melhor desempenho.
* **Métricas:** As mesmas do Cenário 2.1, observando a distribuição da carga entre os novos *Pods* criados.

#### Cenário 2.3: Elasticidade com Horizontal Pod Autoscaler (HPA)

**Objetivo:** Demonstrar e avaliar a capacidade de *autoscaling* do Kubernetes para se adaptar automaticamente a picos de demanda.

* **Variação:** Ativar o **Horizontal Pod Autoscaler (HPA)** no `Deployment` do módulo que mais se beneficiou do escalonamento (provavelmente P ou B).
    * **Configuração HPA:** Definir um alvo de utilização de CPU (ex: 50%) e limites mínimo/máximo de réplicas (ex: min 1, max 5).
* **Carga:** Aplicar uma carga de trabalho variável (picos e vales) para forçar o HPA a *escalar* (adicionar *Pods*) e *diminuir* (remover *Pods*).
* **Foco:**
    * Medir o tempo de resposta durante os eventos de *scaling*.
    * Observar a criação e remoção dos *Pods* em tempo real (via Prometheus/Grafana).
* **Métricas:** Latência, *throughput*, e contagem de réplicas do *Deployment* afetado ao longo do tempo.

#### Cenário 2.4: Distribuição de Carga entre Worker Nodes

**Objetivo:** Observar o impacto da distribuição física dos *Pods* entre os Worker Nodes na performance sob carga, testando a capacidade total do cluster.

* **Variação:** Aplicar uma carga de estresse (Cenário 2.1) sob duas configurações de Worker Node:
    * **Configuração 1 (Cluster Mínimo):** Rodar o teste com 2 WNs.
    * **Configuração 2 (Maior Capacidade - Opcional):** Aumentar o número de WNs e repetir o teste para avaliar o limite de *throughput*.
* **Carga:** Carga de estresse (Cenário 2.1).
* **Foco:** Latência e *throughput* em função da capacidade total de processamento do cluster K8S.

### 6.2 Relatos dos testes
* **Testes 2.1** - O objetivo desse cenário de testes era estressar a aplicação para descobrir os limites que permitiriam que obtivessemos o melhor proveito nos cenários restantes. Identificamos que 500 VU eram bons para iniciar os cenarios de teste, e que uma progressão gradual em direção a 1000 usuário era o suficiente para colocar o sistema sob estresse. Um dos principais pontos de dificuldade identificado foi o webSere, que consumiu todo o espaço de CPU destinado a ele na configuração básica.

![imagem grafica](assets/grafico-21.png) 


### Métricas Gerais

| Indicador | Valor |
|------------|--------|
| Tempo médio de resposta (avg) | **144,43 ms** |
| Mediana (P50) | 78,07 ms |
| Throughput máximo | **124,03 req/s** |
| Taxa de sucesso | 99,6% |
| Duração total dos testes | 7min 30s |


### Análise

- **Desempenho Estável:** O sistema mantém latências baixas e throughput consistente até ~20 VUs.  
- **Endpoint de Extrato:** Apresenta maior custo computacional devido à agregação de dados e múltiplas consultas.  
- **Resiliência:** Nenhum crash durante o stress test, apenas aumento nas respostas acima de 6 segundos em picos.  
- **Limitação Natural:** A ausência de réplicas limita a escalabilidade e gera contenção no banco em cenários de pico.
   

## 7. Conclusão

<!-- Conclusão – texto conclusivo em função da experiência realizada, comentários sobre dificuldades e soluções encontradas. Ao final, cada membro do grupo abre uma subseção para comentários pessoais sobre a pesquisa, indicando as partes que mais trabalhou, aprendizados e uma nota de autoavaliação. -->
### 
### Dificuldades
* Uma das maiores dificuldades encontradas foi a formatação de Dashboards adequadas as informações que desejávemos extrair. Encontramos diversos problemas, como o acumulo do valor de váriaveis e dissincronização da monitoração do web-Server. A pouca documentação oficial tornou díficil encontrar informações que nos auxiliassem no desenvolvimento do sistema.

### Tabela de Contribuição

| Matrícula | Nome | Contribuições | Autoavaliação (0-10) |
|-----------|------|---------------|-----------------------|
| 221022275 | Felipe Amorim de Araújo |  |  |
| 221022041 | Julio Roberto da Silva Neto |  |  |
| 221022570 | Gabryel Nicolas Soares de Sousa | |  |   
| 221008679 | Pablo Serra Carvalho |  |  |
| 211062437 | Raquel Ferreira Andrade |  |  |

## 8. Referências

- https://prometheus.io/docs/introduction/overview/
- https://kubernetes.io/
- https://k6.io/
- https://kind.sigs.k8s.io
- https://helm.sh/docs/intro/install/
- https://howtodevez.medium.com/setting-up-kubernetes-dashboard-with-kind-ccd22fdd03e8
- https://kubernetes.io/docs/tasks/access-application-cluster/web-ui-dashboard/
- https://github.com/kubernetes-sigs/metrics-server?tab=readme-ov-file
- https://www.youtube.com/watch?v=-k0VrvWaaOg

## Anexos

