import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Draft } from "immer";
import * as Redux from "react-redux";
import { put, takeEvery } from "redux-saga/effects";
import { call, fork, select, take } from "typed-redux-saga";

import * as FHIR from "@topical-ehr/fhir-types";
import { Codes } from "@topical-ehr/fhir-types/FhirCodes";
import { FhirResourceById } from "@topical-ehr/fhir-types";

import type { RootState } from "./store";
import { EHRConfig } from "./config";
import { FhirServerConfigData, FhirServerMethods, fhirUp } from "./fhir-server";

export interface QueryRequest {
    id: string;
    query: string;
    showLoadingScreen: boolean;
}
type QueryState =
    | { state: "loading"; showLoadingScreen: boolean }
    | { state: "error"; error: unknown }
    | { state: "loaded" };

interface SaveRequest {
    // enables saving a subset of edited resources (e.g. just-added obs)
    filter?(editedResource: FHIR.Resource): boolean;
    resource?: FHIR.Resource;

    progressNote?: { html: string; markdown: string };
}

function getResourcesToSave(state: State, saveRequest: SaveRequest | FHIR.Resource) {
    if (FHIR.isResource(saveRequest)) {
        return [saveRequest];
    }

    const resources: FHIR.Resource[] = Object.values(state.edits).flatMap(Object.values);
    const { filter, resource } = saveRequest;
    if (filter) {
        return resources.filter(filter);
    } else if (resource) {
        return resources.filter(
            (r) => r.resourceType === resource.resourceType && r.id === resource.id
        );
    } else {
        return resources;
    }
}

type SaveState =
    | { state: "saving" }
    | { state: "error"; error: unknown }
    | { state: "saved" };

export interface FhirResources<T = never> {
    compositions: FhirResourceById<FHIR.Composition | T>;
    conditions: FhirResourceById<FHIR.Condition | T>;
    encounters: FhirResourceById<FHIR.Encounter | T>;
    patients: FhirResourceById<FHIR.Patient | T>;
    observations: FhirResourceById<FHIR.Observation | T>;
    diagnosticReports: FhirResourceById<FHIR.DiagnosticReport | T>;
    lists: FhirResourceById<FHIR.List | T>;
    medicationAdministrations: FhirResourceById<FHIR.MedicationAdministration | T>;
    medicationRequests: FhirResourceById<FHIR.MedicationRequest | T>;
    serviceRequests: FhirResourceById<FHIR.ServiceRequest | T>;
    tasks: FhirResourceById<FHIR.Task | T>;
}
export const emptyResources: FhirResources = {
    compositions: {},
    conditions: {},
    encounters: {},
    patients: {},
    observations: {},
    diagnosticReports: {},
    lists: {},
    medicationAdministrations: {},
    medicationRequests: {},
    serviceRequests: {},
    tasks: {},
};

function getResourceContainer(resources: Draft<FhirResources>, resourceType: string) {
    switch (resourceType) {
        case "Composition":
            return resources.compositions;
        case "Condition":
            return resources.conditions;
        case "Encounter":
            return resources.encounters;
        case "List":
            return resources.lists;
        case "Patient":
            return resources.patients;
        case "Observation":
            return resources.observations;
        case "DiagnosticReport":
            return resources.diagnosticReports;
        case "MedicationAdministration":
            return resources.medicationAdministrations;
        case "MedicationRequest":
            return resources.medicationRequests;
        case "ServiceRequest":
            return resources.serviceRequests;
        case "Task":
            return resources.tasks;
        default:
            throw new Error(`No state object for resource ${resourceType}`);
    }
}

function setResource(resources: Draft<FhirResources>, r: FHIR.Resource) {
    const container = getResourceContainer(resources, r.resourceType);
    // @ts-expect-error
    container[r.id] = r;
}

export function getResource(
    resources: Draft<FhirResources>,
    r: FHIR.Resource
): FHIR.Resource {
    const container = getResourceContainer(resources, r.resourceType);
    return container[r.id];
}

function deleteResource(resources: Draft<FhirResources>, r: FHIR.Resource) {
    const container = getResourceContainer(resources, r.resourceType);
    delete container[r.id];
}

export interface ByCode<T> {
    [code: string]: T[];
}

export interface State {
    // loaded state of FHIR queries
    queries: {
        [query: string]: QueryState;
    };
    showLoadingScreen: boolean;
    showErrors: boolean;

    // loaded resources, including edits
    resourcesWithEdits: FhirResources;

    // resources persisted at server (for undo)
    resourcesFromServer: FhirResources;

    // edits
    edits: FhirResources;
    deletions: FhirResourceById<FHIR.Resource>;

    // loaded resource by code (without edits)
    byCode: {
        observations: ByCode<FHIR.Observation>;
    };

    saveState: SaveState | null;
    saveGeneration: number;

    // config
    patientId: string;
    practitionerId: string;
    serverConfig: FhirServerConfigData;

    // misc
    showingPanels: Record<string, boolean>;
    showingInTimeline: ShowInTimeline;
    searchingFor: string | null;
    unread: Record<string, boolean>;
}

export interface ShowInTimeline {
    obs: boolean;
    labs: boolean;
    meds: boolean;
    notes: boolean;
}

export function initialState(
    config: EHRConfig | null,
    serverConfig: FhirServerConfigData
): State {
    return {
        queries: {},
        showLoadingScreen: true,
        showErrors: false,
        resourcesWithEdits: emptyResources,
        resourcesFromServer: emptyResources,
        edits: emptyResources,
        deletions: {},
        saveState: null,
        saveGeneration: 0,
        byCode: {
            observations: {},
        },

        // set by preloadedState
        patientId: config?.patientId ?? "",
        practitionerId: config?.practitionerId ?? "",
        serverConfig,

        showingPanels: {},
        showingInTimeline: {
            obs: true,
            labs: true,
            meds: true,
            notes: false,
        },
        searchingFor: null,
        unread: {},
    };
}

export const fhirSlice = createSlice({
    name: "FHIR",
    initialState: initialState(null, { server: { type: "http", baseUrl: "/fhir" } }),
    reducers: {
        query(state, action: PayloadAction<QueryRequest>) {
            // handled by the saga
        },
        queryLoading(state, action: PayloadAction<QueryRequest>) {
            const { query, showLoadingScreen } = action.payload;
            state.queries[query] = { state: "loading", showLoadingScreen };
        },
        queryLoaded(state, action: PayloadAction<[QueryRequest, FHIR.Resource[]]>) {
            const [request, resources] = action.payload;
            const { query } = request;

            for (const resource of resources) {
                setResource(state.resourcesWithEdits, resource);
                setResource(state.resourcesFromServer, resource);
            }
            state.queries[query] = { state: "loaded" };

            if (state.showLoadingScreen) {
                state.showLoadingScreen = Object.values(state.queries).some(
                    (q) => q.state === "loading" && q.showLoadingScreen
                );
            }
        },
        queryError(state, action: PayloadAction<[QueryRequest, unknown]>) {
            const [request, error] = action.payload;
            const { query } = request;

            state.queries[query] = {
                state: "error",
                error,
            };
            state.showErrors = true;
        },

        listAdd(
            state,
            { payload }: PayloadAction<{ list: FHIR.List; add: FHIR.Resource }>
        ) {
            // update the immer draft inside the store
            const list = state.resourcesWithEdits.lists[payload.list.id];
            list.entry = (list.entry ?? []).concat({
                item: FHIR.referenceTo(payload.add),
            });

            setResource(state.edits, list);
            setResource(state.resourcesWithEdits, list);
            state.saveState = null;
        },
        listRemove(
            state,
            { payload }: PayloadAction<{ list: FHIR.List; remove: FHIR.Resource }>
        ) {
            // update the immer draft inside the store
            const toRemove = FHIR.referenceTo(payload.remove).reference;

            const list = state.resourcesWithEdits.lists[payload.list.id];
            const index = (list.entry ?? []).findIndex(
                (val) => val.item.reference === toRemove
            );

            if (index >= 0) {
                list.entry = (list.entry ?? []).splice(index, 1);
            }

            setResource(state.edits, list);
            setResource(state.resourcesWithEdits, list);
            state.saveState = null;
        },

        edit(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            setResource(state.edits, resource);
            setResource(state.resourcesWithEdits, resource);
            state.saveState = null;
        },

        addAutoGenerated(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            // e.g. when we generate Compsitions from existing Conditions and Encounters
            // for them to be displayed but the user hasn't edited them yet
            setResource(state.resourcesWithEdits, resource);
        },

        undoEdits(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            deleteResource(state.edits, resource);

            const original = getResource(state.resourcesFromServer, resource);
            setResource(state.resourcesWithEdits, original);
        },

        delete(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            state.deletions[FHIR.referenceTo(resource).reference] = resource;
            deleteResource(state.resourcesWithEdits, resource);
            deleteResource(state.edits, resource);
            state.saveState = null;
        },
        deleteImmediately(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            deleteResource(state.resourcesWithEdits, resource);
            deleteResource(state.edits, resource);
            state.saveState = null;
        },
        undoDelete(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            delete state.deletions[FHIR.referenceTo(resource).reference];

            const original = getResource(state.resourcesFromServer, resource);
            setResource(state.resourcesWithEdits, original);
        },

        save(state, action: PayloadAction<SaveRequest | FHIR.Resource>) {
            const progressNote = FHIR.isResource(action.payload)
                ? null
                : action.payload.progressNote;
            if (progressNote) {
                const toSave = getResourcesToSave(state, action.payload);
                const references: FHIR.Reference[] = toSave.map((r) => ({
                    ...FHIR.referenceTo(r),
                    _reference: {
                        // sav new/current versionIds for diffs
                        extension: [
                            {
                                url: Codes.Extension.ResolveAsVersionSpecific,
                                valueBoolean: true,
                            },
                            ...(r.meta.versionId
                                ? [
                                      {
                                          url: Codes.Extension.VersionModified,
                                          valueReference: {
                                              reference: `${r.resourceType}/${r.id}/_history/${r.meta.versionId}`,
                                          },
                                      },
                                  ]
                                : []),
                        ],
                    },
                }));

                const now = new Date().toISOString();
                const newComposition = FHIR.Composition.new({
                    subject: { reference: `Patient/${state.patientId}` },
                    status: "final",
                    type: Codes.Composition.Type.ProgressNote,
                    date: now,
                    title: "Progress Note",
                    section: [
                        {
                            title: "Progress note",
                            text: {
                                div: `<div>${progressNote.html}</div>`,
                                status: "additional",
                            },
                        },
                        {
                            title: "Associated changes",
                            entry: references,
                        },
                    ],
                });
                setResource(state.edits, newComposition);
            }

            state.saveState = { state: "saving" };
            // processed by a saga
        },

        setSaveState(state, action: PayloadAction<SaveState>) {
            state.saveState = action.payload;
        },

        setSaved(state, { payload: resources }: PayloadAction<FHIR.Resource[]>) {
            // commit edits
            for (const resource of resources) {
                setResource(state.resourcesFromServer, resource);
                deleteResource(state.edits, resource);
            }
            state.saveGeneration += 1;
        },

        deleted(state, { payload: resource }: PayloadAction<FHIR.Resource>) {
            // commit deletion
            deleteResource(state.resourcesFromServer, resource);
            state.saveGeneration += 1;
        },

        undoAll(state, action: PayloadAction<void>) {
            for (const key of Object.keys(state.edits)) {
                // @ts-ignore
                state.edits[key] = {};
            }
        },

        setObservationsByCode(state, action: PayloadAction<ByCode<FHIR.Observation>>) {
            state.byCode.observations = action.payload;
        },

        updateUnread(state, { payload }: PayloadAction<FHIR.List>) {
            const unread = {};
            const refs = payload.entry?.map((e) => e.item.reference) ?? [];
            for (const ref of refs) {
                if (ref) {
                    unread[ref] = true;
                }
            }
            state.unread = unread;
        },

        markRead(state, { payload }: PayloadAction<FHIR.Resource>) {
            delete state.unread[FHIR.typeId(payload)];
        },
        markUnread(state, { payload }: PayloadAction<FHIR.Resource>) {
            state.unread[FHIR.typeId(payload)] = true;
        },

        showPanel(state, { payload }: PayloadAction<string>) {
            state.showingPanels[payload] = true;
        },
        hidePanel(state, { payload }: PayloadAction<string>) {
            state.showingPanels[payload] = false;
        },
        setSearchingFor(state, { payload }: PayloadAction<string>) {
            state.searchingFor = payload || null;
        },
        setShowInTimeline(
            state,
            { payload }: PayloadAction<{ group: keyof ShowInTimeline; show: boolean }>
        ) {
            state.showingInTimeline[payload.group] = payload.show;
        },

        setPractitioner(state, { payload }: PayloadAction<FHIR.Practitioner>) {
            state.practitionerId = payload.id;

            const url = new URL(window.location.href);
            url.searchParams.set("practitioner", payload.id);
            history.pushState("", "", url);
        },
    },
});

function* onQuerySaga(
    fhirServer: FhirServerMethods,
    action: PayloadAction<QueryRequest>
) {
    const { query } = action.payload;
    const state = yield* select((s: RootState) => s.fhir.queries[query]);
    if (!state) {
        yield put(actions.queryLoading(action.payload));

        try {
            // Call FHIR server
            const data: FHIR.Resource = yield* call(fhirServer.get, query);
            if (FHIR.isBundle(data)) {
                yield put(
                    actions.queryLoaded([
                        action.payload,
                        data.entry?.map((e) => e.resource) || [],
                    ])
                );
            } else {
                yield put(actions.queryLoaded([action.payload, [data]]));
            }
        } catch (err) {
            console.error("FHIR error", query, err);
            yield put(actions.queryError([action.payload, err]));
        }
    }
}

function addToMappedList<T>(map: ByCode<T>, key: string, value: T) {
    const list = map[key];
    if (list) {
        list.push(value);
    } else {
        map[key] = [value];
    }
}
function* updateObservationsByCodeSaga(
    action: PayloadAction<[QueryRequest, FHIR.Resource[]]>
) {
    const [request] = action.payload;
    const { query } = request;

    if (!query.startsWith("Observation")) {
        return;
    }

    const observations = yield* select(
        (s: RootState) => s.fhir.resourcesWithEdits.observations
    );
    const observationsByCode: ByCode<FHIR.Observation> = {};
    for (const observation of Object.values(observations)) {
        for (const code of observation.code.coding ?? []) {
            const obKey = code.system + "|" + code.code;
            addToMappedList(observationsByCode, obKey, observation);
        }
    }
    yield put(actions.setObservationsByCode(observationsByCode));
}

function* onSaveSaga(fhirServer: FhirServerMethods, action: PayloadAction<SaveRequest>) {
    yield put(actions.setSaveState({ state: "saving" }));

    // form a transaction bundle
    const state = yield* select((s: RootState) => s.fhir);
    const toSave = getResourcesToSave(state, action.payload);
    const entries = toSave.map((resource) => {
        const isUUID = resource.id.startsWith("urn:uuid:");
        return {
            fullUrl: (isUUID ? "" : resource.resourceType + "/") + resource.id,
            resource,
            request: {
                method: isUUID ? "POST" : "PUT",
                url: isUUID
                    ? resource.resourceType
                    : resource.resourceType + "/" + resource.id,
            },
        };
    });
    const bundle = FHIR.Bundle.newTransaction(entries);
    console.debug("onSaveSaga", { transaction: bundle });

    try {
        // send transaction to FHIR server
        const response: FHIR.Resource = yield* call(fhirServer.post, bundle);
        if (FHIR.isBundle(response)) {
            yield put(actions.setSaved(toSave));
        } else {
            console.error("transaction response is not a bundle", response);
        }
    } catch (error) {
        console.error("FHIR save error", error);
        yield put(actions.setSaveState({ state: "error", error }));
    }
}

function* onDeleteImmediately(
    fhirServer: FhirServerMethods,
    { payload: resource }: PayloadAction<FHIR.Resource>
) {
    try {
        // send DELETE to FHIR server
        yield* call(fhirServer.delete, resource);
        yield put(actions.deleted(resource));
    } catch (error) {
        console.error("FHIR DELETE error", error);
    }
}

export function* coreFhirSagas(additionalSagas: ((...args: any[]) => any)[]) {
    const serverConfig = yield* select((s: RootState) => s.fhir.serverConfig);
    const fhirServer = yield* call(fhirUp, serverConfig);

    yield takeEvery(actions.query.type, onQuerySaga, fhirServer);
    yield takeEvery(actions.queryLoaded.type, updateObservationsByCodeSaga);

    yield takeEvery(actions.save.type, onSaveSaga, fhirServer);
    yield takeEvery(actions.deleteImmediately.type, onDeleteImmediately, fhirServer);

    for (const saga of additionalSagas) {
        yield* fork(saga, fhirServer);
    }
}

export function* waitForResourcesToLoadSaga() {
    while (true) {
        yield take(actions.queryLoaded.type);
        const stillLoading = yield* select((s: RootState) => s.fhir.showLoadingScreen);
        if (!stillLoading) {
            break;
        }
    }
}

export const useFHIR: Redux.TypedUseSelectorHook<{ fhir: State }> = Redux.useSelector;

/*
export function useFHIRQuery(query: string): QueryState {
    // request the query
    const dispatch = useDispatch();
    React.useEffect(() => {
        dispatch(actions.query(query));
    }, []);

    // load & watch query status
    const state = useFHIR((s) => s.fhir.queries[query]) ?? { state: "loading" };
    return state;
}
export function useFHIRQueries(queries: string[]): QueryState {
    const states = queries.map(useFHIRQuery);

    const errors = states.filter((s) => s.state === "error" && s.error);
    if (errors.length > 0) {
        return { state: "error", error: errors[0] };
    }

    const loading = states.some((s) => s.state === "loading");
    if (loading) {
        return { state: "loading" };
    }

    return { state: "loaded" };
}
*/

export const actions = fhirSlice.actions;
export const useDispatch = Redux.useDispatch;
