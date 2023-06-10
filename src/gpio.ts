import GPIO from "rpi-gpio";
import { sleep } from "./utils";

export class GPIOManager {
  async powerOn(powerKey: number = 6) {
    GPIO.setMode(GPIO.MODE_BCM);
    GPIO.setup(powerKey, GPIO.DIR_OUT);
    await sleep(100);
    GPIO.output(powerKey, true);
    await sleep(100);
    GPIO.output(powerKey, false);
    await sleep(100);
  }

  async powerDown(powerKey: number = 6) {
    GPIO.output(powerKey, true);
    await sleep(100);
    GPIO.output(powerKey, false);
    await sleep(100);
  }
}
