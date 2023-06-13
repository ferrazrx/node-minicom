import Minicom from "..";

const minicom = new Minicom();

const port = minicom.addPort({
  path: "/dev/ttyS0",
  baudRate: 115200,
  phone: "19022203567",
});


port.modem.on("data", (data) => console.log(data))
port.sendShortMessage("TEST 01")


