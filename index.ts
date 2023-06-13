import { Data, Modem } from "./src/modem";

type Port = Omit<
  InternalPort,
  "modem" | "callPhoneNumber" | "sendShortMessage"
>;
type Ports = {
  [path: string]: InternalPort;
};

export class InternalPort {
  constructor(
    public path: string,
    public baudRate: number,
    public phone: string,
    public modem: Modem,
    public type?: string
  ) {}

  async callPhoneNumber({
    onData,
    onError 
  }:{
    onData?: (data: Data)=> void,
    onError?: (e: Error)=> void,
  }) {
    onData && this.modem.on('data', onData)
    onError && this.modem.on('error', onError)

    const cmd = `ATD${this.phone};`;
    const result = await this.modem.writeRaw(cmd);
    return result;
  }

  //TODO:
  // def ReceiveShortMessage():
  // 	rec_buff = ''
  // 	console.log('Setting SMS mode...')
  // 	send_at('AT+CMGF=1','OK',1)
  // 	send_at('AT+CPMS=\"SM\",\"SM\",\"SM\"', 'OK', 1)
  // 	answer = send_at('AT+CMGR=1','+CMGR:',2)
  // 	if 1 == answer:
  // 		answer = 0
  // 		if 'OK' in rec_buff:
  // 			answer = 1
  // 			console.log(rec_buff)
  // 	else:
  // 		console.log('error%d'%answer)
  // 		return False
  // 	return True
  // }

  async sendShortMessage({
    text,
    onData,
    onError 
  }:{
    text: string,
    onData?: (data: Data)=> void,
    onError?: (e: Error)=> void,
  }) {
    try{
      onData && this.modem.on('data', onData)
      onError && this.modem.on('error', onError)

      console.log("Setting SMS mode...");
      
      if(await this.modem.writeRaw("AT+CMGF=1")){
        console.log("Sending Short Message...");
        if(await this.modem.writeRaw('AT+CMGS="' + this.phone + '"')){
          this.modem.writeRaw("", false);
          this.modem.writeRaw(text, false);
          this.modem.writeRaw("\x1A", false);
          return true
        }else{
          throw new Error('Sending +CMGS failed!')
        }
      }else{
        throw new Error('Sending +CMGF failed!')
      }
    }catch(e){
      console.error(e)
      return false;
    }
  }
}

export default class Minicom {
  activePorts: Ports = {};
  static list = Modem.list;

  constructor(ports?: Port[]) {
    if (ports) {
      ports.forEach((port) => {
        this.addPort(port);
      });
    }
  }

  addPort = (
    { path, baudRate, phone, type }: Port,
 
  ) => {
    // Return already active port if set the same path
    const keys = Object.keys(this.activePorts);
    if (keys.includes(path)) {
      console.warn(
        "Trying to readd a port already in use, using initial port!"
      );
      return this.activePorts[path];
    }

    if (path) {
      const modem = new Modem({ path, baudRate });
      if (modem) {
        const port = new InternalPort(path, baudRate, phone, modem, type);

        this.activePorts[path] = port;
        return this.activePorts[path];
      } else {
        console.error("Failed to setup port: ", path);
        throw new Error("Failed to setup port: " + path);
      }
    } else {
      throw new Error(
        "No path provided, please add a path to your options. Found: " + path
      );
    }
  };
}
