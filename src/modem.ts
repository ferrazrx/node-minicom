import * as serialPort from "serialport";
import { EventEmitter } from "events";
import Stream from "stream";
import { AutoDetectTypes } from "@serialport/bindings-cpp";

const Serial = serialPort.SerialPort;
const State = {
  CREATED: "CREATED",
  WRITTING: "WRITTING",
  IDLE: "IDLE",
} as const;

const formatOutput = (string: string)=> {
  return string.replace(/(\r\n|\n|\r|[0-9]|>)/gm, "")
}

export class Modem extends EventEmitter {
  static list = Serial.list;
  public serialPort: serialPort.SerialPort<AutoDetectTypes>;
  public activeCommand: string = "";

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
  }

  setupPort(opts: serialPort.SerialPortOpenOptions<AutoDetectTypes>) {
    const serialPort = new Serial(opts);
    this.state.initial = State.CREATED;
    this.writeable = true;
    this.readable = true;

    serialPort.on("data", this.dataHandler.bind(this, opts.path));
    serialPort.on("error", this.errorHandler.bind(this, opts.path));
    return serialPort;
  }

  formatCmd(str: string) {
    let result = str;
    const end = "\r\n";
    str.trim();
    if (!str.match(/[\r\n]+$/)) result = result + end;
    return result;
  }

  async writeRaw(command: string) {
    return new Promise<boolean>(async (resolve, reject) => {
    const formattedCommand = this.formatCmd(command);
    this.activeCommand = formattedCommand;
    this.state.previous = this.state.current;
    this.state.current = State.WRITTING;
    this.serialPort.write(formattedCommand, (error)=>{
      this.state.current = State.IDLE;
      if (error) {
        console.error(error);
        reject(false);
      }
      resolve(true);
    });
    })
  }



  dataHandler(path: string, data: Buffer) {
    console.log(formatOutput(this.activeCommand), formatOutput(data.toString()));

    const result = this.handleState(
      this.state,
      formatOutput(this.activeCommand),
      formatOutput(data.toString()),
      formatOutput(data.toString())
    );
    console.log(result);
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
    this.emit("error", { error: e, path });
  }

  handleState(state, cmd, code, data) {
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
      if (cmd.match(/^ATD/i)) {
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
