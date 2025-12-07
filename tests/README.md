# Guia para Executar Testes com K6

## Pré-requisitos

Antes de iniciar os testes, verifique se os seguintes requisitos estão atendidos:

- **K6 instalado** (![Documentação oficial](https://k6.io/docs/get-started/installation/))  
- **Cluster Kubernetes ativo** 
- **kubectl configurado** com acesso ao cluster  

---

## Opção 1: Executar Testes LOCALMENTE 

### 1. Configurar a URL no arquivo de teste

Edite o arquivo `k6_test.js` e **altere a linha 98**:

```javascript
const BASE_URL = 'http://localhost:8080';  // Para execução local
```

### 2. Iniciar a aplicação no Kubernetes

```bash
# Verificar status dos deployments
kubectl get deployments

# Verificar se os pods estão rodando
kubectl get pods

# Todos devem estar com status "Running" e "Ready"
```

**Nota**: Para testar a configuração base (1 réplica), ajuste se necessário:
```bash
kubectl scale deployment client-grpc-server --replicas=1
kubectl scale deployment transaction-grpc-server --replicas=1
kubectl scale deployment web-grpc-server --replicas=1
```

### 3. Fazer port-forward do serviço

```bash
# Expor o serviço web na porta 8080 local
kubectl port-forward service/web-grpc-server 8080:8080
```

**Importante**: Deixe esse terminal aberto durante o teste.

### 4. Executar o teste K6 (em outro terminal)
Para instalar o k6, execute os seguintes comandos:
Baixe a chave de segurança
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
```

Adicione o repositorio:
```bash
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
```
Atualize e instale:
```bash
sudo apt-get update
sudo apt-get install k6
```

Após ter instalado a ferramenta, os testes podem ser executados.

```bash
# Navegar até o diretório do projeto
CD <diretório_do_projeto>

# Executar o teste
k6 run tests/k6_test.js

# Ou salvar resultados em JSON
k6 run --out json=tests/results.json tests/k6_test.js
```

### 5. Visualizar resultados

Após o teste, os seguintes arquivos serão gerados:
- `tests/summary.html` - Relatório visual com gráficos
- `tests/summary.json` - Dados brutos em JSON

Para abrir o relatório HTML:

```powershell
Start-Process tests\summary.html
```

## Opção 2: Executar Testes DENTRO DO KUBERNETES 

### 1. Configurar a URL no arquivo de teste

Edite o arquivo `k6_test.js` e **altere a linha 98**:

```javascript
const BASE_URL = 'http://web-grpc-server:8080';  // Para execução no Kubernetes
```

### 2. Deletar recursos anteriores (se existirem)

```bash
kubectl delete job k6-test --ignore-not-found
kubectl delete configmap k6-test --ignore-not-found
```

### 3. Criar ConfigMap com o script de teste

```bash
# Do diretório raiz do projeto
kubectl create configmap k6-test --from-file=tests/k6_test.js
```

### 4. Criar o arquivo k6-job.yaml (passo opcional)

O arquivo já existe em `grpc/k8s/k6-job.yaml`, mas se precisar criar manualmente:

```yaml
# grpc/k8s/k6-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-test
spec:
  template:
    spec:
      containers:
      - name: k6
        image: grafana/k6:latest
        command: ["k6", "run", "/scripts/k6_test.js"]
        volumeMounts:
        - name: k6-test
          mountPath: /scripts
        env:
        - name: K6_OUT
          value: "json=/tmp/results.json"
      volumes:
      - name: k6-test
        configMap:
          name: k6-test
      restartPolicy: Never
  backoffLimit: 0
```

### 5. Aplicar o Job do K6

```bash
kubectl apply -f grpc/k8s/k6-job.yaml
```

### 6. Acompanhar execução em tempo real

```bash
# Ver logs do teste
kubectl logs -f job/k6-test

# Verificar status do job
kubectl get jobs

# Ver pods do K6
kubectl get pods | grep k6-test
```

### 7. Extrair resultados (opcional)

```bash
# Ver o summary completo após conclusão
kubectl logs job/k6-test

# Copiar resultados para arquivo local
kubectl logs job/k6-test > tests/k6_results_kubernetes.txt
```

### 8. Limpar recursos após o teste

```bash
kubectl delete job k6-test
kubectl delete configmap k6-test
```

