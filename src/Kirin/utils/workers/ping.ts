import { parentPort, workerData } from 'worker_threads';
import { BedrockPingOptions, JavaPingOptions, PingData, pingBedrockServer, pingJavaServer } from '../ping.js';

if (!parentPort) process.exit(1);

const pingOptions: JavaPingOptions|BedrockPingOptions = workerData;
const pingData: PingData = pingOptions.protocol === 'java' ? await pingJavaServer(pingOptions) : await pingBedrockServer(pingOptions);

parentPort.postMessage(pingData);
