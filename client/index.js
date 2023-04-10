const net=require("net");
const os=require("os");

const host=process.env.host||"127.0.0.1";
const port=process.env.port||8734;
const deviceName=process.env.deviceName||os.hostname()||"no name";

process.stdout.write("Connecting to server ...\r");
const socket=net.createConnection(port,()=>{
	console.log(`Connected to ${host}:${port}`);
	socket.write(`set deviceName\nhex\n${Buffer.from(deviceName,"utf-8").toString("hex")}`);
	socket.on("data",data=>{
		const command=data.toString("utf-8");
		console.log("command:",command);
	});
	socket.on("end",()=>{
		console.log("disconnected");
	});
})