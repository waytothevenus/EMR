import { call, put, select, take } from "typed-redux-saga";

import * as FHIR from "@topical-ehr/fhir-types";
import { RootState } from "@topical-ehr/fhir-store/store";
import { actions, waitForResourcesToLoadSaga } from "@topical-ehr/fhir-store";
import { defaultFormattingContext } from "@topical-ehr/formatting/formatting";
import { Codes } from "@topical-ehr/fhir-types/FhirCodes";

import { loadTopics } from "../Topic";

export function* createTopicsForStandaloneResourcesSaga() {
    yield call(waitForResourcesToLoadSaga);
    const resources = yield* select((s: RootState) => s.fhir.resourcesWithEdits);
    const patientId = yield* select((s: RootState) => s.fhir.patientId);
    const { encounters, conditions, compositions, patients } = resources;

    const fromCompositions = loadTopics(compositions, encounters, conditions, {}, {});

    const conditionsInTopics = new Set(
        fromCompositions.flatMap((t) => t.conditions).map((c) => c.id)
    );

    const encountersInTopics = new Set(
        fromCompositions.map((t) => t.encounter?.id).filter((id) => id)
    );

    const conditionsWithoutTopics = Object.values(conditions).filter(
        (c) => !conditionsInTopics.has(c.id)
    );

    const encountersWithoutTopics = Object.values(encounters).filter(
        (e) => !encountersInTopics.has(e.id)
    );

    const newCompositions = conditionsWithoutTopics
        .map((c) => topicCompositionFromCondition(c, patients[patientId]))
        .concat(
            encountersWithoutTopics.map((e) =>
                newTopicFromEncounter(e, patients[patientId])
            )
        );

    for (const composition of newCompositions) {
        yield put(actions.addAutoGenerated(composition));
    }
}

function topicCompositionFromCondition(
    condition: FHIR.Condition,
    patient: FHIR.Patient
): FHIR.Composition {
    const title = condition.code
        ? defaultFormattingContext.code(condition.code).shortText
        : "Topic for un-coded Condition";

    const active = condition.clinicalStatus?.coding?.[0]?.code === "active";

    const newComposition = FHIR.Composition.new({
        subject: FHIR.referenceTo(patient),

        status: "preliminary",
        type: Codes.Composition.Type.Topic,
        date: new Date().toISOString(),
        category: [
            active
                ? Codes.Composition.Category.Active
                : Codes.Composition.Category.Inactive,
        ],
        title,
        section: [
            {
                entry: [FHIR.referenceTo(condition)],
            },
        ],
    });

    return newComposition;
}

function newTopicFromEncounter(
    encounter: FHIR.Encounter,
    patient: FHIR.Patient
): FHIR.Composition {
    const title = "Topic for un-coded Encounter";

    const newComposition = FHIR.Composition.new({
        subject: FHIR.referenceTo(patient),

        status: "preliminary",
        type: Codes.Composition.Type.Topic,
        date: new Date().toISOString(),
        category: [Codes.Composition.Category.Active],
        encounter: FHIR.referenceTo(encounter),
        title,
    });

    return newComposition;
}
