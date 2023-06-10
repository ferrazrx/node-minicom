import { Modem } from "./src/modem";

type Port = Omit<InternalPort, "modem" | "callPhoneNumber">;
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

  callPhoneNumber() {
    console.log(this.phone);
    const back = "OK";
    const cmd = `ATD${this.phone};`;
    const timeout = 1000;

    this.modem.sendAt(cmd, back, timeout);
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
        console.log("Failed to setup port: ", path);
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

    console.log("Index default error handler: ", obj.error);

    // errorPorts.push(obj.port);
  }
}
