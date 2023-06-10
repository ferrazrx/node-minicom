import Minicom from "..";

const minicom = new Minicom();

const port = minicom.addPort({
  path: "/dev/ttyS0",
  baudRate: 115200,
  phone: "19022203567",
});

const call = async () => {
  port
    .callPhoneNumber()
    .then((e) => {
      if (e) {
        console.log("HERE: MESSAGE RECEIVED!");
        port.modem.on("call", (data) => console.log(data));
        port.modem.on("data", (data) => console.log(data));
      }
    })
    .catch((e) => {
      console.log("Something went wrong! Please try again");
    });
};

call();
