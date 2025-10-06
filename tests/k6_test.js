import http from 'k6/http';
import { check, sleep } from 'k6';

// Configurações gerais
export const options = {
  vus: 100,            // número de usuários virtuais
  duration: '60s',   // duração total do teste
  thresholds: {
    http_req_failed: ['rate<0.01'], // menos de 1% de falhas
    http_req_duration: ['p(95)<500'], // 95% das requisições em <500ms
  },
};

const BASE_URL = 'http://localhost:8000'; // altere se necessário

export default function () {
  // 1️⃣ Testa endpoint raiz
  const resRoot = http.get(`${BASE_URL}/`);
  check(resRoot, {
    'GET / responde 200': (r) => r.status === 200,
    'mensagem correta': (r) => r.json().message === 'API ON',
  });

  // 2️⃣ Criação de cliente
  const clientPayload = JSON.stringify({
    name: `Cliente_${__VU}_${__ITER}`, // nome aleatório
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

  // 3️⃣ Consulta cliente criado
  const resGetClient = http.get(`${BASE_URL}/clients/${clientId}`);
  check(resGetClient, {
    'GET /clients/{id} -> 200': (r) => r.status === 200,
    'nome do cliente correto': (r) => r.json().name.startsWith('Cliente_'),
  });

  // 4️⃣ Criação de transação
  const transactionPayload = JSON.stringify({
    client_id: clientId,
    value: Math.random() * 200,
    type: 'DEBIT',
    description: 'Teste de carga',
  });

  const resCreateTransaction = http.post(`${BASE_URL}/transactions`, transactionPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(resCreateTransaction, {
    'POST /transactions -> 200 ou 201': (r) => [200, 201].includes(r.status),
  });

  // 5️⃣ Consulta transações do cliente
  const resGetTransactions = http.get(`${BASE_URL}/transactions/${clientId}`);
  check(resGetTransactions, {
    'GET /transactions/{id} -> 200': (r) => r.status === 200,
    'retorna lista de transações': (r) => Array.isArray(r.json().transactions),
  });

  // 6️⃣ Consulta extrato
  const resExtrato = http.get(`${BASE_URL}/extrato/${clientId}`);
  check(resExtrato, {
    'GET /extrato/{id} -> 200': (r) => r.status === 200,
    'extrato possui cliente': (r) => r.json().client !== undefined,
    'extrato possui summary': (r) => r.json().summary !== undefined,
  });

  sleep(0.05); // pequena pausa entre iterações
}
