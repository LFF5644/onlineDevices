const net=require("net");

const port=8734;
let clients=[];
const clientTemplate={
	deviceName: null,
	id: null,
	socket: null,
	uptime: null,
};

function updateClient(client){
	const clientId=client.id;
	clients=clients.map(item=>item.id!==clientId?item:{
		...item,
		...client,
	});
	updateConnectedClientsCount();
}
function addClient(client){
	client={
		...clientTemplate,
		...client,
	};
	clients.push(client);
	updateConnectedClientsCount();
	return client;
}
function removeClient(client){
	const clientId=client.id;
	clients=clients.filter(item=>item.id!==clientId);
	updateConnectedClientsCount();
}
function updateConnectedClientsCount(){
	const connectedClients=clients.filter(item=>item.deviceName);
	process.title=`${connectedClients.length} clients connected`;
}

const tcpServer=net.createServer(socket=>{
	const id=Date.now();
	const client=addClient({
		id,
		socket,
	});

	socket.on("data",data=>{
		const command=data.toString("utf-8");
		if(
			!client.deviceName&&
			!command.startsWith("set deviceName\n")
		){
			socket.end();
		}
		else if(
			!client.deviceName&&
			command.startsWith("set deviceName\n")
		){
			const deviceName=Buffer.from(command.split("\n")[2],command.split("\n")[1]).toString("utf-8");
			console.log(`${deviceName} has connected from ${socket.localAddress}`);
			client.deviceName=deviceName;
			updateClient({id,deviceName});
		}
		else if(
			client.deviceName&&
			command.startsWith("set deviceName\n")
		){
			console.log(`${client.deviceName} try to change his deviceName`);
		}
	});
	socket.on("end",()=>{
		if(client.deviceName){
			console.log(`${client.deviceName} has disconnected!`);
		}
		removeClient({id});
	})
});

tcpServer.listen(port,()=>console.log("Server is running on Port "+port));
