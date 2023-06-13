import {SerialPort, SerialPortOpenOptions, ReadlineParser} from "serialport";
import { EventEmitter } from "events";
import Stream from "stream";
import { AutoDetectTypes } from "@serialport/bindings-cpp";

const Serial = SerialPort;
const State = {
  CREATED: "CREATED",
  WRITTING: "WRITTING",
  IDLE: "IDLE",
} as const;

const formatOutput = (string: string)=> {
  return string.replace(/(\r\n|\n|\r|>)/gm, "").trim()
}

export class Modem extends EventEmitter {
  static list = Serial.list;
  public serialPort: SerialPort<AutoDetectTypes>;
  public activeCommand: string = "";

  private state = {
    initial: null,
    current: null,
    previous: null,
  };
  writeable: boolean = false;
  readable: boolean = false;

  constructor(opts: SerialPortOpenOptions<AutoDetectTypes>) {
    super();
    Stream.Stream.call(this);
    this.serialPort = this.setupPort(opts);
  }

  setupPort(opts: SerialPortOpenOptions<AutoDetectTypes>) {
    const serialPort = new Serial(opts);
    const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }))
    this.state.initial = State.CREATED;
    this.writeable = true;
    this.readable = true;

    parser.on("data", this.dataHandler.bind(this));
    parser.on("error", this.errorHandler.bind(this));
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

  dataHandler(buffer: string) {
    const data = formatOutput(buffer)
    const cmd = formatOutput(this.activeCommand)

    // Return if empty line or Ok line without command
    if(!data || data === "") return;
    if(cmd === '' && data === "OK") return;

    const result = this.handleState(
      this.state,
      cmd,
      data,
    );
   
    this.activeCommand = ''
    this.write(result);
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
    state.previous = state.current;
    if (code === '' && cmd === '') {
      state.current = "DATA_RECEIVING";
    } else {
      if(cmd.match(/^AT\+CMGF/)){
        switch (code) {
          case "OK":
            state.current = "MESSAGE_ACKNOWLEDGED";
            break;
          default:
            state.current = "MESSAGE_NOT_ACKNOWLEDGED";
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

      if(code.match(/^\+CMGS/)){
        state.current = "MESSAGE_SENT";
      }
    }
    return { state, cmd, code };
  }
}
