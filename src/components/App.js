
import React, { useEffect, useState } from "react";
import styled from "styled-components";
import connect from "../services/FhirClient";
import { JsonToTable } from "react-json-to-table";
import { getPath } from "fhirclient/lib/lib";

import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import { AgGridReact } from "ag-grid-react";
import { Grid } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

const rxnorm = "http://www.nlm.nih.gov/research/umls/rxnorm";

function App() {

  const [client, setClient] = useState({});
  const [patient, setPatient] = useState();
  const [medicationRequest, setMedicationRequest] = useState();
  const [observation, setObservation] = useState();
  const myJson = patient;
  //const myJsonMR = medicationRequest;
  const myJsonObservation = observation;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const client = await connect();
        setClient(client);
        
        /* Fetch the Patient and other resources here using FhirClient */
        const patient = await client.request(`Patient/${client.patient.id}`);

        const medicationRequest = await client.request(`/MedicationRequest?patient=${client.patient.id}`, {
          resolveReferences: "medicationReference",
          pageLimit: 0,
          flat: true
        });
        const observation = await client.request(`/Observation?patient=${client.patient.id}`, {
          resolveReferences: "observation",
          pageLimit: 0,
          flat: true
        });

        /* use setState to store it in the component state */

        setPatient(patient);
        setMedicationRequest(medicationRequest);
        setObservation(observation);

      } catch (e) {
        console.log(e);
      }
    };
    fetchData();
  }, []);
  
  function getMedicationName(medCodings = []) {
    let out = "Unnamed Medication(TM)";
    const coding = medCodings.find((c) => c.system === rxnorm);
    if (coding && coding.display) {
      out = coding.display;
    }
    return out;
  }

  function MedRow({ med }) {
    const name = getMedicationName(
      getPath(med, "medicationCodeableConcept.coding") ||
      getPath(med, "medicationReference.code.coding")
    );
    return (
      <tr>
        <td>
          <b>{name}</b>
        </td>
        <td>{med.status || "-"}</td>
        <td>{med.intent || "-"}</td>
        <td>{getPath(med, "dosageInstruction.0.text") || "-"}</td>
      </tr>
    );
  }

  let dataArray = [];
  let dataObject = {};
  const renderLineChart = (
    <LineChart width={1500} height={400} data={dataArray}>
      <Line type="monotone" dataKey="value" stroke="#8884d8" />
      <CartesianGrid stroke="#ccc" />
      <XAxis dataKey="effectiveDateTime" />
      <YAxis />
      <Tooltip />
    </LineChart>
  );

  function ObsTableArray({ obs }) {

    if (obs.code.coding[0].code !== '8867-4') { return; } // only heart rate
    dataObject = {
      system: obs?.code?.coding[0]?.system || "-",
      code: obs?.code?.coding[0]?.code || "-",
      display: obs?.code?.coding[0]?.display || "-",
      text: obs?.code?.text || "-",
      value: obs?.valueQuantity?.value || "-",
      unit: obs?.valueQuantity?.unit || "-",
      effectiveDateTime: obs?.effectiveDateTime || "-"
    };
    dataArray.push(dataObject);
  }

  const [rowData] = useState([
    dataArray
  ]);
  // console.log("rowData " +  JSON.stringify(rowData));

  const [columnDefs] = useState([
    { field: 'system' },
    { field: 'code' },
    { field: 'display' },
    { field: 'text' },
    { field: 'value' },
    { field: 'unit' },
    { field: 'effectiveDateTime' }
  ]);

  return (
    <div className="App">

      {myJsonObservation?.map((obs) => (
        <ObsTableArray key={obs.id} obs={obs} />
      ))}

      <p>PATIENT DATA:</p>
      <JsonToTable json={myJson} />

      <p>HEART RATE:</p>
      <div className="ag-theme-alpine" style={{ height: 400, width: 1500 }}>
        <AgGridReact
          rowData={dataArray}
          columnDefs={columnDefs}>
        </AgGridReact>
      </div>
      <p></p>
      {renderLineChart}

      {/* <p>MEDICATIONS:</p>
      <JsonToTable json={myJsonMR} /> */}
    </div>
  );
}

export default App;

// const Container = styled.div`
//   display: flex;
//   margin: 2rem;
//   justify-content: center;
// `;

// const Box = styled.div`
//   padding: 5px;
//   flex: 1;
// `;

// const TextArea = styled.textarea`
//   width: 100%;
// `;

/**
 * Functional components return JSX to render.
 */

  //console.log("myJsonObservation " + myJsonObservation);

  // return (
  //   <div className="App">taulukko a<JsonToTable json={myJason} />taulukko b</div>
  //   <Container>
  //     <Box>
  //       <h1>SMART on FHIR App</h1>
  //       <p>Quick links:</p>
  //       <ul>
  //         <li>
  //           <a href="launch.html?launch=eyJhIjoiMSIsImYiOiIxIn0&iss=https%3A%2F%2Flaunch.smarthealthit.org%2Fv%2Fr4%2Ffhir">
  //             Simulate EHR Launch
  //           </a>
  //         </li>

  //         <li>
  //           <a href="http://hl7.org/fhir/smart-app-launch/">
  //             SMART on FHIR HL7 documentation
  //           </a>
  //         </li>
  //         <li>
  //           <a href="https://reactjs.org/tutorial/tutorial.html">
  //             React tutorial
  //           </a>
  //         </li>
  //       </ul>
  //       <p>Client:</p>
  //       {client ? (

  //         <TextArea rows={20} value={JSON.stringify(client)} disabled />
  //       ) : null}
  //     </Box>
  //     <p>Patient:</p>


  //     <Box>
  //       {/* Render resources */}
  //       { <TextArea        
  //         rows={30}
  //         value={JSON.stringify(patient, null, 2)}
  //       /> 

  //       }
  //     </Box>
  //     <div className="App">
  //       {/* ===================== */}
  //       {/* HOW TO USE IT         */}
  //       {/* ===================== */}
  //       <JsonToTable json={JSON.stringify(patient, null, 2)} />
  //       {/* ===================== */}
  //     </div>
  //   </Container>

  // );

    // function ObsRow({ obs }) {

  //   // const name = getMedicationName(
  //   //   getPath(med, "medicationCodeableConcept.coding") ||
  //   //     getPath(med, "medicationReference.code.coding")
  //   // );
  //   if (obs.code.coding[0].code !== '8867-4') { return; }
  //   return (
  //     <tr>
  //       <td>
  //         {/* <b>{name}</b> */}
  //       </td>
  //       <td>{obs?.code?.coding[0]?.system || "-"}</td>
  //       <td>{obs?.code?.coding[0]?.code || "-"}</td>
  //       <td>{obs?.code?.coding[0]?.display || "-"}</td>
  //       <td>{obs?.code?.text || "-"}</td>
  //       <td>{obs?.valueQuantity?.value || "-"}</td>
  //       <td>{obs?.valueQuantity?.unit || "-"}</td>
  //       <td>{obs?.effectiveDateTime || "-"}</td>
  //       {/* <td>{obs?.text?.div || "-"}</td> */}
  //     </tr>
  //   );
  // }


// {<table className="App">
// <thead>
//   {/* <tr>
//     <th>Medication</th>
//     <th>Status</th>
//     <th>Intent</th>
//     <th>Dosage Instruction</th>
//   </tr> */}
// </thead>
// <tbody>
//   {/* {myJsonMR?.map((me) => (
//     <MedRow key={me.id} med={me} />
//   ))}
//   {myJsonObservation?.map((obs) => (
//     <ObsRow key={obs.id} obs={obs} />
//   ))} */}
//   {/* {myJsonObservation?.map((obs) => (
//     <ObsTableArray key={obs.id} obs={obs} />
//   ))} */}
// </tbody>
// </table>}
