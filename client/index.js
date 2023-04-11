#!/usr/bin/env node
const net=require("net");
const os=require("os");

const host=process.env.host||"127.0.0.1";
const port=process.env.port||8734;
const deviceName=process.env.deviceName||os.hostname()||"no name";
let clients=[];
const clientTemplate={
	deviceName: null,
	id: null,
	uptime: null,
};

function connect(){
	socket.connect(port,host);
}
function updateClient(client){
	const clientId=client.id;
	clients=clients.map(item=>item.id!==clientId?item:{
		...item,
		...client,
	});
}
function addClient(client){
	if(!client.id) throw new Error("addClient: client.id is undefined");
	client={
		...clientTemplate,
		...client,
	};
	clients.push(client);
	return client;
}
function removeClient(client){
	const clientId=client.id;
	clients=clients.filter(item=>item.id!==clientId);
}
function onServerCommand(command){
	console.log(`cmd: ${JSON.stringify(command)}`);

	if(command.startsWith("action log-msg\n")){
		console.log("SERVER-LOG: "+Buffer.from(command.split("\n")[2],command.split("\n")[1]).toString("utf-8"));
	}
	else if(command.startsWith("set clients\n")){
		let [_cmd,codec,data]=command.split("\n");

		if(codec.endsWith("-array")){
			const encodeCodec=codec.split("-")[0];
			clients=(data
				.split(";")
				.map(item=>
					item
						.split(",")
						.map(i=>
							Buffer.from(i,encodeCodec).toString("utf-8")
						)

				)
				.map(item=>({
					deviceName: item[1],
					id: item[0],
					uptime: item[2],
				}))
			);
			console.log(`set clients; length: ${clients.length}, deviceNames: ${clients.map(item=>'"'+item.deviceName+'"').join(" ")}`);
		}
		else{
			console.log(`codec ${codec} not found!`);
		}
	}
	else if(command==="action connection-active"){
		send("get clients");
	}
	else if(command.startsWith("action updateClientItem\n")){
		const [_cmd,codec,action,data]=command.split("\n");
		if(codec.endsWith("-array")){
			const encodeCodec=codec.split("-")[0];
			let decodedClient=(data
				.split(",")
				.map(item=>Buffer.from(item,encodeCodec).toString("utf-8"))
			);
			decodedClient={
				deviceName: decodedClient[1],
				id: decodedClient[0],
				uptime: decodedClient[2],
			};
			if(action==="add") addClient(decodedClient);
			else if(action==="update") updateClient(decodedClient);
			else throw new Error("action "+action+" is not allowed!");
		}
		else if(codec==="raw"){
			if(action==="remove") removeClient({id:data});
			else throw new Error("action "+action+" is not allowed!");
		}
		else throw new Error("codec "+codec+" not found");
	}
	else{
		console.log(`command ${JSON.stringify(command)} not found`);
	}
}
function send(msg){return new Promise((resolve,reject)=>{
	socket.write(msg+"$END$",error=>{
		if(error){
			reject(error);
			return;
		}
		resolve();
	});
})}

const socket=new net.Socket();

socket.on("connect",()=>{
	console.log(`Connected! Host ${host} with Port ${port}`);
	send(`set deviceName\nhex\n${Buffer.from(deviceName,"utf-8").toString("hex")}`);
});
socket.on("data",data=>{
	let commands=(data
		.toString("utf-8")
		.split("$END$")
		.filter(item=>item)
	);
	for(const command of commands){
		onServerCommand(command);
	}
});
socket.on("close",isError=>{
	if(!isError) process.stdout.write("Disconnected! Reconnect to Server ...\r");
	setTimeout(connect,1e3);
});
socket.on("error",error=>{
	if(error.code==="ECONNREFUSED"){
		process.stdout.write("Connection refused! retry in 5s\r");
	}
	else if(error.code==="ECONNRESET"){
		process.stdout.write("Server has Crashed!\r");
	}
	else throw error;
});
process.stdin.on("data",buffer=>{
	const command=(buffer
		.toString("utf-8")
		.toLocaleLowerCase()
		.trim()
	);

	if(socket.closed){
		console.log("Client not connected!");
		return;
	}

	if(command==="shutdown"){
		console.log("Shutdown Server...");
		send("action shutdown-server");
	}
	else if(command==="disconnect"){
		socket.end();
	}
	else{
		console.log("Command not found!");
	}
});

process.stdout.write("Connecting to Server ...\r");
connect();
