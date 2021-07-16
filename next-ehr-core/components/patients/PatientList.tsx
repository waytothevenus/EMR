import {
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  Link,
  SelectionMode,
} from "@fluentui/react";
import React from "react";
import useSWR from "swr";
import { PatientDOB, PatientName } from "../../utils/display";
import { fetcher } from "../../utils/fetcher";

import { Bundle, Patient } from "../../utils/FhirTypes";

import { ErrorMessage } from "../feedback/ErrorMessage";

interface Props {
  filter: (patient: Patient) => boolean;
}

function Filtered(props: Props) {
  console.log("PatientList rendering");
  const { data, error } = useSWR<Bundle<Patient>>(
    "/fhir/Patient?_count=1000",
    fetcher
  );

  if (error) {
    return <ErrorMessage error={error} />;
  }
  if (!data) {
    return <div>Loading...</div>;
  }

  const columns: IColumn[] = [
    {
      key: "index",
      name: "",
      fieldName: "index",
      minWidth: 3,
      maxWidth: 12,
      isResizable: true,
      onRender(item) {
        return item.index;
      },
    },
    {
      key: "name",
      name: "Name",
      fieldName: "name",
      minWidth: 100,
      isResizable: true,
      onRender(item) {
        return <Link href={`/patient/${item.key}`}>{item.name}</Link>;
      },
    },
    {
      key: "DOB",
      name: "DOB",
      fieldName: "dob",
      minWidth: 100,
      isResizable: true,
    },
  ];

  const items = data.entry
    .filter((e) => props.filter(e.resource))
    .map(({ resource: patient }, i) => {
      return {
        key: patient.id,
        index: i,
        name: PatientName(patient),
        dob: PatientDOB(patient),
      };
    });

  function onItemInvoked(item) {
    console.log("onItemInvoked", item);
  }

  return (
    <DetailsList
      items={items}
      columns={columns}
      layoutMode={DetailsListLayoutMode.justified}
      selectionMode={SelectionMode.none}
      onItemInvoked={onItemInvoked}
      onShouldVirtualize={() => false /* virtualisation breaks Control-F */}
    />
  );
}

export function All() {
  return <Filtered filter={() => true} />;
}

export function Recent() {
  return (
    <Filtered filter={(patient) => PatientName(patient).includes("Ira")} />
  );
}

export const PatientList = {
  All,
  Recent,
  Filtered,
};
