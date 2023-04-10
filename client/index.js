const net=require("net");
const os=require("os");

const host=process.env.host||"127.0.0.1";
const port=process.env.port||8734;
const deviceName=process.env.deviceName||os.hostname()||"no name";

const socket=new net.Socket();

socket.on("connect",()=>{
	console.log(`Connected! Host ${host} with Port ${port}`);
	socket.write(`set deviceName\nhex\n${Buffer.from(deviceName,"utf-8").toString("hex")}`);
});
socket.on("data",data=>{
	const command=data.toString("utf-8");
	
	if(command.startsWith("action log-msg\n")){
		console.log("SERVER-LOG: "+Buffer.from(command.split("\n")[2],command.split("\n")[1]).toString("utf-8"));
	}
});
socket.on("close",isError=>{
	if(isError) console.log("Disconnect by error");
	process.stdout.write("Disconnected! Reconnect to Server ...\r");
	setTimeout(()=>socket.connect(port,host),1e3);
})
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
		socket.write("action shutdown-server");
	}
	else if(command==="disconnect"){
		socket.end();
	}
	else{
		console.log("Command not found!");
	}
});

process.stdout.write("Connecting to Server ...\r");
socket.connect(port,host);
