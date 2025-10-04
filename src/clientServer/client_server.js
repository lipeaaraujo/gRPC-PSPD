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

// Database
const clients = new Map();

function registerClient(call, callback) {
    const {name, credit_limit} = call.request;
    const id = uuidv4();
    const newClient = {
        id,
        name,
        credit_limit,
        balance: 0
    };
    clients.set(id, newClient);
    console.log('New client:', newClient);
    callback(null, newClient);
}

function consultClient(call, callback) {
    const client = clients.get(call.request.id);
    if(client){
        callback(null, client);
    }
    else {
        callback({
            code: grpc.status.NOT_FOUND,
            details: "Client not found"
        });
    }
}

function main(){
    const server = new grpc.Server();
    server.addService(manager_proto.ClientService.service, {
        RegisterClient: registerClient,
        ConsultClient: consultClient
    });
    server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(),(err, port) => {
        if(err) {
            console.error('Fail to initialize server:',err);
            return;
        }
            
        console.log(`Client Serve Running on: ${port}`);
    });
}

main();
