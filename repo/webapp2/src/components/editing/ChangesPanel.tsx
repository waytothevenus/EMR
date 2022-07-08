import { FhirResourceById, useFHIR } from "../../redux/FhirState";
import * as FHIR from "../../utils/FhirTypes";

import css from "./ChangesPanel.module.scss";

export function ChangesPanel() {
    const originals = useFHIR((s) => s.fhir.resources);
    const edits = useFHIR((s) => s.fhir.edits);

    function changes<T extends FHIR.Resource>(edited: FhirResourceById<T>) {
        return Object.values(edited).filter((r) => {
            const key = r.resourceType[0].toLowerCase() + r.resourceType.substring(1) + "s";
            // @ts-ignore
            const orig = originals[key][r.id];
            const origJSON = JSON.stringify(orig);
            const editedJSON = JSON.stringify(r);
            // console.log({ origJSON, editedJSON, key, id: r.id, originals });
            return origJSON !== editedJSON;
        });
    }

    const topicChanges = changes(edits.compositions);
    const anyChanges = topicChanges.length > 0;

    return (
        <div className={css.container}>
            {anyChanges && <h5>Changes</h5>}

            <ul>
                {topicChanges.map((r) => (
                    <li key={r.id}>
                        <a onClick={() => {}}>Topic - {r.title}</a>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function TopicChanges() {
    const originals = useFHIR((s) => s.fhir.resources);
    const edits = useFHIR((s) => s.fhir.edits);

    const anyChanges = Object.values(edits).some((o) => Object.keys(o).length > 0);

    function changes<T extends FHIR.Resource>(edited: FhirResourceById<T>) {
        return Object.values(edited).filter((r) => {
            const key = r.resourceType[0].toLowerCase() + r.resourceType.substring(1) + "s";
            // @ts-ignore
            const orig = originals[key][r.id];
            const origJSON = JSON.stringify(orig);
            const editedJSON = JSON.stringify(r);
            console.log({ orignJSON: origJSON, editedJSON });
            return origJSON !== editedJSON;
        });
    }

    return (
        <div className={css.container}>
            {anyChanges && <h5>Changes</h5>}

            <ul>
                {changes(edits.compositions).map((r) => (
                    <li key={r.id}>Topic - {r.title}</li>
                ))}
            </ul>
        </div>
    );
}
