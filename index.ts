import { SerialPort } from "serialport";
import { Modem } from "./src/modem";

type InternalPort = Port & { modem: SerialPort; callPhone: () => void };
type Ports = {
  [path: string]: InternalPort;
};

export type Port = {
  baudRate: number;
  phone: string;
  path: string;
  type?: string;
};

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
        this.activePorts[path] = {
          modem: modem.serialPort,
          phone,
          baudRate,
          path,
          callPhone: this.callPhoneNumber.bind(this),
          type,
        };
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

  callPhoneNumber(port: InternalPort) {
    const back = "OK";
    const cmd = `ATD${port.phone};`;
    const timeout = 1000;

    console.log(cmd);
  }
}
