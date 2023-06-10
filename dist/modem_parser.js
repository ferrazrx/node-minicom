"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modemParser = void 0;
const codes_1 = require("./codes");
const modemParser = function () {
    let tmp = [];
    const parse = function (str) {
        const rn = /[\r\n]+/;
        let fp;
        const res = {
            code: "",
            data: [],
        };
        fp = str.match(rn);
        if (fp) {
            if (fp.index === 0) {
                str = str.substr(fp[0].length); //marker at beginning
                return parse(str);
            }
            if (fp.index > 0) {
                //marker in middle or at end
                tmp.push(str.substring(0, fp.index)); //save text
                str = str.substr(fp.index + fp[0].length); //shift sentence past marker
                if (str.length > 0)
                    return parse(str);
            }
        }
        if (tmp.length) {
            res.data = [];
            tmp.forEach(function (v, i) {
                if (codes_1.response_codes.indexOf(v) !== -1) {
                    res.code = v;
                    tmp.splice(i + 1);
                }
                else {
                    res.data.push(v);
                }
            });
            tmp = [];
        }
        else {
            res.data = [];
            res.code = "";
            tmp = [];
        }
        return res;
    };
    return function (emitter, buf) {
        const data = buf.toString();
        const ret = parse(data);
        emitter.emit("data", ret);
    };
};
exports.modemParser = modemParser;
