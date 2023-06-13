import { Data, Modem } from "./src/modem";

type Port = Omit<
  InternalPort,
  "modem" | "callPhoneNumber" | "sendShortMessage" | "audioMessage"
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

  async audioMessage(){
    const cmd = `AT+CPCMREG=1`;
    await this.modem.writeRaw(cmd);
  }

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
      
      if(await this.modem.writeRaw("AT+CMGF=1")){
  
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
