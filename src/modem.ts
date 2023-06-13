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
  return string.replace(/(\r\n|\n|\r|[0-9]|>|:)/gm, "").trim()
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

    serialPort.on("data", this.dataHandler.bind(this));
    serialPort.on("error", this.errorHandler.bind(this));
    return serialPort;
  }

  formatCmd(str: string) {
    let result = str;
    const end = "\r\n";
    str.trim();
    if (!str.match(/[\r\n]+$/)) result = result + end;
    return result;
  }

  async writeRaw(command: string, shouldFormat: boolean = true) {

    return new Promise<boolean>(async (resolve, reject) => {
    const formattedCommand = shouldFormat ? this.formatCmd(command) : command;
    this.activeCommand += command;
    this.state.previous = this.state.current;
    this.state.current = State.WRITTING;
    this.serialPort.write(formattedCommand, (error)=>{
      this.state.current = State.IDLE;
   
      resolve(true);
      if (error) {
        console.error(error);
        reject(false);
      }
    });
    })
  }

  dataHandler(data: Buffer) {

    const result = this.handleState(
      this.state,
      formatOutput(this.activeCommand),
      formatOutput(data.toString()),
    );
    this.activeCommand = ''
    this.write(result);
    this.serialPort.flush();
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

  handleState(state, cmd, code) {
    //+CMGS
    state.previous = state.current;
    if (!code && !cmd) {
      state.current = "DATA_RECEIVING";
    } else if (code && cmd) {
      if(cmd.match(/^AT\+CMGF/i)){
        switch (code) {
          case "OK":
            state.current = "MESSAGE_ACKNOWLEDGED";
            break;
          default:
            state.current = "MESSAGE_NOT_ACKNOWLEDGED";
            break
        }
      }

      if(cmd.match(/^\+CMGS/i)){
        switch (code) {
          case "OK":
            state.current = "MESSAGE_SENT";
            break;
          default:
            state.current = "MESSAGE_NOT_SENT";
            break
        }
      }
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
    }
    return { state, cmd, code };
  }
}
