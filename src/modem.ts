import {SerialPort, SerialPortOpenOptions, ReadlineParser} from "serialport";
import { EventEmitter } from "events";
import Stream from "stream";
import { AutoDetectTypes } from "@serialport/bindings-cpp";

const Serial = SerialPort;
const States = {
  CREATED: "CREATED",
  WRITTING: "WRITTING",
  IDLE: "IDLE",
  MESSAGE_ACKNOWLEDGED: "MESSAGE_ACKNOWLEDGED",
  MESSAGE_NOT_ACKNOWLEDGED: 'MESSAGE_NOT_ACKNOWLEDGED',
  MESSAGE_SENT: "MESSAGE_SENT",
  CALL_CALLING: "CALL_CALLING",
  CALL_RINGING: "CALL_RINGING",
  CALL_CONNECTED: "CALL_CONNECTED",
  CALL_FAILED: "CALL_FAILED",
  CALL_NO_LINE: "CALL_NO_LINE",
  CALL_BUSY: "CALL_BUSY",
  CALL_UNKNOWN: "CALL_UNKNOWN",
  ANSWER_SUCCESS:  "ANSWER_SUCCESS",
  ANSWER_FAILED: "ANSWER_FAILED",
  ANSWER_UNKNOWN: "ANSWER_UNKNOWN",
  HANGUP_SUCCESS: "HANGUP_SUCCESS",
  HANGUP_FAILED: "HANGUP_FAILED",
  HANGUP_UNKNOWN: "HANGUP_UNKNOWN",

} as const;

type State = typeof States[keyof typeof States];

type ModemSTate = {
  initial: State | null,
  current: State | null,
  previous: State | null,
};

export type Data = {
  state: ModemSTate;
  cmd: string;
  code: string;
}

const formatOutput = (string: string)=> {
  return string.replace(/(\r\n|\n|\r|>)/gm, "").trim()
}

export class Modem extends EventEmitter {
  static list = Serial.list;
  public serialPort: SerialPort<AutoDetectTypes>;
  public activeCommand: string = "";

  private state: ModemSTate = {
    initial: null,
    current: null,
    previous: null
  }
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
    this.state.initial = States.CREATED;
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
    this.state.current = States.WRITTING;
    this.serialPort.write(formattedCommand, (error)=>{
      this.state.current = States.IDLE;
   
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

  errorHandler(path: string, err: unknown) {
    console.log("Modem error: ", err);
    const e = new Error(path + " has failed to load: " + err);
    this.emit("error", { error: e, path });
  }

  handleState(state: ModemSTate, cmd: string, code: string) {
    state.previous = state.current;

      if(cmd.match(/^AT\+CMGF/)){
        switch (code) {
          case "OK":
            state.current = States.MESSAGE_ACKNOWLEDGED;
            break;
          default:
            state.current = States.MESSAGE_NOT_ACKNOWLEDGED;
            break
        }
      }

      
      if (cmd.match(/^ATD/i)) {
        switch (code) {
          case "OK":
            state.current = States.CALL_CALLING;
            break;
          case "RING":
            state.current = States.CALL_RINGING;
            break;
          case "CONNECT":
            state.current = States.CALL_CONNECTED;
            break;
          case "ERROR":
            state.current = States.CALL_FAILED;
            break;
          case "NO CARRIER":
            state.current = States.CALL_NO_LINE;
            break;
          case "BUSY":
            state.current = States.CALL_BUSY;
            break;
          default:
            state.current = States.CALL_UNKNOWN;
        }
      } else if (cmd.match(/^ATA/i)) {
        switch (code) {
          case "OK":
            state.current = States.ANSWER_SUCCESS;
            break;
          case "ERROR":
            state.current = States.ANSWER_FAILED;
            break;
          default:
            state.current = States.ANSWER_UNKNOWN;
        }
      } else if (cmd.match(/^ATH/i)) {
        switch (code) {
          case "OK":
            state.current = States.HANGUP_SUCCESS;
            break;
          case "ERROR":
            state.current = States.HANGUP_FAILED;
            break;
          default:
            state.current = States.HANGUP_UNKNOWN;
        }
      }

      if(code.match(/^\+CMGS/)){
        state.current = States.MESSAGE_SENT;
      }
    
    return { state, cmd, code };
  }
}
