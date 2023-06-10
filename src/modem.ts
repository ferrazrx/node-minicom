import * as serialPort from "serialport";
import { EventEmitter } from "events";
import Stream from "stream";
import { AutoDetectTypes } from "@serialport/bindings-cpp";
import { sleep } from "./utils";
import { GPIOManager } from "./gpio";

const Serial = serialPort.SerialPort;

export class Modem extends EventEmitter {
  static list = Serial.list;
  public serialPort: serialPort.SerialPort<AutoDetectTypes>;

  private GPIO: GPIOManager;

  private state = {
    initial: null,
    current: null,
    previous: null,
  };
  writeable: boolean = false;
  readable: boolean = false;

  constructor(opts: serialPort.SerialPortOpenOptions<AutoDetectTypes>) {
    super();
    Stream.Stream.call(this);
    this.serialPort = this.setupPort(opts);

    this.GPIO = new GPIOManager();
  }

  setupPort(opts: serialPort.SerialPortOpenOptions<AutoDetectTypes>) {
    const serialPort = new Serial(opts);
    this.state.initial = "CREATED";
    this.writeable = true;
    this.readable = true;

    serialPort.on("data", this.dataHandler.bind(this, opts.path));
    serialPort.on("error", this.errorHandler.bind(this, opts.path));
    return serialPort;
  }

  formatCmd(str: string) {
    let ret = str;
    const beginning = "AT";
    const end = "\r\n";

    str.trim();
    if (!str.match(/^AT/)) ret = beginning + ret;
    if (!str.match(/[\r\n]+$/)) ret = ret + end;

    return ret;
  }

  async sendAt(command: string, timeout: number) {
    return new Promise<boolean>(async (resolve, reject) => {
      await this.GPIO.powerOn();
      const encodedCommand = this.formatCmd(command);
      console.log("RUNNING: ", encodedCommand);
      this.serialPort.write(encodedCommand, (error) => {
        if (error) {
          console.error(error);
          reject(false);
        }
        console.log("MESSAGE RECEIVED!");
        resolve(true);
      });
      await await sleep(timeout);
      this.GPIO.powerDown();
    });
  }

  async writeRaw(buf) {
    // this.activeCmd = (typeof buf === 'string') ? buf : (buf === undefined) ? '' : buf.toString();
    // this.state.previous = this.state.current;
    // this.state.current = 'WRITTING';
    if (Buffer.isBuffer(buf)) this.serialPort.write(buf);
    else if (typeof buf === "string") {
      buf = this.formatCmd(buf);
      this.serialPort.write(buf);
    }
    return this;
  }

  dataHandler(path: string, data: Buffer, a, b, c) {
    console.log(a, b, c, data.toString());

    // const ret = this.handleState(
    //   this.state,
    //   this.activeCmd,
    //   data.code,
    //   data.data
    // );
    /*  if (data.code) {
    if (data.data.indexOf(this.activeCmd) === -1) data.data.unshift(this.activeCmd);
    this.emit('data', {data:data, port: port});
  }
*/
    // if (ret) {
    //   //@ts-ignore
    //   ret.data.path = path;
    //   //@ts-ignore
    //   ret.data.state = ret.state.current;
    //   if (ret.state.current.match(/^(CALL|ANSWER|HANGUP)/i))
    //     this.emit("call", ret.data);
    //   else this.emit("data", ret.data);
    // }
  }

  write(data) {
    this.emit("data", data);
  }

  end(data) {
    if (data) this.write(data);
    this.emit("end");
  }

  close() {
    this.writeable = false;
    this.readable = false;
    this.emit("close");
  }

  destroy() {
    this.close();
  }

  errorHandler(path, err: unknown) {
    console.log("Modem error: ", err);
    const e = new Error(path + " has failed to load: " + err);
    //@ts-ignore
    this.emit("error", { error: e, path });
  }

  init(initStr) {
    const i = this.formatInit(initStr);
    console.log("Init string: ", i);
    this.writeRaw(i);
    return this;
  }

  formatInit(init) {
    // let str = "";
    // const c = cmd.INIT;
    // if (typeof init === "string") str = this.formatCmd(init);
    // else {
    //   init = init || {};
    //   Object.assign(c, init);
    //   for (x in c) {
    //     if (x.match(/^S/)) {
    //       str += x + "=" + c[x] + " ";
    //     } else {
    //       str += x + c[x] + " ";
    //     }
    //   }
    // }
    // return this.formatCmd(str);
  }

  handleState(state, cmd, code, data) {
    console.log(state, cmd, code, data);
    var obj = {
      cmd: cmd,
      code: code,
      data: data,
    };

    state.previous = state.current;
    if (!code && data.length) {
      state.current = "DATA_RECEIVING";
      return { state: state, data: obj };
    } else if (code && cmd) {
      if (cmd.match(/^ATDT/i)) {
        switch (code) {
          case "OK":
            state.current = "CALL_CALLING";
            break;
          case "RING":
            state.current = "CALL_RINGING";
            break;
          case "CONNECT":
            state.current = "CALL_CONNECTED";
            break;
          case "ERROR":
            state.current = "CALL_FAILED";
            break;
          case "NO CARRIER":
            state.current = "CALL_NO_LINE";
            break;
          case "BUSY":
            state.current = "CALL_BUSY";
            break;
          default:
            state.current = "CALL_UNKNOWN";
        }
      } else if (cmd.match(/^ATA/i)) {
        switch (code) {
          case "OK":
            state.current = "ANSWER_SUCCESS";
            break;
          case "ERROR":
            state.current = "ANSWER_FAILED";
            break;
          default:
            state.current = "ANSWER_UNKNOWN";
        }
      } else if (cmd.match(/^ATH/i)) {
        switch (code) {
          case "OK":
            state.current = "HANGUP_SUCCESS";
            break;
          case "ERROR":
            state.current = "HANGUP_FAILED";
            break;
          default:
            state.current = "HANGUP_UNKNOWN";
        }
      }
      return { state: state, data: obj };
    }
  }
}
