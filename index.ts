import { Modem } from "./src/modem";

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

  async callPhoneNumber(timeout: number = 30 * 1000) {
    const cmd = `ATD${this.phone};`;
    const result = await this.modem.sendAt(cmd, timeout);
    return result;
  }

  async sendShortMessage(textMessage: string) {
    console.log("Setting SMS mode...");

    const result = await this.modem
      .sendAt("AT+CMGF=1", 1000)
      .then(async (result) => {
        if (result) {
          console.log("Sending Short Message...");
          await this.modem
            .sendAt('AT+CMGS="' + this.phone + '"', 1000)
            .then((result) => {
              if (result) {
                this.modem.writeRaw(textMessage + "\r\n");
                this.modem.writeRaw("\x1A");
                this.modem.writeRaw("^z");
              }
            });
        }
      });
  }
}

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
    success_cb?: () => void,
    error_cb?: () => void
  ) => {
    // Return already active port if set the same path
    const keys = Object.keys(this.activePorts);
    if (keys.includes(path)) {
      console.warn(
        "Trying to readd a port already in use, using initial port!"
      );
      return this.activePorts[path];
    }

    const success =
      typeof success_cb === "function"
        ? success_cb
        : this.defaultSuccessHandler;
    const error =
      typeof error_cb === "function" ? error_cb : this.defaultErrorHandler;

    if (path) {
      const modem = new Modem({ path, baudRate });
      if (modem) {
        const port = new InternalPort(path, baudRate, phone, modem, type);

        this.activePorts[path] = port;
        modem.on("error", error);
        modem.on("data", success);
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

  defaultSuccessHandler(obj) {
    console.log("Index default success handler: ", obj.data);
  }

  defaultErrorHandler(obj) {
    const errorPorts = [];

    console.error("Index default error handler: ", obj.error);

    // errorPorts.push(obj.port);
  }
}
