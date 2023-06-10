import * as serialPort from "serialport";
import { handleState } from "./state_handler";
import { EventEmitter } from "events";
import Stream from "stream";
import { AutoDetectTypes } from "@serialport/bindings-cpp";

const Serial = serialPort.SerialPort;

export class Modem extends EventEmitter {
  static list = Serial.list;
  public serialPort: serialPort.SerialPort<AutoDetectTypes>;
  private state = {
    initial: null,
    current: null,
    previous: null,
  };
  writeable: boolean = false;
  readable: boolean = false;

  private activeCmd = null;
  private activeResp = null;

  constructor(opts: serialPort.SerialPortOpenOptions<AutoDetectTypes>) {
    super();
    Stream.Stream.call(this);

    this.serialPort = this.setupPort(opts);
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
    const beg = "AT";
    const end = "\r\n";

    str.trim();
    if (!str.match(/^AT/)) ret = beg + ret;
    if (!str.match(/[\r\n]+$/)) ret = ret + end;

    return ret;
  }

  dataHandler(path, data) {
    const ret = handleState(this.state, this.activeCmd, data.code, data.data);
    console.log("Modem data: ", data);
    /*  if (data.code) {
    if (data.data.indexOf(this.activeCmd) === -1) data.data.unshift(this.activeCmd);
    this.emit('data', {data:data, port: port});
  }
*/

    if (ret) {
      //@ts-ignore
      ret.data.path = path;
      //@ts-ignore
      ret.data.state = ret.state.current;
      if (ret.state.current.match(/^(CALL|ANSWER|HANGUP)/i))
        this.emit("call", ret.data);
      else this.emit("data", ret.data);
    }
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

  writeRaw(buf) {
    this.activeCmd =
      typeof buf === "string" ? buf : buf === undefined ? "" : buf.toString();
    this.state.previous = this.state.current;
    this.state.current = "WRITTING";
    if (Buffer.isBuffer(buf)) this.serialPort.write(buf);
    else if (typeof buf === "string") {
      buf = this.formatCmd(buf);
      this.serialPort.write(buf);
    }
    return this;
  }

  dial(dest) {
    const src = this;
    if (typeof dest === "string") return src.writeRaw("ATDT" + dest);
    else {
      src.writeRaw("ATDT" + dest.phone);
      //dest.modem.pipe(src);
    }
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
}
