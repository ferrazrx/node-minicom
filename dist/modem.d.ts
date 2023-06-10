import * as serialPort from "serialport";
import { AutoDetectTypes } from "@serialport/bindings-cpp";
export declare function Modem(opts: serialPort.SerialPortOpenOptions<AutoDetectTypes>): void;
export declare namespace Modem {
    var list: () => Promise<import("@serialport/bindings-interface").PortInfo[]>;
}
