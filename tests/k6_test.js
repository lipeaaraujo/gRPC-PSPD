import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

const clientCreationErrors = new Counter('client_creation_errors');
const transactionErrors = new Counter('transaction_errors');
const extratoErrors = new Counter('extrato_errors');
const successRate = new Rate('success_rate');
const clientCreationTime = new Trend('client_creation_duration');
const transactionTime = new Trend('transaction_duration');
const extratoTime = new Trend('extrato_duration');

// Configurações gerais
export const options = {
 // Múltiplos cenários com diferentes padrões de carga
  scenarios:
   {

  //cenario 1
   warmup: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 5 },  
        { duration: '30s', target: 5 }, 
      ],
      gracefulRampDown: '10s',
      exec: 'warmupScenario',
    },
  //cenario 2

    constant_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '1m', 
      exec: 'mainScenario',
    },
    //cenario 2

    spike_test: {
      executor: 'ramping-vus',
      startTime: '3m',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 }, 
        { duration: '30s', target: 50 },  
        { duration: '10s', target: 0 },   
      ],
      gracefulRampDown: '5s',
      exec: 'spikeScenario',
    },
    
    // Cenario 4
    stress_test: {
      executor: 'ramping-vus',
      startTime: '4m',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '30s', target: 40 },
        { duration: '30s', target: 60 },
        { duration: '30s', target: 80 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
      exec: 'stressScenario',
    },
    // Cenario 5
    read_heavy: {
      executor: 'constant-arrival-rate',
      rate: 100, 
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      startTime: '6m30s',
      exec: 'readHeavyScenario',
    },
  },
  
  thresholds: {
    http_req_failed: ['rate<0.05'],           
    http_req_duration: ['p(95)<1000'],        
    http_req_duration: ['p(99)<2000'],        
    'http_req_duration{name:create_client}': ['p(95)<800'],
    'http_req_duration{name:create_transaction}': ['p(95)<600'],
    'http_req_duration{name:get_extrato}': ['p(95)<500'],
    success_rate: ['rate>0.95'],              
    client_creation_errors: ['count<50'],
    transaction_errors: ['count<100'],
    extrato_errors: ['count<50'],
  },
};

const BASE_URL = 'http://localhost:8080'; 

let clientPool = [];


function createClient() {
  const payload = JSON.stringify({
    name: `Cliente_${__VU}_${__ITER}_${Date.now()}`,
    credit_limit: Math.floor(Math.random() * 5000) + 500,
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/clients`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create_client' },
  });
  clientCreationTime.add(Date.now() - startTime);

  const success = check(res, {
    'POST /clients -> 201': (r) => r.status === 201,
    'retorna id do cliente': (r) => r.json() && r.json().id,
  });

  if (!success) {
    clientCreationErrors.add(1);
    return null;
  }

  successRate.add(1);
  return res.json().id;
}

function createTransaction(clientId, type = 'd') {
  const payload = JSON.stringify({
    client_id: clientId,
    value: Math.floor(Math.random() * 500) + 10,
    type: type,
    description: `Transação ${type === 'c' ? 'crédito' : 'débito'} teste K6`,
  });

  const startTime = Date.now();
  const res = http.post(`${BASE_URL}/transactions`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'create_transaction' },
  });
  transactionTime.add(Date.now() - startTime);

  const success = check(res, {
    'POST /transactions -> sucesso': (r) => [200, 201].includes(r.status),
  });

  if (!success) {
    transactionErrors.add(1);
  } else {
    successRate.add(1);
  }

  return success;
}

function getExtrato(clientId) {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/extrato/${clientId}`, {
    tags: { name: 'get_extrato' },
  });
  extratoTime.add(Date.now() - startTime);

  const success = check(res, {
    'GET /extrato/{id} -> 200': (r) => r.status === 200,
    'extrato válido': (r) => r.json() && r.json().client && r.json().summary,
  });

  if (!success) {
    extratoErrors.add(1);
  } else {
    successRate.add(1);
  }

  return success;
}

function getClient(clientId) {
  const res = http.get(`${BASE_URL}/clients/${clientId}`, {
    tags: { name: 'get_client' },
  });

  const success = check(res, {
    'GET /clients/{id} -> 200': (r) => r.status === 200,
  });

  if (success) successRate.add(1);
  return success;
}

function getTransactions(clientId) {
  const res = http.get(`${BASE_URL}/transactions/${clientId}`, {
    tags: { name: 'get_transactions' },
  });

  const success = check(res, {
    'GET /transactions/{id} -> 200': (r) => r.status === 200,
    'retorna transações': (r) => r.json() && Array.isArray(r.json().transactions),
  });

  if (success) successRate.add(1);
  return success;
}

export default function () {
  // Testa endpoint raiz
  const resRoot = http.get(`${BASE_URL}/`);
  check(resRoot, {
    'GET / responde 200': (r) => r.status === 200,
    'mensagem correta': (r) => r.json().message === 'API ON',
  });

  // Criacao de cliente
  const clientPayload = JSON.stringify({
    name: `Cliente_${__VU}_${__ITER}`, 
    credit_limit: Math.floor(Math.random() * 1000) + 100,
  });

  const resCreateClient = http.post(`${BASE_URL}/clients`, clientPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(resCreateClient, {
    'POST /clients -> 201': (r) => r.status === 201,
    'retorna id do cliente': (r) => !!r.json().id,
  });

  const clientId = resCreateClient.json().id;

  // Consulta cliente criado
  const resGetClient = http.get(`${BASE_URL}/clients/${clientId}`);
  check(resGetClient, {
    'GET /clients/{id} -> 200': (r) => r.status === 200,
    'nome do cliente correto': (r) => r.json().name.startsWith('Cliente_'),
  });

  // Criacao de transacao
  const transactionPayload = JSON.stringify({
    client_id: clientId,
    value: Math.random() * 200,
    type: 'd',
    description: 'Teste de carga',
  });

  const resCreateTransaction = http.post(`${BASE_URL}/transactions`, transactionPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(resCreateTransaction, {
    'POST /transactions -> 200 ou 201': (r) => [200, 201].includes(r.status),
  });

  // Consulta transações do cliente
  const resGetTransactions = http.get(`${BASE_URL}/transactions/${clientId}`);
  check(resGetTransactions, {
    'GET /transactions/{id} -> 200': (r) => r.status === 200,
    'retorna lista de transações': (r) => Array.isArray(r.json().transactions),
  });

  // Consulta extrato
  const resExtrato = http.get(`${BASE_URL}/extrato/${clientId}`);
  check(resExtrato, {
    'GET /extrato/{id} -> 200': (r) => r.status === 200,
    'extrato possui cliente': (r) => r.json().client !== undefined,
    'extrato possui summary': (r) => r.json().summary !== undefined,
  });

  sleep(0.05); 
}

// CENARIO 1: WARMUP

export function warmupScenario() {
  group('Warmup - Health Check', () => {
    const res = http.get(`${BASE_URL}/`);
    check(res, {
      'API está respondendo': (r) => r.status === 200,
    });
  });

  sleep(1);
}

// CENARIO 2: FLUXO PRINCIPAL COMPLETO

export function mainScenario() {
  group('Fluxo Completo: Criação e Consultas', () => {
    const clientId = createClient();
    if (!clientId) return;

    sleep(0.5);
    getClient(clientId);

    sleep(0.3);
    for (let i = 0; i < 3; i++) {
      const type = Math.random() > 0.5 ? 'd' : 'c';
      createTransaction(clientId, type);
      sleep(0.2);
    }
    getTransactions(clientId);

    sleep(0.3);

    getExtrato(clientId);

    clientPool.push(clientId);
  });

  sleep(Math.random() * 2 + 1); 
}

 
// CENARIO 3: TESTE DE PICO

export function spikeScenario() {
  group('Spike Test - Criação Massiva', () => {
    const clientId = createClient();
    if (clientId) {
      createTransaction(clientId, 'd');
      clientPool.push(clientId);
    }
  });

  sleep(0.1);
}

// CENARIO 4: TESTE DE STRESS

export function stressScenario() {
  group('Stress Test - Operações Mistas', () => {
    if (Math.random() > 0.3) {
      const clientId = createClient();
      if (clientId) {
        createTransaction(clientId, Math.random() > 0.5 ? 'd' : 'c');
        clientPool.push(clientId);
      }
    } else if (clientPool.length > 0) {
      const randomClient = clientPool[Math.floor(Math.random() * clientPool.length)];
      getExtrato(randomClient);
    }
  });

  sleep(0.05);
}

// CENARIO 5: LEITURA INTENSIVA
export function readHeavyScenario() {
  if (clientPool.length === 0) {
    const clientId = createClient();
    if (clientId) clientPool.push(clientId);
    return;
  }

  group('Read Heavy - Consultas Intensivas', () => {
    const randomClient = clientPool[Math.floor(Math.random() * clientPool.length)];
    
    const operation = Math.random();
    
    if (operation < 0.4) {
      getExtrato(randomClient);
    } else if (operation < 0.7) {
      getTransactions(randomClient);
    } else {
      getClient(randomClient);
    }
  });
}


// RELATORIO HTML CUSTOMIZADO

export function handleSummary(data) {
  return {
    'summary.html': htmlReport(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
  };
}
