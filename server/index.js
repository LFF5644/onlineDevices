#!/usr/bin/env node
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
	sendUpdateClients("update",clientId);
}
function addClient(client){
	if(!client.id) throw new Error("addClient: client.id is undefined");
	client={
		...clientTemplate,
		...client,
	};
	clients.push(client);
	sendUpdateClients("add",client.id);
	return client;
}
function removeClient(client){
	const clientId=client.id;
	clients=clients.filter(item=>item.id!==clientId);
	sendUpdateClients("remove",clientId);
}
function sendUpdateClients(type,id){
	if(
		type==="add"||
		type==="update"
	){
		const client=clients.find(item=>item.id===id);
		const hexArrayClient=[
			Buffer.from(String(client.id),"utf-8").toString("hex"),
			Buffer.from(String(client.deviceName),"utf-8").toString("hex"),
			Buffer.from(String(client.uptime),"utf-8").toString("hex"),
		].join(",");
		for(const client of clients){
			if(!client.deviceName) continue;
			send(client.socket,"action updateClientItem\nhex-array\n"+type+"\n"+hexArrayClient);
		}
	}
	else if(type==="remove"){
		for(const client of clients){
			if(!client.deviceName) continue;
			send(client.socket,"action updateClientItem\nraw\n"+type+"\n"+id);
		}
	}
	else{
		throw new Error("type is not allowed!");
	}
}
function send(socket,msg){return new Promise((resolve,reject)=>{
	socket.write(msg+"$END$",error=>{
		if(error){
			console.log(error);
			reject(error);
			return;
		}
		console.log("send: "+msg)
		resolve();
	});
})}
function getClient(id){
	return clients.find(item=>item.id===id);
}
function onClientCommand(id,command){
	let client=getClient(id);
	const socket=client.socket;
	console.log(`${client.deviceName}: ${JSON.stringify(command)}`);
	hasDeviceName:{
		if(
			!client.deviceName&&
			!command.startsWith("set deviceName\n")
		){
			socket.end();
			return;
		}
		else if(
			!client.deviceName&&
			command.startsWith("set deviceName\n")
		){
			const deviceName=Buffer.from(command.split("\n")[2],command.split("\n")[1]).toString("utf-8");
			console.log(`${deviceName} has connected from ${socket.localAddress}`);
			client.deviceName=deviceName;
			updateClient({id,deviceName});
			send(socket,"action connection-active");
		}
		else if(
			client.deviceName&&
			command.startsWith("set deviceName\n")
		){
			console.log(`${client.deviceName} try to change his deviceName`);
		}
	}

	if(command==="action shutdown-server"){
		if(!client.deviceName.toLowerCase().startsWith("lff-")) return;
		console.log(`${client.deviceName} shutdown the Server...`);
		for(const client of clients){
			send(client.socket,`action log-msg\nutf-8\n${client.deviceName} shutdown the Server...`);
			client.socket.end();
		}
		tcpServer.close(error=>{
			if(error) console.log("Server cant stop Error:",error);
			else console.log("Server has shutting down!");
		});
		process.exit(0);
	}
	else if(command==="get clients"){
		console.log(`send clients to ${client.deviceName}`);
		const connectedDevices=(clients
			.filter(item=>item.deviceName)
			.map(item=>(
				[
					Buffer.from(String(item.id),"utf-8").toString("hex"),
					Buffer.from(String(item.deviceName),"utf-8").toString("hex"),
					Buffer.from(String(item.uptime),"utf-8").toString("hex"),
				].join(",")
			))
			.join(";")
		);
		send(socket,"set clients\nhex-array\n"+connectedDevices);
	}
}

const tcpServer=new net.Server();
tcpServer.on("connection",socket=>{
	const id=String(Date.now());
	const client=addClient({
		id,
		socket,
		uptime: String(Date.now()),
	});

	socket.on("data",data=>{
		let commands=(data
			.toString("utf-8")
			.split("$END$")
			.filter(item=>item)
		);
		for(const command of commands){
			onClientCommand(id,command);
		}
	});
	socket.on("close",()=>{
		if(client.deviceName){
			console.log(`${client.deviceName} has disconnected!`);
		}
		removeClient({id});
	});
});
tcpServer.on("listening",()=>console.log("Server is running on Port "+port));
tcpServer.listen(port);
tcpServer.on("close",()=>{
	console.log("Server Closed!");
	setTimeout(()=>tcpServer.listen(port),1e3);
});
