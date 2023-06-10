import GPIO from "rpi-gpio";
import { sleep } from "./utils";

export class GPIOManager {
  async powerOn(powerKey: number = 6) {
    console.log("SIM7600X is starting:");
    GPIO.setMode(GPIO.MODE_BCM);
    GPIO.setup(powerKey, GPIO.DIR_OUT);
    await sleep(100);
    GPIO.output(powerKey, true);
    await sleep(100);
    GPIO.output(powerKey, false);
    await sleep(100);
    console.log("SIM7600X is ready");
  }

  async powerDown(powerKey: number = 6) {
    console.log("SIM7600X is loging off:");
    GPIO.output(powerKey, true);
    await sleep(100);
    GPIO.output(powerKey, false);
    await sleep(100);
    console.log("Good bye");
  }
}
