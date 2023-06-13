import Minicom from "..";

const minicom = new Minicom();

const port = minicom.addPort({
  path: "/dev/ttyS0",
  baudRate: 115200,
  phone: "19022203567",
});

port.sendShortMessage({
  text: "TEST 01",
  onData: (data)=> console.log(data),
  onError: (e)=> console.log(e)
})


