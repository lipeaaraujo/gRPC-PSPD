/* import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from './generated/prisma/index.js';
const prisma = new PrismaClient();

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
// const clients = new Map();

async function registerClient(call, callback) {
    const {name, credit_limit} = call.request;
    const id = uuidv4();
    const newClient = {
        id,
        name,
        credit_limit,
        balance: 1000
    };
    // clients.set(id, newClient);

    const user = await prisma.user.create({
        data: newClient
    });

    console.log('New client:', user);
    callback(null, user);
}

async function consultClient(call, callback) {
    const client = await prisma.user.findUnique({
        where: { id: call.request.id }
    });
    // const client = clients.get(call.request.id);
    console.log('Consulted client:', client);
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

main(); */
