"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Modem = void 0;
const serialPort = __importStar(require("serialport"));
const state_handler_1 = require("./state_handler");
const stream_1 = __importDefault(require("stream"));
const Serial = serialPort.SerialPort;
function Modem(opts) {
    stream_1.default.Stream.call(this);
    this.serialPort = this.setupPort(opts);
    this.state = {
        initial: null,
        current: null,
        previous: null,
    };
    this.activeCmd = null;
    this.activeResp = null;
}
exports.Modem = Modem;
Modem.prototype.write = function (data) {
    this.emit("data", data);
};
Modem.prototype.end = function (data) {
    if (data)
        this.write(data);
    this.emit("end");
};
Modem.prototype.close = function () {
    this.writeable = false;
    this.readable = false;
    this.emit("close");
};
Modem.prototype.destroy = function () {
    this.close();
};
Modem.prototype.setupPort = function (opts) {
    const serialPort = new Serial(opts);
    this.state.initial = "CREATED";
    this.writeable = true;
    this.readable = true;
    serialPort.on("data", this.dataHandler.bind(this, opts.path));
    serialPort.on("error", this.errorHandler.bind(this, opts.path));
    return serialPort;
};
Modem.prototype.dataHandler = function (path, data) {
    const ret = (0, state_handler_1.handleState)(this.state, this.activeCmd, data.code, data.data);
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
        else
            this.emit("data", ret.data);
    }
};
Modem.prototype.errorHandler = function (path, err) {
    console.log("Modem error: ", err);
    const e = new Error(path + " has failed to load: " + err);
    this.emit("error", { error: e, path });
};
Modem.prototype.init = function (initStr) {
    const i = this.formatInit(initStr);
    console.log("Init string: ", i);
    this.writeRaw(i);
    return this;
};
Modem.prototype.writeRaw = function (buf) {
    this.activeCmd =
        typeof buf === "string" ? buf : buf === undefined ? "" : buf.toString();
    this.state.previous = this.state.current;
    this.state.current = "WRITTING";
    if (Buffer.isBuffer(buf))
        this.sp.write(buf);
    else if (typeof buf === "string") {
        buf = this.formatCmd(buf);
        this.sp.write(buf);
    }
    return this;
};
Modem.prototype.dial = function (dest) {
    const src = this;
    if (typeof dest === "string")
        return src.writeRaw("ATDT" + dest);
    else {
        src.writeRaw("ATDT" + dest.phone);
        //dest.modem.pipe(src);
    }
    return this;
};
Modem.prototype.formatInit = function (init) {
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
};
Modem.prototype.formatCmd = function (str) {
    let ret = str;
    const beg = "AT";
    const end = "\r\n";
    str.trim();
    if (!str.match(/^AT/))
        ret = beg + ret;
    if (!str.match(/[\r\n]+$/))
        ret = ret + end;
    return ret;
};
Modem.list = Serial.list;
