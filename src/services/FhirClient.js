//Kristian hakusi tämän
import XXX from "chart.js";

import FHIR from "fhirclient";
//const { TextEncoder, TextDecoder } = require("util");

let client;

const connect = async () => {
  if (client) {
    return client;
  }
  return FHIR.oauth2.ready().then((smart) => {
    client = smart;
    console.log('client ' + JSON.stringify(client.request("Patient")) );
    console.log('client ' + JSON.stringify(client) );
    return client;
  });
};

export default connect;
