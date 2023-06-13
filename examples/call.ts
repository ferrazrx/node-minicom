import Minicom from "..";

const minicom = new Minicom();

const port = minicom.addPort({
  path: "/dev/ttyS0",
  baudRate: 115200,
  phone: "19022203567",
});

port.callPhoneNumber({
  onData: (data)=> {
    if(data.code === 'VOICE CALL: BEGIN'){
      port.audioMessage()
    }
  },
  onError: (e)=> console.log(e) 
})