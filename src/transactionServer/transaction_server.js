import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';

const PROTO_PATH = '../manager.proto';
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});

const manager_proto = grpc.loadPackageDefinition(packageDefinition).manager;

const transactions = [];

const clientServer = new manager_proto.ClientService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

function verifyClient(clientId){
    return new Promise((resolve, reject) => {
        clientServer.ConsultClient({id: clientId},
        (error, response) => {
            if(error) {
                reject(error);
            }
            else {
                resolve(response);
            }
        });
    });
}

async function requestTransaction(call, callback) {
    const {client_id, value, type, description} = call.request;
    try {
        const client = await verifyClient(client_id);
        let actual_balance = client.balance;
        if(actual_balance < value){
            return callback(null, {
                success: false, 
                message: "Dont't have enought money",
                balance: actual_balance
            });
        }
        actual_balance -= value;

        const newTransaction = {
            id: uuidv4(),
            client_id,
            value,
            type,
            description,
            date: new Date().toISOString()
        };
        transactions.push(newTransaction);
        console.log('New transaction completed', newTransaction);
        callback(null, {
            success: true,
            message: 'successful transaction',
            balance: actual_balance
        });
    
    }
    catch(error){
        console.error("Fail to find client:",  error.details);
        if(error.code == grpc.status.NOT_FOUND){
            return callback({
                code: grpc.status.NOT_FOUND, 
                details: 'Client Not Foud'
            });
        }
        return callback(error);
    }
}

function consultTransactions(call){
    const clientId = call.request.id;
    const clientTransactions = transactions.filter(
        t => t.id === clientId
    );

    clientTransactions.forEach(transaction => {
        call.write(transaction);
    });

    call.end();
}

function main(){
    const server = new grpc.Server();
    server.addService(manager_proto.TransactionService.service,{
        RequestTransaction: requestTransaction,
        ConsultTransaction: consultTransactions
    });

    server.bindAsync('0.0.0.0:50052', grpc.ServerCredentials.createInsecure(),(error, port) => {
        if(error){
            console.error('Fail to initialize server:',error);
            return;
        }
        console.log(`Server running on: ${port}`);
    });
}

main();
